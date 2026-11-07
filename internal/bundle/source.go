package bundle

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

// The template source kinds.
const (
	// SourceBundled is the tree embedded in the binary.
	SourceBundled = "bundled"
	// SourceRemote is the bundle published as a release asset.
	SourceRemote = "remote"
)

const (
	// fetchTimeout bounds a single request.
	fetchTimeout = 10 * time.Second
	// cacheRetention is the number of bundle versions the cache keeps.
	cacheRetention = 3
	// markerFileName is the cache marker written next to an extracted bundle.
	markerFileName = ".sds-template-bundle.json"
	// templatesDirName is the directory an extracted bundle lives in.
	templatesDirName = "templates"
)

// FetchFunc performs one request and returns the response status and body.
//
// The tests inject a fetch so no request reaches the network.
type FetchFunc func(ctx context.Context, url string) (int, []byte, error)

// Source is a resolved template source.
type Source struct {
	// Source is "bundled" or "remote".
	Source string
	// RootDir is the directory holding the canonical tree, in the
	// "universal/..." layout. It is empty for the bundled source, which has
	// no directory on disk; read that tree through FS.
	RootDir string
	// Version is the bundle version, or the bundled version.
	Version string
	// FallbackReason explains why the remote bundle was not used.
	FallbackReason string
	// ErrorKind is the taxonomy kind of the failure that caused the fallback.
	ErrorKind string
	// SHA256 is the verified digest of the bundle, when one was supplied.
	SHA256 string
	// Warnings are non-fatal notices.
	Warnings []string
	// FS returns the resolved template tree. It is non-nil for the bundled
	// source and for an extracted remote bundle, and exposes the same keys
	// for both: "universal/skills/<skill>/SKILL.md".
	FS fs.FS
}

// ResolveOptions holds the environment a resolution runs against.
type ResolveOptions struct {
	// Source selects "bundled" or "remote"; empty means the default
	// (remote with fallback).
	Source string
	// CacheDir is the template cache directory.
	CacheDir string
	// CLIVersion is the running CLI version, used for the minimum version
	// gate.
	CLIVersion string
	// ManifestURL overrides the default manifest URL.
	ManifestURL string
	// Fetch performs the HTTP request; it is injectable so the tests never
	// touch the network.
	Fetch FetchFunc
	// AllowedHosts overrides the allowed-host list from SDS_TEMPLATE_ALLOWED_HOSTS.
	AllowedHosts []string
	// Now returns the current time, for the cache marker.
	Now func() time.Time
	// RequiredSkills names the skills the bundle must provide. The CLI
	// passes RequiredSkills() to enforce the contract; a nil or empty list
	// accepts any bundle.
	RequiredSkills []string
}

// Resolve resolves the template source.
//
// The remote source is verified before it is used: the manifest is checked
// against the contract, the bundle is verified against the digest the
// manifest carries, and the extracted tree is checked against the files the
// required skills need. A failure of any kind falls back to the embedded
// tree and is reported through the returned source, never as an error.
func Resolve(ctx context.Context, opts ResolveOptions) (Source, error) {
	warnings := []string{}

	if selectedSource(opts) == SourceBundled {
		return Source{
			Source:         SourceBundled,
			Version:        "bundled",
			FallbackReason: "SDS_TEMPLATE_SOURCE is set to bundled",
			Warnings:       warnings,
			FS:             BundledFS(),
		}, nil
	}

	resolved, err := resolveRemote(ctx, opts, warnings)
	if err == nil {
		return resolved, nil
	}

	contractError := &Error{Kind: KindInvalid, Message: err.Error()}
	var typed *Error
	if errors.As(err, &typed) {
		contractError = typed
	}

	return Source{
		Source:         SourceBundled,
		Version:        "bundled",
		FallbackReason: contractError.Message,
		ErrorKind:      contractError.Kind,
		Warnings:       warnings,
		FS:             BundledFS(),
	}, nil
}

// selectedSource returns the configured source kind.
func selectedSource(opts ResolveOptions) string {
	if opts.Source != "" {
		return opts.Source
	}
	if configured := strings.TrimSpace(os.Getenv("SDS_TEMPLATE_SOURCE")); configured != "" {
		return configured
	}
	if os.Getenv("SPEC_DRIVEN_USE_BUNDLED_TEMPLATES") == "true" {
		return SourceBundled
	}
	return SourceRemote
}

