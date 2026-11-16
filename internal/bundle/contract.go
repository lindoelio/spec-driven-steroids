// Package bundle resolves the canonical artifact tree, either from the tree
// embedded in the binary or from a remote template bundle published as a
// release asset.
//
// The remote path is a security boundary: HTTPS only, an allowed-host list,
// schema and version compatibility checks, a minimum CLI version gate, path
// containment during extraction, file-count and size limits, digest
// verification and cache revalidation. The contract is unchanged from the
// previous release, so a bundle published before the port resolves without
// falling back to the embedded tree.
//
// Both sources expose the same tree under the same keys: the canonical
// artifacts live in "universal/skills", "universal/agents" and
// "universal/commands". The embedded tree carries no "universal" directory
// of its own, so the bundled source exposes it under that prefix, and a
// remote bundle is extracted to the cache with the same layout.
//
// Callers read the tree through Source.FS, which is set for both sources.
// The remote source also reports the directory it was extracted to in
// Source.RootDir; the bundled source has no directory on disk.
package bundle

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// The error kinds the contract reports. They select the fallback reason the
// CLI shows when the remote bundle cannot be used.
const (
	// KindInvalid marks a malformed or unacceptable payload.
	KindInvalid = "invalid"
	// KindIntegrity marks a payload that failed digest verification.
	KindIntegrity = "integrity"
	// KindIncompatible marks a payload this CLI cannot use.
	KindIncompatible = "incompatible"
	// KindNetwork marks a failed request.
	KindNetwork = "network"
)

// The contract limits and patterns.
const (
	// SchemaVersion is the bundle schema this CLI understands.
	SchemaVersion = 1
	// MaxFiles is the largest number of files a bundle may carry.
	MaxFiles = 2000
	// MaxBundleBytes is the largest total size of the file contents.
	MaxBundleBytes = 5 * 1024 * 1024
	// MaxJSONBytes is the largest size of a JSON document read from the network.
	MaxJSONBytes = 8 * 1024 * 1024
	// VersionPattern constrains a bundle version.
	VersionPattern = `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`
	// DigestPattern constrains a SHA-256 digest.
	DigestPattern = `^[a-f0-9]{64}$`
	// SemverPattern constrains a semantic version.
	SemverPattern = `^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$`
)

// The release pipeline stamps DefaultManifestURL per channel, so the stable
// CLI keeps resolving templates-latest while the native preview resolves
// templates-next.
var (
	// DefaultManifestURL is the manifest the remote source reads.
	DefaultManifestURL = "https://github.com/lindoelio/spec-driven-steroids/releases/download/templates-latest/templates-manifest.json"
)

var (
	versionPattern = regexp.MustCompile(VersionPattern)
	digestPattern  = regexp.MustCompile(DigestPattern)
	semverPattern  = regexp.MustCompile(SemverPattern)
)

// Error is a contract failure. Kind selects the fallback reason the CLI
// reports; Message is the text the previous release reported.
type Error struct {
	// Kind is one of the contract error kinds.
	Kind string
	// Message describes the failure.
	Message string
}

// Error returns the failure message.
func (e *Error) Error() string { return e.Message }

func invalidf(format string, args ...any) *Error {
	return &Error{Kind: KindInvalid, Message: fmt.Sprintf(format, args...)}
}

// Manifest describes a published template bundle.
type Manifest struct {
	SchemaVersion int    `json:"schemaVersion,omitempty"`
	Version       string `json:"version"`
	BundleURL     string `json:"bundleUrl"`
	SHA256        string `json:"sha256,omitempty"`
	MinCLIVersion string `json:"minCliVersion,omitempty"`
	PublishedAt   string `json:"publishedAt,omitempty"`

	// schemaVersionSet records that the payload carried a schema version.
	// The field is absent in older manifests, and an absent version is
	// accepted while an unsupported one is not.
	schemaVersionSet bool
}

// HasSchemaVersion reports whether the manifest carried a schema version.
func (m Manifest) HasSchemaVersion() bool { return m.schemaVersionSet }

// Bundle describes the contents of a template bundle.
type Bundle struct {
	SchemaVersion int               `json:"schemaVersion,omitempty"`
	Version       string            `json:"version"`
	Files         map[string]string `json:"files"`

	// schemaVersionSet records that the payload carried a schema version.
	schemaVersionSet bool
}

