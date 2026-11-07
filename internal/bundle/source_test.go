package bundle

import (
	"context"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// plannerFiles are the files the planner skill needs.
var plannerFiles = map[string]string{
	"universal/skills/spec-driven-planner/SKILL.md":                       "Planner skill",
	"universal/skills/spec-driven-planner/references/lane-selection.md":   "Lane selection",
	"universal/skills/spec-driven-planner/references/full-lane-phases.md": "Full phases",
}

// plannerFileOrder is the order the planner files are published in.
var plannerFileOrder = []string{
	"universal/skills/spec-driven-planner/SKILL.md",
	"universal/skills/spec-driven-planner/references/lane-selection.md",
	"universal/skills/spec-driven-planner/references/full-lane-phases.md",
}

// bundleDocument renders a bundle document the way the manifest digest is
// computed over it.
func bundleDocument(version string, files []string, contents map[string]string) []byte {
	var builder strings.Builder
	builder.WriteString(`{"schemaVersion":1,"version":`)
	encoded, _ := json.Marshal(version)
	builder.Write(encoded)
	builder.WriteString(`,"files":{`)
	for index, file := range files {
		if index > 0 {
			builder.WriteString(",")
		}
		name, _ := json.Marshal(file)
		body, _ := json.Marshal(contents[file])
		builder.Write(name)
		builder.WriteString(":")
		builder.Write(body)
	}
	builder.WriteString("}}")
	return []byte(builder.String())
}

// manifestDocument renders a manifest document for a bundle.
func manifestDocument(version, bundleURL, digest string, overrides map[string]any) []byte {
	document := map[string]any{
		"schemaVersion": 1,
		"version":       version,
		"bundleUrl":     bundleURL,
		"sha256":        digest,
	}
	for key, value := range overrides {
		if value == nil {
			delete(document, key)
			continue
		}
		document[key] = value
	}
	encoded, err := json.Marshal(document)
	if err != nil {
		panic(err)
	}
	return encoded
}

// fetchStub answers the manifest and the bundle requests.
type fetchStub struct {
	manifest []byte
	bundle   []byte
	err      error
	urls     []string
}

// fetch records the requests and answers them.
func (f *fetchStub) fetch(_ context.Context, url string) (int, []byte, error) {
	f.urls = append(f.urls, url)
	if f.err != nil {
		return 0, nil, f.err
	}
	switch {
	case strings.HasSuffix(url, "/templates-manifest.json"):
		return 200, f.manifest, nil
	case strings.HasSuffix(url, "/templates-bundle.json"):
		return 200, f.bundle, nil
	}
	return 404, nil, nil
}

// resolveFixture resolves a source against a temporary cache.
func resolveFixture(t *testing.T, root string, options ResolveOptions) Source {
	t.Helper()

	options.CacheDir = filepath.Join(root, "cache")
	options.ManifestURL = "https://example.test/templates-manifest.json"
	if options.CLIVersion == "" {
		options.CLIVersion = "1.0.0"
	}
	if options.Now == nil {
		options.Now = func() time.Time { return time.Unix(0, 0).UTC() }
	}

	source, err := Resolve(context.Background(), options)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	return source
}

// defaultBundle is the bundle the fixture serves.
func defaultBundle() ([]byte, []byte) {
	files := []string{"universal/agents/spec-driven.agent.md"}
	contents := map[string]string{
		"universal/agents/spec-driven.agent.md": "---\nname: Spec-Driven\n---\n\nAgent",
	}
	bundle := bundleDocument("v1", files, contents)
	manifest := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(bundle), nil)
	return manifest, bundle
}

func TestResolveDownloadsVerifiesAndExtracts(t *testing.T) {
	root := t.TempDir()
	manifest, bundle := defaultBundle()
	stub := &fetchStub{manifest: manifest, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceRemote {
		t.Fatalf("source = %q, want remote", result.Source)
	}
	if result.Version != "v1" {
		t.Fatalf("version = %q, want v1", result.Version)
	}
	if result.SHA256 != sha256Hex(bundle) {
		t.Fatalf("sha256 = %q, want %q", result.SHA256, sha256Hex(bundle))
	}
	if _, err := os.Stat(filepath.Join(result.RootDir, "universal/agents/spec-driven.agent.md")); err != nil {
		t.Fatalf("extracted file: %v", err)
	}
	if len(stub.urls) != 2 {
		t.Fatalf("requests = %d, want 2", len(stub.urls))
	}
}

func TestResolveReusesTheCachedBundle(t *testing.T) {
	root := t.TempDir()
	manifest, bundle := defaultBundle()
	stub := &fetchStub{manifest: manifest, bundle: bundle}

	first := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})
	second := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if first.Source != SourceRemote || second.Source != SourceRemote {
		t.Fatalf("sources = %q and %q, want remote", first.Source, second.Source)
	}
	if first.RootDir != second.RootDir {
		t.Fatalf("root dirs = %q and %q, want the same", first.RootDir, second.RootDir)
	}
	if !contains(second.Warnings, "Using cached template bundle.") {
		t.Fatalf("warnings = %v, want the cache notice", second.Warnings)
	}
	if len(stub.urls) != 3 {
		t.Fatalf("requests = %d, want 3", len(stub.urls))
	}
}