// resolveRemote resolves the remote bundle, applying the contract.
func resolveRemote(ctx context.Context, opts ResolveOptions, warnings []string) (Source, error) {
	manifestURL := firstNonEmpty(opts.ManifestURL, os.Getenv("SDS_TEMPLATE_MANIFEST_URL"), DefaultManifestURL)
	cacheDir := firstNonEmpty(opts.CacheDir, os.Getenv("SDS_TEMPLATE_CACHE_DIR"), DefaultCacheDir())
	cliVersion := firstNonEmpty(opts.CLIVersion, os.Getenv("SDS_CLI_VERSION"), "0.0.0")

	manifestValue, _, err := readRemoteJSON(ctx, opts.Fetch, manifestURL, func(host string) bool {
		return IsAllowedHost(host, "")
	})
	if err != nil {
		return Source{}, err
	}

	manifest, err := parseManifestValue(manifestValue)
	if err != nil {
		return Source{}, err
	}

	manifestURLParsed, ok := parseTemplateURL(manifestURL)
	if !ok {
		return Source{}, invalidf("Manifest URL is not a valid URL: %s", redactURL(manifestURL))
	}

	bundleURL, ok := parseTemplateURL(manifest.BundleURL)
	if !ok {
		return Source{}, invalidf("Template manifest bundleUrl is not a valid URL: %s", redactURL(manifest.BundleURL))
	}
	if !isAllowedHost(bundleURL.Host, manifestURLParsed.Host, opts.AllowedHosts) {
		return Source{}, invalidf("Template bundle host is not allowed: %s. Set SDS_TEMPLATE_ALLOWED_HOSTS to override.", redactHost(bundleURL.Host))
	}

	if err := assertCompatibleSchema(manifestSchemaVersion(manifest), "Template manifest"); err != nil {
		return Source{}, err
	}

	if manifest.MinCLIVersion != "" && CompareSemver(cliVersion, manifest.MinCLIVersion) < 0 {
		return Source{}, &Error{
			Kind:    KindIncompatible,
			Message: fmt.Sprintf("Template bundle requires CLI %s or newer (running %s)", manifest.MinCLIVersion, cliVersion),
		}
	}

	if cached, ok := isValidCachedBundle(cacheDir, manifest); ok {
		marker, _ := readCacheMarker(filepath.Dir(cached))
		if err := assertRequiredSkills(markerFileNames(marker), opts.RequiredSkills); err != nil {
			return Source{}, err
		}
		warnings = append(warnings, "Using cached template bundle.")
		return Source{
			Source:   SourceRemote,
			RootDir:  cached,
			Version:  manifest.Version,
			SHA256:   manifest.SHA256,
			Warnings: warnings,
			FS:       os.DirFS(cached),
		}, nil
	}

	bundleValue, bundleBytes, err := readRemoteJSON(ctx, opts.Fetch, manifest.BundleURL, func(host string) bool {
		return isAllowedHost(host, manifestURLParsed.Host, opts.AllowedHosts)
	})
	if err != nil {
		return Source{}, err
	}
	digest := sha256Hex(bundleBytes)

	if manifest.SHA256 != "" && digest != manifest.SHA256 {
		return Source{}, &Error{
			Kind:    KindIntegrity,
			Message: fmt.Sprintf("Template bundle digest mismatch: expected %s, received %s", manifest.SHA256, digest),
		}
	}

	bundle, entries, _, err := parseBundleValue(bundleValue)
	if err != nil {
		return Source{}, err
	}
	if bundle.Version != manifest.Version {
		return Source{}, &Error{
			Kind:    KindIncompatible,
			Message: fmt.Sprintf("Template bundle version mismatch: expected %s, received %s", manifest.Version, bundle.Version),
		}
	}
	if err := assertCompatibleSchema(bundleSchemaVersion(bundle), "Template bundle"); err != nil {
		return Source{}, err
	}
	if err := assertRequiredSkills(entryPaths(entries), opts.RequiredSkills); err != nil {
		return Source{}, err
	}

	rootDir, err := extractBundleToCache(cacheDir, bundle, entries, digest, opts.Now)
	if err != nil {
		return Source{}, err
	}

	if manifest.SHA256 == "" {
		warnings = append(warnings, "Remote template manifest has no sha256 digest; integrity could not be verified.")
	}

	return Source{
		Source:   SourceRemote,
		RootDir:  rootDir,
		Version:  bundle.Version,
		SHA256:   digest,
		Warnings: warnings,
		FS:       os.DirFS(rootDir),
	}, nil
}

// redactURL renders a URL without the credentials it may carry.
func redactURL(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	if parsed.User == nil {
		return raw
	}
	parsed.User = url.User("redacted")
	return parsed.String()
}