// HasSchemaVersion reports whether the bundle carried a schema version.
func (b Bundle) HasSchemaVersion() bool { return b.schemaVersionSet }

// BundleEntry is one file of a bundle, with its normalized path.
type BundleEntry struct {
	// Path is the normalized, relative path of the file.
	Path string
	// Contents is the file content.
	Contents string
}

// ParseManifest parses and validates a template manifest.
//
// A malformed manifest fails with an Error of kind KindInvalid.
func ParseManifest(raw []byte) (Manifest, error) {
	value, err := decodeJSONDocument(raw)
	if err != nil {
		return Manifest{}, invalidf("Template manifest is not valid JSON: %s", nodeJSONError(string(raw)))
	}
	return parseManifestValue(value)
}

func parseManifestValue(value *jsonValue) (Manifest, error) {
	if value.kind != jsonObject {
		return Manifest{}, invalidf("Template manifest must be a JSON object")
	}

	versionValue, _ := value.member("version")
	version, err := assertTemplateVersion(versionValue)
	if err != nil {
		return Manifest{}, err
	}

	bundleURLValue, ok := value.member("bundleUrl")
	if !ok || bundleURLValue.kind != jsonString || bundleURLValue.str == "" {
		return Manifest{}, invalidf("Template manifest is missing bundleUrl")
	}

	bundleURL, ok := parseTemplateURL(bundleURLValue.str)
	if !ok {
		return Manifest{}, invalidf("Template manifest bundleUrl is not a valid URL: %s", bundleURLValue.str)
	}
	if bundleURL.Scheme != "https" {
		return Manifest{}, invalidf("Template manifest bundleUrl must use HTTPS")
	}

	manifest := Manifest{
		Version:   version,
		BundleURL: bundleURL.String(),
	}

	if schemaVersion, ok := value.member("schemaVersion"); ok {
		if schemaVersion.kind != jsonNumber {
			return Manifest{}, invalidf("Template manifest schemaVersion must be a number")
		}
		manifest.SchemaVersion = int(schemaVersion.number)
		manifest.schemaVersionSet = true
	}

	if digest, ok := value.member("sha256"); ok {
		if digest.kind != jsonString || !digestPattern.MatchString(digest.str) {
			return Manifest{}, invalidf("Template manifest sha256 must be 64 lowercase hex characters")
		}
		manifest.SHA256 = digest.str
	}

	if minCLI, ok := value.member("minCliVersion"); ok {
		if minCLI.kind != jsonString || !semverPattern.MatchString(minCLI.str) {
			return Manifest{}, invalidf("Template manifest minCliVersion must be a valid semantic version")
		}
		manifest.MinCLIVersion = minCLI.str
	}

	if publishedAt, ok := value.member("publishedAt"); ok {
		if publishedAt.kind != jsonString {
			return Manifest{}, invalidf("Template manifest publishedAt must be a string")
		}
		manifest.PublishedAt = publishedAt.str
	}

	return manifest, nil
}

// ParseBundle parses and validates a template bundle.
//
// It returns the bundle, its entries in publication order and the total size
// of the file contents. A malformed bundle fails with an Error of kind
// KindInvalid.
func ParseBundle(raw []byte) (Bundle, []BundleEntry, int, error) {
	value, err := decodeJSONDocument(raw)
	if err != nil {
		return Bundle{}, nil, 0, invalidf("Template bundle is not valid JSON: %s", nodeJSONError(string(raw)))
	}
	return parseBundleValue(value)
}