func TestResolveRejectsBundleMissingRequiredPlannerFile(t *testing.T) {
	for _, missing := range plannerFileOrder {
		t.Run(missing, func(t *testing.T) {
			root := t.TempDir()
			files := []string{}
			contents := map[string]string{}
			for _, file := range plannerFileOrder {
				if file == missing {
					continue
				}
				files = append(files, file)
				contents[file] = plannerFiles[file]
			}
			bundle := bundleDocument("v1", files, contents)
			manifest := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(bundle), nil)
			stub := &fetchStub{manifest: manifest, bundle: bundle}

			result := resolveFixture(t, root, ResolveOptions{
				Fetch:          stub.fetch,
				Source:         SourceRemote,
				RequiredSkills: []string{"spec-driven-planner"},
			})

			if result.Source != SourceBundled {
				t.Fatalf("source = %q, want bundled", result.Source)
			}
			if result.ErrorKind != KindIncompatible {
				t.Fatalf("error kind = %q, want incompatible", result.ErrorKind)
			}
			if !strings.Contains(result.FallbackReason, missing) {
				t.Fatalf("fallback reason = %q, want it to name %q", result.FallbackReason, missing)
			}
		})
	}
}

func TestResolveUsesCompletePlannerFromNetworkAndCache(t *testing.T) {
	root := t.TempDir()
	bundle := bundleDocument("v1", plannerFileOrder, plannerFiles)
	manifest := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(bundle), nil)
	stub := &fetchStub{manifest: manifest, bundle: bundle}
	options := ResolveOptions{
		Fetch:          stub.fetch,
		Source:         SourceRemote,
		RequiredSkills: []string{"spec-driven-planner"},
	}

	first := resolveFixture(t, root, options)
	cached := resolveFixture(t, root, options)

	if first.Source != SourceRemote || cached.Source != SourceRemote {
		t.Fatalf("sources = %q and %q, want remote", first.Source, cached.Source)
	}
	if !contains(cached.Warnings, "Using cached template bundle.") {
		t.Fatalf("warnings = %v, want the cache notice", cached.Warnings)
	}
	if len(stub.urls) != 3 {
		t.Fatalf("requests = %d, want 3", len(stub.urls))
	}
}

func TestResolveRejectsIntactCacheLackingRequiredSkills(t *testing.T) {
	root := t.TempDir()
	manifest, bundle := defaultBundle()
	stub := &fetchStub{manifest: manifest, bundle: bundle}

	resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})
	result := resolveFixture(t, root, ResolveOptions{
		Fetch:          stub.fetch,
		Source:         SourceRemote,
		RequiredSkills: []string{"spec-driven-planner"},
	})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if result.ErrorKind != KindIncompatible {
		t.Fatalf("error kind = %q, want incompatible", result.ErrorKind)
	}
	if !strings.Contains(result.FallbackReason, "spec-driven-planner/SKILL.md") {
		t.Fatalf("fallback reason = %q, want it to name the planner", result.FallbackReason)
	}
	if len(stub.urls) != 3 {
		t.Fatalf("requests = %d, want 3", len(stub.urls))
	}
}

func TestResolveRestoresPlannerReferenceRemovedFromCache(t *testing.T) {
	root := t.TempDir()
	bundle := bundleDocument("v1", plannerFileOrder, plannerFiles)
	manifest := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(bundle), nil)
	stub := &fetchStub{manifest: manifest, bundle: bundle}
	options := ResolveOptions{
		Fetch:          stub.fetch,
		Source:         SourceRemote,
		RequiredSkills: []string{"spec-driven-planner"},
	}

	first := resolveFixture(t, root, options)
	file := filepath.Join(first.RootDir, "universal/skills/spec-driven-planner/references/lane-selection.md")
	if err := os.Remove(file); err != nil {
		t.Fatalf("remove: %v", err)
	}

	result := resolveFixture(t, root, options)
	if result.Source != SourceRemote {
		t.Fatalf("source = %q, want remote", result.Source)
	}
	restored, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(restored) != "Lane selection" {
		t.Fatalf("restored = %q, want the published content", string(restored))
	}
	if len(stub.urls) != 4 {
		t.Fatalf("requests = %d, want 4", len(stub.urls))
	}
}