// redactHost renders a host without the credentials it may carry.
func redactHost(host string) string {
	if at := strings.LastIndex(host, "@"); at >= 0 {
		return "redacted@" + host[at+1:]
	}
	return host
}

// readRemoteJSON reads a JSON document from the network.
//
// Without a caller-supplied fetch, the request validates every redirect
// against the allowed hosts, so a redirect cannot leave the boundary the
// contract declares.
func readRemoteJSON(ctx context.Context, fetch FetchFunc, url string, allowsHost func(string) bool) (*jsonValue, []byte, error) {
	if fetch == nil {
		fetch = func(ctx context.Context, url string) (int, []byte, error) {
			return FetchWithAllowedHosts(ctx, url, allowsHost)
		}
	}

	status, body, err := fetch(ctx, url)
	if err != nil {
		return nil, nil, &Error{Kind: KindNetwork, Message: "Template request failed: " + err.Error()}
	}
	if status < 200 || status > 299 {
		return nil, nil, &Error{
			Kind:    KindNetwork,
			Message: fmt.Sprintf("Template request failed: %d %s", status, http.StatusText(status)),
		}
	}
	if len(body) > MaxJSONBytes {
		return nil, nil, invalidf("Template response exceeds %d bytes", MaxJSONBytes)
	}

	value, err := decodeJSONDocument(body)
	if err != nil {
		return nil, nil, invalidf("Template response is not valid JSON: %s", nodeJSONError(string(body)))
	}
	return value, body, nil
}

// DefaultFetch performs one request against the template host.
//
// It sends the headers the previous release sent and follows redirects.
func DefaultFetch(ctx context.Context, url string) (int, []byte, error) {
	return FetchWithAllowedHosts(ctx, url, nil)
}

// FetchWithAllowedHosts performs one request and validates every redirect
// against the allowed hosts.
//
// A redirect that leaves the allowed hosts, or that leaves HTTPS, would
// escape the boundary the contract declares, so it is refused rather than
// followed.
func FetchWithAllowedHosts(ctx context.Context, url string, allowsHost func(string) bool) (int, []byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}
	request.Header.Set("user-agent", "spec-driven-steroids")
	request.Header.Set("accept", "application/json")

	client := &http.Client{
		Timeout: fetchTimeout,
		CheckRedirect: func(redirect *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			if redirect.URL.Scheme != "https" {
				return fmt.Errorf("the redirect leaves HTTPS: %s", redirect.URL.Scheme)
			}
			if allowsHost == nil {
				return nil
			}
			if allowsHost(redirect.URL.Host) {
				return nil
			}
			return fmt.Errorf("the redirect leaves the allowed hosts: %s", redirect.URL.Host)
		},
	}
	response, err := client.Do(request)
	if err != nil {
		return 0, nil, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, MaxJSONBytes+1))
	if err != nil {
		return 0, nil, err
	}
	return response.StatusCode, body, nil
}

// DefaultCacheDir returns the directory the template cache lives in.
func DefaultCacheDir() string {
	if dir := os.Getenv("SDS_TEMPLATE_CACHE_DIR"); dir != "" {
		return dir
	}
	switch runtime.GOOS {
	case "windows":
		base := os.Getenv("LOCALAPPDATA")
		if base == "" {
			base = filepath.Join(homeDir(), "AppData", "Local")
		}
		return filepath.Join(base, "spec-driven-steroids", "templates")
	case "darwin":
		return filepath.Join(homeDir(), "Library", "Caches", "spec-driven-steroids", "templates")
	default:
		base := os.Getenv("XDG_CACHE_HOME")
		if base == "" {
			base = filepath.Join(homeDir(), ".cache")
		}
		return filepath.Join(base, "spec-driven-steroids", "templates")
	}
}

// homeDir returns the home directory of the current user.
func homeDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return home
}

// assertRequiredSkills rejects a bundle that does not carry the files the
// required skills need.
func assertRequiredSkills(availableFiles []string, skills []string) error {
	available := make(map[string]bool, len(availableFiles))
	for _, file := range availableFiles {
		available[file] = true
	}

	missing := []string{}
	for _, file := range RequiredSkillFiles(skills) {
		if !available[file] {
			missing = append(missing, file)
		}
	}
	if len(missing) > 0 {
		return &Error{
			Kind:    KindIncompatible,
			Message: "Template bundle is missing required skill files: " + strings.Join(missing, ", "),
		}
	}
	return nil
}

// entryPaths returns the paths of the bundle entries.
func entryPaths(entries []BundleEntry) []string {
	paths := make([]string, 0, len(entries))
	for _, entry := range entries {
		paths = append(paths, entry.Path)
	}
	return paths
}