func parseBundleValue(value *jsonValue) (Bundle, []BundleEntry, int, error) {
	if value.kind != jsonObject {
		return Bundle{}, nil, 0, invalidf("Template bundle must be a JSON object")
	}

	versionValue, _ := value.member("version")
	version, err := assertTemplateVersion(versionValue)
	if err != nil {
		return Bundle{}, nil, 0, err
	}

	bundle := Bundle{Version: version}
	if schemaVersion, ok := value.member("schemaVersion"); ok {
		if schemaVersion.kind != jsonNumber {
			return Bundle{}, nil, 0, invalidf("Template bundle schemaVersion must be a number")
		}
		bundle.SchemaVersion = int(schemaVersion.number)
		bundle.schemaVersionSet = true
	}

	files, ok := value.member("files")
	if !ok || files.kind != jsonObject {
		return Bundle{}, nil, 0, invalidf("Template bundle files must be a JSON object")
	}

	paths := jsPropertyOrder(files.keys)
	if len(paths) == 0 {
		return Bundle{}, nil, 0, invalidf("Template bundle does not contain any files")
	}
	if len(paths) > MaxFiles {
		return Bundle{}, nil, 0, invalidf("Template bundle contains too many files (%d > %d)", len(paths), MaxFiles)
	}

	entries := make([]BundleEntry, 0, len(paths))
	contents := make(map[string]string, len(paths))
	seen := make(map[string]bool, len(paths))
	byteSize := 0

	for _, path := range paths {
		contentsValue := files.members[path]
		if contentsValue.kind != jsonString {
			return Bundle{}, nil, 0, invalidf("Template file contents must be a string: %s", path)
		}

		safePath, err := NormalizeRelativePath(path)
		if err != nil {
			return Bundle{}, nil, 0, err
		}
		if seen[safePath] {
			return Bundle{}, nil, 0, invalidf("Template bundle contains a duplicate path: %s", safePath)
		}
		seen[safePath] = true

		byteSize += len(contentsValue.str)
		if byteSize > MaxBundleBytes {
			return Bundle{}, nil, 0, invalidf("Template bundle exceeds maximum size of %d bytes", MaxBundleBytes)
		}

		entries = append(entries, BundleEntry{Path: safePath, Contents: contentsValue.str})
		contents[safePath] = contentsValue.str
	}

	bundle.Files = contents
	return bundle, entries, byteSize, nil
}

// assertTemplateVersion validates a bundle version.
//
// The value is reported the way the previous release reported it, so a
// payload that carries a version of the wrong type produces the same text.
func assertTemplateVersion(value *jsonValue) (string, error) {
	if value == nil || value.kind != jsonString || !versionPattern.MatchString(value.str) {
		return "", invalidf("Invalid template version: %s. Versions may contain only letters, digits, dot, underscore, and hyphen.", jsString(value))
	}
	return value.str, nil
}