func TestResolveRedownloadsModifiedCachedFiles(t *testing.T) {
	root := t.TempDir()
	manifest, bundle := defaultBundle()
	stub := &fetchStub{manifest: manifest, bundle: bundle}

	first := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})
	target := filepath.Join(first.RootDir, "universal/agents/spec-driven.agent.md")
	if err := os.WriteFile(target, []byte("tampered"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	second := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if second.Source != SourceRemote {
		t.Fatalf("source = %q, want remote", second.Source)
	}
	if contains(second.Warnings, "Using cached template bundle.") {
		t.Fatalf("warnings = %v, want no cache notice", second.Warnings)
	}
	restored, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !strings.Contains(string(restored), "Agent") {
		t.Fatalf("restored = %q, want the published content", string(restored))
	}
	if len(stub.urls) != 4 {
		t.Fatalf("requests = %d, want 4", len(stub.urls))
	}
}

func TestResolveRejectsPathTraversalVersion(t *testing.T) {
	root := t.TempDir()
	sentinel := filepath.Join(root, "sentinel.txt")
	if err := os.WriteFile(sentinel, []byte("keep me"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	_, bundle := defaultBundle()
	traversal := manifestDocument("..", "https://example.test/templates-bundle.json", sha256Hex(bundle), nil)
	stub := &fetchStub{manifest: traversal, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if result.ErrorKind != KindInvalid {
		t.Fatalf("error kind = %q, want invalid", result.ErrorKind)
	}
	if _, err := os.Stat(sentinel); err != nil {
		t.Fatalf("sentinel: %v", err)
	}
}

func TestResolveRejectsTraversalFilePath(t *testing.T) {
	root := t.TempDir()
	files := []string{"../../escape.txt"}
	bundle := bundleDocument("v1", files, map[string]string{"../../escape.txt": "x"})
	manifest := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(bundle), nil)
	stub := &fetchStub{manifest: manifest, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if result.ErrorKind != KindInvalid {
		t.Fatalf("error kind = %q, want invalid", result.ErrorKind)
	}
	if !strings.Contains(result.FallbackReason, "Invalid template path") {
		t.Fatalf("fallback reason = %q, want the path message", result.FallbackReason)
	}
}

func TestResolveRejectsAbsoluteAndDriveFilePaths(t *testing.T) {
	root := t.TempDir()

	absoluteFiles := []string{"/etc/passwd"}
	absoluteBundle := bundleDocument("v1", absoluteFiles, map[string]string{"/etc/passwd": "x"})
	absoluteManifest := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(absoluteBundle), nil)
	absolute := resolveFixture(t, root, ResolveOptions{
		Fetch:  (&fetchStub{manifest: absoluteManifest, bundle: absoluteBundle}).fetch,
		Source: SourceRemote,
	})
	if absolute.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", absolute.Source)
	}

	driveFiles := []string{`C:\Windows\system.ini`}
	driveBundle := bundleDocument("v1", driveFiles, map[string]string{`C:\Windows\system.ini`: "x"})
	driveManifest := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(driveBundle), nil)
	drive := resolveFixture(t, root, ResolveOptions{
		Fetch:  (&fetchStub{manifest: driveManifest, bundle: driveBundle}).fetch,
		Source: SourceRemote,
	})
	if drive.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", drive.Source)
	}
}