// manifestSchemaVersion returns the schema version of a manifest, or nil
// when the manifest carried none.
func manifestSchemaVersion(manifest Manifest) *int {
	if !manifest.schemaVersionSet {
		return nil
	}
	version := manifest.SchemaVersion
	return &version
}

// bundleSchemaVersion returns the schema version of a bundle, or nil when
// the bundle carried none.
func bundleSchemaVersion(bundle Bundle) *int {
	if !bundle.schemaVersionSet {
		return nil
	}
	version := bundle.SchemaVersion
	return &version
}

// cacheMarker records what an extracted bundle holds.
type cacheMarker struct {
	SHA256      string
	Version     string
	ExtractedAt string
	Files       map[string]string
	order       []string
}

// MarshalJSON writes the marker the way the previous release wrote it, with
// the file digests in extraction order.
func (m cacheMarker) MarshalJSON() ([]byte, error) {
	files, err := json.Marshal(orderedObject(m.order, m.Files))
	if err != nil {
		return nil, err
	}
	return json.Marshal(struct {
		SHA256      string          `json:"sha256"`
		Version     string          `json:"version"`
		ExtractedAt string          `json:"extractedAt"`
		Files       json.RawMessage `json:"files"`
	}{
		SHA256:      m.SHA256,
		Version:     m.Version,
		ExtractedAt: m.ExtractedAt,
		Files:       files,
	})
}

// orderedObject renders an object with its keys in a given order.
func orderedObject(order []string, values map[string]string) json.RawMessage {
	var builder strings.Builder
	builder.WriteString("{")
	for index, key := range order {
		if index > 0 {
			builder.WriteString(",")
		}
		name, _ := json.Marshal(key)
		value, _ := json.Marshal(values[key])
		builder.Write(name)
		builder.WriteString(":")
		builder.Write(value)
	}
	builder.WriteString("}")
	return json.RawMessage(builder.String())
}

// readCacheMarker reads the marker of an extracted bundle.
func readCacheMarker(versionDir string) (*cacheMarker, bool) {
	raw, err := os.ReadFile(filepath.Join(versionDir, markerFileName))
	if err != nil {
		return nil, false
	}

	value, err := decodeJSONDocument(raw)
	if err != nil {
		return nil, false
	}

	marker := &cacheMarker{}
	if field, ok := value.member("sha256"); ok && field.kind == jsonString {
		marker.SHA256 = field.str
	}
	if field, ok := value.member("version"); ok && field.kind == jsonString {
		marker.Version = field.str
	}
	if field, ok := value.member("extractedAt"); ok && field.kind == jsonString {
		marker.ExtractedAt = field.str
	}
	if field, ok := value.member("files"); ok && field.kind == jsonObject {
		marker.Files = map[string]string{}
		for key, member := range field.members {
			if member.kind == jsonString {
				marker.Files[key] = member.str
			}
		}
		marker.order = jsPropertyOrder(field.keys)
	}
	return marker, true
}