// NormalizeRelativePath normalizes a bundle file path and rejects any path
// that escapes the bundle root.
//
// A rejected path fails with an Error of kind KindInvalid.
func NormalizeRelativePath(p string) (string, error) {
	if p == "" {
		return "", invalidf("Template file path must be a non-empty string")
	}

	normalized := strings.ReplaceAll(p, `\`, "/")

	if strings.Contains(normalized, "\x00") {
		return "", invalidf("Invalid template path: %s", p)
	}
	if strings.HasPrefix(normalized, "/") || windowsDrivePath.MatchString(normalized) {
		return "", invalidf("Template path must be relative: %s", p)
	}

	segments := strings.Split(normalized, "/")
	for _, segment := range segments {
		if segment == "" || segment == "." || segment == ".." {
			return "", invalidf("Invalid template path segment in: %s", p)
		}
	}

	return strings.Join(segments, "/"), nil
}

var windowsDrivePath = regexp.MustCompile(`^[A-Za-z]:/`)

// ResolveInside joins a relative path onto a root and rejects any path that
// escapes it.
//
// A rejected path fails with an Error of kind KindInvalid.
func ResolveInside(root, relative string) (string, error) {
	resolvedRoot, err := absolutePath(root)
	if err != nil {
		return "", invalidf("Path escapes template root: %s", relative)
	}
	candidate := resolvePath(resolvedRoot, relative)

	escaped, err := relativePath(resolvedRoot, candidate)
	if err != nil || strings.HasPrefix(escaped, "..") || filepathIsAbs(escaped) {
		return "", invalidf("Path escapes template root: %s", relative)
	}
	return candidate, nil
}

// CompareSemver compares two semantic versions.
//
// It returns -1 when left is older, 1 when left is newer and 0 when both
// versions are equivalent. A prerelease identifier is older than the release
// it belongs to.
func CompareSemver(left, right string) int {
	leftCore, leftPre := splitPrerelease(left)
	rightCore, rightPre := splitPrerelease(right)

	leftParts := strings.Split(leftCore, ".")
	rightParts := strings.Split(rightCore, ".")

	for index := 0; index < 3; index++ {
		leftValue := 0.0
		if index < len(leftParts) {
			leftValue = jsNumber(leftParts[index])
		}
		rightValue := 0.0
		if index < len(rightParts) {
			rightValue = jsNumber(rightParts[index])
		}
		if leftValue != rightValue {
			if leftValue > rightValue {
				return 1
			}
			return -1
		}
	}

	if leftPre == "" && rightPre != "" {
		return 1
	}
	if leftPre != "" && rightPre == "" {
		return -1
	}
	if leftPre == "" && rightPre == "" {
		return 0
	}
	return localeCompare(leftPre, rightPre)
}

// splitPrerelease splits a version into its core and its prerelease part.
func splitPrerelease(version string) (string, string) {
	if index := strings.Index(version, "-"); index >= 0 {
		return version[:index], version[index+1:]
	}
	return version, ""
}

// AssertCompatibleSchema rejects a schema version this CLI cannot read.
//
// A schema version of zero means the payload carried no schema version, which
// the contract accepts.
func AssertCompatibleSchema(schemaVersion int, label string) error {
	if schemaVersion != 0 && schemaVersion != SchemaVersion {
		return &Error{
			Kind:    KindIncompatible,
			Message: fmt.Sprintf("%s schema version %d is not supported by this CLI (expected %d)", label, schemaVersion, SchemaVersion),
		}
	}
	return nil
}

// assertCompatibleSchema rejects a schema version this CLI cannot read,
// distinguishing an absent schema version from an unsupported one.
//
// A payload that carries the schema version zero is unsupported, even though
// the exported helper reads a zero as an absent version.
func assertCompatibleSchema(schemaVersion *int, label string) error {
	if schemaVersion == nil {
		return nil
	}
	if *schemaVersion == SchemaVersion {
		return nil
	}
	return &Error{
		Kind:    KindIncompatible,
		Message: fmt.Sprintf("%s schema version %d is not supported by this CLI (expected %d)", label, *schemaVersion, SchemaVersion),
	}
}

// IsAllowedHost reports whether a bundle may be downloaded from a host.
//
// The manifest host, github.com and the release asset hosts are always
// allowed. SDS_TEMPLATE_ALLOWED_HOSTS adds hosts to the list.
func IsAllowedHost(hostname, manifestHost string) bool {
	normalized := strings.ToLower(hostname)
	allowedManifestHost := strings.ToLower(manifestHost)

	if normalized == allowedManifestHost {
		return true
	}
	if normalized == "github.com" {
		return true
	}
	if strings.HasSuffix(normalized, ".githubusercontent.com") {
		return true
	}

	for _, host := range configuredAllowedHosts() {
		if host == normalized {
			return true
		}
	}
	return false
}

// isAllowedHost reports whether a bundle may be downloaded from a host,
// using an explicit list when one is given.
func isAllowedHost(hostname, manifestHost string, allowed []string) bool {
	if allowed == nil {
		return IsAllowedHost(hostname, manifestHost)
	}

	normalized := strings.ToLower(hostname)
	allowedManifestHost := strings.ToLower(manifestHost)

	if normalized == allowedManifestHost {
		return true
	}
	if normalized == "github.com" {
		return true
	}
	if strings.HasSuffix(normalized, ".githubusercontent.com") {
		return true
	}
	for _, host := range allowed {
		if strings.ToLower(strings.TrimSpace(host)) == normalized {
			return true
		}
	}
	return false
}

// configuredAllowedHosts reads the host allow list from the environment.
func configuredAllowedHosts() []string {
	raw := os.Getenv("SDS_TEMPLATE_ALLOWED_HOSTS")
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	hosts := make([]string, 0, len(parts))
	for _, part := range parts {
		host := strings.ToLower(strings.TrimSpace(part))
		if host != "" {
			hosts = append(hosts, host)
		}
	}
	return hosts
}

// jsonKind classifies a decoded JSON value.
type jsonKind uint8

const (
	jsonObject jsonKind = iota
	jsonArray
	jsonString
	jsonNumber
	jsonBool
	jsonNull
)

// jsonValue is a decoded JSON value that keeps the key order of an object
// and the presence of its members, which the contract depends on.
type jsonValue struct {
	kind    jsonKind
	str     string
	number  float64
	boolean bool
	array   []*jsonValue
	keys    []string
	members map[string]*jsonValue
}

// member returns a member of an object value.
func (v *jsonValue) member(key string) (*jsonValue, bool) {
	if v == nil || v.kind != jsonObject {
		return nil, false
	}
	value, ok := v.members[key]
	return value, ok
}

// decodeJSONDocument decodes a JSON document into an ordered value.
func decodeJSONDocument(raw []byte) (*jsonValue, error) {
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.UseNumber()

	value, err := decodeJSONValue(decoder)
	if err != nil {
		return nil, err
	}
	// A document holds exactly one value. Trailing content is a malformed
	// document, not a document with a second value.
	if _, err := decoder.Token(); err != io.EOF {
		if err == nil {
			return nil, fmt.Errorf("unexpected content after the JSON document")
		}
		return nil, err
	}
	return value, nil
}

// decodeJSONValue decodes the next value of a JSON document.
func decodeJSONValue(decoder *json.Decoder) (*jsonValue, error) {
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	return decodeJSONToken(decoder, token)
}

// decodeJSONToken decodes a value that starts with the given token.
func decodeJSONToken(decoder *json.Decoder, token json.Token) (*jsonValue, error) {
	switch typed := token.(type) {
	case json.Delim:
		switch typed {
		case '{':
			value := &jsonValue{kind: jsonObject, members: map[string]*jsonValue{}}
			for decoder.More() {
				keyToken, err := decoder.Token()
				if err != nil {
					return nil, err
				}
				key, ok := keyToken.(string)
				if !ok {
					return nil, fmt.Errorf("bundle: invalid object key")
				}
				member, err := decodeJSONValue(decoder)
				if err != nil {
					return nil, err
				}
				if _, exists := value.members[key]; !exists {
					value.keys = append(value.keys, key)
				}
				value.members[key] = member
			}
			if _, err := decoder.Token(); err != nil {
				return nil, err
			}
			return value, nil
		case '[':
			value := &jsonValue{kind: jsonArray}
			for decoder.More() {
				item, err := decodeJSONValue(decoder)
				if err != nil {
					return nil, err
				}
				value.array = append(value.array, item)
			}
			if _, err := decoder.Token(); err != nil {
				return nil, err
			}
			return value, nil
		}
		return nil, fmt.Errorf("bundle: unexpected delimiter %v", typed)
	case string:
		return &jsonValue{kind: jsonString, str: typed}, nil
	case json.Number:
		number, err := typed.Float64()
		if err != nil {
			return nil, err
		}
		return &jsonValue{kind: jsonNumber, number: number}, nil
	case bool:
		return &jsonValue{kind: jsonBool, boolean: typed}, nil
	case nil:
		return &jsonValue{kind: jsonNull}, nil
	}
	return nil, fmt.Errorf("bundle: unsupported JSON token")
}

// jsPropertyOrder orders object keys the way the previous release read
// them: keys that look like an array index come first, in numeric order, and
// the remaining keys keep their order of appearance.
func jsPropertyOrder(keys []string) []string {
	indexed := make([]string, 0, len(keys))
	rest := make([]string, 0, len(keys))
	for _, key := range keys {
		if value, ok := arrayIndex(key); ok {
			_ = value
			indexed = append(indexed, key)
			continue
		}
		rest = append(rest, key)
	}
	sort.SliceStable(indexed, func(left, right int) bool {
		leftValue, _ := arrayIndex(indexed[left])
		rightValue, _ := arrayIndex(indexed[right])
		return leftValue < rightValue
	})
	return append(indexed, rest...)
}

// arrayIndex reports the numeric value of a key that the previous release
// would have ordered with the array indices of an object.
func arrayIndex(key string) (uint64, bool) {
	if key == "" || len(key) > 10 {
		return 0, false
	}
	for _, character := range key {
		if character < '0' || character > '9' {
			return 0, false
		}
	}
	if len(key) > 1 && key[0] == '0' {
		return 0, false
	}
	value, err := strconv.ParseUint(key, 10, 64)
	if err != nil || value >= 4294967295 {
		return 0, false
	}
	return value, true
}

// jsString renders a JSON value the way the previous release rendered it in
// an error message.
func jsString(value *jsonValue) string {
	if value == nil {
		return "undefined"
	}
	switch value.kind {
	case jsonString:
		return value.str
	case jsonNumber:
		return jsNumberToString(value.number)
	case jsonBool:
		if value.boolean {
			return "true"
		}
		return "false"
	case jsonNull:
		return "null"
	case jsonObject:
		return "[object Object]"
	case jsonArray:
		parts := make([]string, 0, len(value.array))
		for _, item := range value.array {
			if item.kind == jsonNull {
				parts = append(parts, "")
				continue
			}
			parts = append(parts, jsString(item))
		}
		return strings.Join(parts, ",")
	}
	return "undefined"
}