func TestResolveRejectsDigestMismatch(t *testing.T) {
	root := t.TempDir()
	_, bundle := defaultBundle()
	tampered := manifestDocument("v1", "https://example.test/templates-bundle.json", strings.Repeat("0", 64), nil)
	stub := &fetchStub{manifest: tampered, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if result.ErrorKind != KindIntegrity {
		t.Fatalf("error kind = %q, want integrity", result.ErrorKind)
	}
	if !strings.Contains(result.FallbackReason, "digest mismatch") {
		t.Fatalf("fallback reason = %q, want the digest message", result.FallbackReason)
	}
}

func TestResolveRejectsNonHTTPSBundleURL(t *testing.T) {
	root := t.TempDir()
	_, bundle := defaultBundle()
	insecure := manifestDocument("v1", "http://example.test/bundle.json", sha256Hex(bundle), nil)
	stub := &fetchStub{manifest: insecure, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if !strings.Contains(result.FallbackReason, "HTTPS") {
		t.Fatalf("fallback reason = %q, want the HTTPS message", result.FallbackReason)
	}
}

func TestResolveRejectsBundleURLOnUnapprovedHost(t *testing.T) {
	root := t.TempDir()
	_, bundle := defaultBundle()
	foreign := manifestDocument("v1", "https://evil.example/templates-bundle.json", sha256Hex(bundle), nil)
	stub := &fetchStub{manifest: foreign, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if !strings.Contains(result.FallbackReason, "not allowed") {
		t.Fatalf("fallback reason = %q, want the host message", result.FallbackReason)
	}
}

func TestResolveRejectsIncompatibleSchemaVersion(t *testing.T) {
	root := t.TempDir()
	_, bundle := defaultBundle()
	incompatible := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(bundle), map[string]any{
		"schemaVersion": 99,
	})
	stub := &fetchStub{manifest: incompatible, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if result.ErrorKind != KindIncompatible {
		t.Fatalf("error kind = %q, want incompatible", result.ErrorKind)
	}
}

func TestResolveRejectsBundleRequiringNewerCLI(t *testing.T) {
	root := t.TempDir()
	_, bundle := defaultBundle()
	newer := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(bundle), map[string]any{
		"minCliVersion": "99.0.0",
	})
	stub := &fetchStub{manifest: newer, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if result.ErrorKind != KindIncompatible {
		t.Fatalf("error kind = %q, want incompatible", result.ErrorKind)
	}
}

func TestResolveAcceptsLegacyManifestWithoutDigest(t *testing.T) {
	root := t.TempDir()
	_, bundle := defaultBundle()
	legacy := manifestDocument("v1", "https://example.test/templates-bundle.json", "", map[string]any{"sha256": nil})
	stub := &fetchStub{manifest: legacy, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceRemote {
		t.Fatalf("source = %q, want remote", result.Source)
	}
	if !strings.Contains(strings.Join(result.Warnings, " "), "no sha256 digest") {
		t.Fatalf("warnings = %v, want the integrity notice", result.Warnings)
	}
}

func TestResolveRejectsBundleWithTooManyFiles(t *testing.T) {
	root := t.TempDir()
	files := make([]string, 0, MaxFiles+1)
	contents := map[string]string{}
	for index := 0; index <= MaxFiles; index++ {
		file := "universal/file-" + strconv.Itoa(index) + ".md"
		files = append(files, file)
		contents[file] = "x"
	}
	bundle := bundleDocument("v1", files, contents)
	manifest := manifestDocument("v1", "https://example.test/templates-bundle.json", sha256Hex(bundle), nil)
	stub := &fetchStub{manifest: manifest, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if !strings.Contains(result.FallbackReason, "too many files") {
		t.Fatalf("fallback reason = %q, want the file count message", result.FallbackReason)
	}
}

func TestResolveFallsBackToBundledOnNetworkFailure(t *testing.T) {
	root := t.TempDir()
	stub := &fetchStub{err: errOffline{}}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", result.Source)
	}
	if result.ErrorKind != KindNetwork {
		t.Fatalf("error kind = %q, want network", result.ErrorKind)
	}
	if !strings.Contains(result.FallbackReason, "offline") {
		t.Fatalf("fallback reason = %q, want the network message", result.FallbackReason)
	}
}

func TestResolveHonorsLegacyBundledEnvironmentVariable(t *testing.T) {
	t.Setenv("SPEC_DRIVEN_USE_BUNDLED_TEMPLATES", "true")

	source, err := Resolve(context.Background(), ResolveOptions{})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if source.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", source.Source)
	}
}

func TestResolveBundledSourceExposesTheEmbeddedTree(t *testing.T) {
	source, err := Resolve(context.Background(), ResolveOptions{Source: SourceBundled})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if source.Source != SourceBundled {
		t.Fatalf("source = %q, want bundled", source.Source)
	}
	if source.Version != "bundled" {
		t.Fatalf("version = %q, want bundled", source.Version)
	}
	if source.FallbackReason != "SDS_TEMPLATE_SOURCE is set to bundled" {
		t.Fatalf("fallback reason = %q, want the bundled notice", source.FallbackReason)
	}
	if source.FS == nil {
		t.Fatal("fs = nil, want the embedded tree")
	}
	if _, err := fs.ReadFile(source.FS, "universal/skills/spec-driven-planner/SKILL.md"); err != nil {
		t.Fatalf("read planner: %v", err)
	}
}

func TestResolveRemoteSourceExposesTheExtractedTree(t *testing.T) {
	root := t.TempDir()
	manifest, bundle := defaultBundle()
	stub := &fetchStub{manifest: manifest, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	if result.FS == nil {
		t.Fatal("fs = nil, want the extracted tree")
	}
	if _, err := fs.ReadFile(result.FS, "universal/agents/spec-driven.agent.md"); err != nil {
		t.Fatalf("read agent: %v", err)
	}
}

// errOffline is the failure of a request that cannot reach the network.
type errOffline struct{}

func (errOffline) Error() string { return "offline" }

// contains reports whether a list holds a value.
func contains(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}