// markerFileNames returns the file names the marker records.
func markerFileNames(marker *cacheMarker) []string {
	if marker == nil || marker.Files == nil {
		return nil
	}
	names := make([]string, 0, len(marker.Files))
	for name := range marker.Files {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// isValidCachedBundle reports whether the cache holds the bundle the manifest
// describes, and returns the directory it lives in.
func isValidCachedBundle(cacheDir string, manifest Manifest) (string, bool) {
	if manifest.SHA256 == "" {
		return "", false
	}

	versionDir, err := ResolveInside(cacheDir, manifest.Version)
	if err != nil {
		return "", false
	}

	marker, ok := readCacheMarker(versionDir)
	if !ok || marker.SHA256 != manifest.SHA256 || marker.Files == nil {
		return "", false
	}

	templatesDir := filepath.Join(versionDir, templatesDirName)
	info, err := os.Stat(templatesDir)
	if err != nil || !info.IsDir() {
		return "", false
	}

	expected := markerFileNames(marker)
	actual, err := listRelativeFiles(templatesDir)
	if err != nil {
		return "", false
	}
	sort.Strings(actual)

	if len(actual) != len(expected) {
		return "", false
	}
	for index, file := range expected {
		if actual[index] != file {
			return "", false
		}
	}

	for _, file := range expected {
		path, err := ResolveInside(templatesDir, file)
		if err != nil {
			return "", false
		}
		digest, err := hashFile(path)
		if err != nil {
			return "", false
		}
		if digest != marker.Files[file] {
			return "", false
		}
	}

	return templatesDir, true
}

// listRelativeFiles lists the files of a directory, relative to it.
func listRelativeFiles(root string) ([]string, error) {
	files := []string{}
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		files = append(files, filepath.ToSlash(relative))
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

// hashFile returns the digest of a file.
func hashFile(path string) (string, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return sha256Hex(contents), nil
}

// sha256Hex returns the hex digest of a payload.
func sha256Hex(payload []byte) string {
	digest := sha256.Sum256(payload)
	return hex.EncodeToString(digest[:])
}

// extractBundleToCache writes a bundle to the cache and returns the
// directory it lives in.
func extractBundleToCache(cacheDir string, bundle Bundle, entries []BundleEntry, digest string, now func() time.Time) (string, error) {
	versionDir, err := ResolveInside(cacheDir, bundle.Version)
	if err != nil {
		return "", err
	}
	templatesDir := filepath.Join(versionDir, templatesDirName)

	if cached, ok := isValidCachedBundle(cacheDir, Manifest{Version: bundle.Version, SHA256: digest}); ok {
		return cached, nil
	}

	if err := os.MkdirAll(cacheDir, 0o755); err != nil {
		return "", err
	}

	tempDir, err := os.MkdirTemp(cacheDir, ".tmp-")
	if err != nil {
		return "", err
	}
	pending := true
	defer func() {
		if pending {
			_ = os.RemoveAll(tempDir)
		}
	}()

	tempTemplatesDir := filepath.Join(tempDir, templatesDirName)
	if err := os.MkdirAll(tempTemplatesDir, 0o755); err != nil {
		return "", err
	}

	digests := map[string]string{}
	order := make([]string, 0, len(entries))
	for _, entry := range entries {
		destination, err := ResolveInside(tempTemplatesDir, entry.Path)
		if err != nil {
			return "", err
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return "", err
		}
		if err := os.WriteFile(destination, []byte(entry.Contents), 0o644); err != nil {
			return "", err
		}
		digests[entry.Path] = sha256Hex([]byte(entry.Contents))
		order = append(order, entry.Path)
	}

	marker := cacheMarker{
		SHA256:      digest,
		Version:     bundle.Version,
		ExtractedAt: isoTimestamp(now),
		Files:       digests,
		order:       order,
	}
	payload, err := json.MarshalIndent(marker, "", "  ")
	if err != nil {
		return "", err
	}
	// The cache marker is written with a trailing newline, the way the
	// previous release wrote it.
	payload = append(payload, '\n')
	if err := os.WriteFile(filepath.Join(tempDir, markerFileName), payload, 0o644); err != nil {
		return "", err
	}

	if err := os.RemoveAll(versionDir); err != nil {
		return "", err
	}
	if err := os.Rename(tempDir, versionDir); err != nil {
		return "", err
	}
	pending = false

	pruneCache(cacheDir, versionDir)

	return templatesDir, nil
}

// pruneCache removes the bundle versions the cache no longer keeps.
func pruneCache(cacheDir, keepVersionDir string) {
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return
	}

	keep := filepath.Base(keepVersionDir)
	type candidate struct {
		dir      string
		modified time.Time
	}
	candidates := []candidate{}

	for _, entry := range entries {
		if entry.Name() == keep || strings.HasPrefix(entry.Name(), ".tmp-") {
			continue
		}
		dir := filepath.Join(cacheDir, entry.Name())
		if _, ok := readCacheMarker(dir); !ok {
			continue
		}
		info, err := os.Stat(dir)
		if err != nil {
			continue
		}
		candidates = append(candidates, candidate{dir: dir, modified: info.ModTime()})
	}

	// The versions are ordered by age, and a version of the same age is
	// ordered by name, so the retention does not depend on the order the
	// cache directory is read in.
	sort.SliceStable(candidates, func(left, right int) bool {
		if !candidates[left].modified.Equal(candidates[right].modified) {
			return candidates[left].modified.After(candidates[right].modified)
		}
		return filepath.Base(candidates[left].dir) > filepath.Base(candidates[right].dir)
	})

	if len(candidates) <= cacheRetention-1 {
		return
	}
	for _, stale := range candidates[cacheRetention-1:] {
		_ = os.RemoveAll(stale.dir)
	}
}

// isoTimestamp renders a time the way the previous release rendered the
// extraction time of a cache marker.
func isoTimestamp(now func() time.Time) string {
	if now == nil {
		now = time.Now
	}
	return now().UTC().Format("2006-01-02T15:04:05.000Z")
}

// firstNonEmpty returns the first value that is not empty.
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
