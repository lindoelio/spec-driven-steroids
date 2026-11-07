package bundle

import (
	"strconv"
	"strings"
	"testing"
)

func TestParseManifestAcceptsAValidManifest(t *testing.T) {
	manifest, err := ParseManifest([]byte(`{
		"schemaVersion": 1,
		"version": "v1.2.3",
		"bundleUrl": "https://example.test/templates-bundle.json",
		"sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		"minCliVersion": "1.0.0",
		"publishedAt": "2024-05-05T12:00:00.000Z"
	}`))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if manifest.SchemaVersion != SchemaVersion {
		t.Fatalf("schema version = %d, want %d", manifest.SchemaVersion, SchemaVersion)
	}
	if manifest.Version != "v1.2.3" {
		t.Fatalf("version = %q, want v1.2.3", manifest.Version)
	}
	if manifest.BundleURL != "https://example.test/templates-bundle.json" {
		t.Fatalf("bundle url = %q", manifest.BundleURL)
	}
	if manifest.MinCLIVersion != "1.0.0" {
		t.Fatalf("min cli version = %q, want 1.0.0", manifest.MinCLIVersion)
	}
	if manifest.PublishedAt != "2024-05-05T12:00:00.000Z" {
		t.Fatalf("published at = %q", manifest.PublishedAt)
	}
	if !manifest.HasSchemaVersion() {
		t.Fatal("schema version set = false, want true")
	}
}

func TestParseManifestRejectsInvalidManifests(t *testing.T) {
	cases := []struct {
		name    string
		payload string
		kind    string
		message string
	}{
		{
			name:    "missing bundle url",
			payload: `{"version":"v1"}`,
			kind:    KindInvalid,
			message: "Template manifest is missing bundleUrl",
		},
		{
			name:    "empty bundle url",
			payload: `{"version":"v1","bundleUrl":""}`,
			kind:    KindInvalid,
			message: "Template manifest is missing bundleUrl",
		},
		{
			name:    "bundle url that is not a url",
			payload: `{"version":"v1","bundleUrl":"not a url"}`,
			kind:    KindInvalid,
			message: "Template manifest bundleUrl is not a valid URL: not a url",
		},
		{
			name:    "bundle url that is not https",
			payload: `{"version":"v1","bundleUrl":"http://example.test/bundle.json"}`,
			kind:    KindInvalid,
			message: "Template manifest bundleUrl must use HTTPS",
		},
		{
			name:    "sha256 that is not a digest",
			payload: `{"version":"v1","bundleUrl":"https://example.test/bundle.json","sha256":"abc"}`,
			kind:    KindInvalid,
			message: "Template manifest sha256 must be 64 lowercase hex characters",
		},
		{
			name:    "sha256 that is not lowercase",
			payload: `{"version":"v1","bundleUrl":"https://example.test/bundle.json","sha256":"0123456789ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef"}`,
			kind:    KindInvalid,
			message: "Template manifest sha256 must be 64 lowercase hex characters",
		},
		{
			name:    "min cli version that is not a semantic version",
			payload: `{"version":"v1","bundleUrl":"https://example.test/bundle.json","minCliVersion":"1.0"}`,
			kind:    KindInvalid,
			message: "Template manifest minCliVersion must be a valid semantic version",
		},
		{
			name:    "schema version that is not a number",
			payload: `{"schemaVersion":"1","version":"v1","bundleUrl":"https://example.test/bundle.json"}`,
			kind:    KindInvalid,
			message: "Template manifest schemaVersion must be a number",
		},
		{
			name:    "published at that is not a string",
			payload: `{"version":"v1","bundleUrl":"https://example.test/bundle.json","publishedAt":42}`,
			kind:    KindInvalid,
			message: "Template manifest publishedAt must be a string",
		},
		{
			name:    "version that is missing",
			payload: `{"bundleUrl":"https://example.test/bundle.json"}`,
			kind:    KindInvalid,
			message: "Invalid template version: undefined. Versions may contain only letters, digits, dot, underscore, and hyphen.",
		},
		{
			name:    "version that is not a string",
			payload: `{"version":42,"bundleUrl":"https://example.test/bundle.json"}`,
			kind:    KindInvalid,
			message: "Invalid template version: 42. Versions may contain only letters, digits, dot, underscore, and hyphen.",
		},
		{
			name:    "version that is not allowed",
			payload: `{"version":"has space","bundleUrl":"https://example.test/bundle.json"}`,
			kind:    KindInvalid,
			message: "Invalid template version: has space. Versions may contain only letters, digits, dot, underscore, and hyphen.",
		},
		{
			name:    "manifest that is not an object",
			payload: `[]`,
			kind:    KindInvalid,
			message: "Template manifest must be a JSON object",
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := ParseManifest([]byte(testCase.payload))
			assertContractError(t, err, testCase.kind, testCase.message)
		})
	}
}

func TestParseManifestNormalizesTheBundleURL(t *testing.T) {
	manifest, err := ParseManifest([]byte(`{"version":"v1","bundleUrl":"HTTPS://Example.Test/bundle.json"}`))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if manifest.BundleURL != "https://example.test/bundle.json" {
		t.Fatalf("bundle url = %q, want the normalized url", manifest.BundleURL)
	}
}

func TestParseBundleAcceptsAValidBundle(t *testing.T) {
	bundle, entries, byteSize, err := ParseBundle([]byte(`{
		"schemaVersion": 1,
		"version": "v1",
		"files": {
			"universal/agents/spec-driven.agent.md": "Agent",
			"universal/skills/spec-driven-planner/SKILL.md": "Planner"
		}
	}`))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if bundle.Version != "v1" {
		t.Fatalf("version = %q, want v1", bundle.Version)
	}
	if len(entries) != 2 {
		t.Fatalf("entries = %d, want 2", len(entries))
	}
	if byteSize != len("Agent")+len("Planner") {
		t.Fatalf("byte size = %d, want %d", byteSize, len("Agent")+len("Planner"))
	}
	if bundle.Files["universal/agents/spec-driven.agent.md"] != "Agent" {
		t.Fatalf("files = %v", bundle.Files)
	}
	if !bundle.HasSchemaVersion() {
		t.Fatal("schema version set = false, want true")
	}
}

func TestParseBundleRejectsInvalidBundles(t *testing.T) {
	cases := []struct {
		name    string
		payload string
		message string
	}{
		{
			name:    "no files",
			payload: `{"version":"v1","files":{}}`,
			message: "Template bundle does not contain any files",
		},
		{
			name:    "no files member",
			payload: `{"version":"v1"}`,
			message: "Template bundle files must be a JSON object",
		},
		{
			name:    "files that are not an object",
			payload: `{"version":"v1","files":[]}`,
			message: "Template bundle files must be a JSON object",
		},
		{
			name:    "content that is not a string",
			payload: `{"version":"v1","files":{"a.md":42}}`,
			message: "Template file contents must be a string: a.md",
		},
		{
			name:    "absolute path",
			payload: `{"version":"v1","files":{"/etc/passwd":"x"}}`,
			message: "Template path must be relative: /etc/passwd",
		},
		{
			name:    "windows drive path",
			payload: `{"version":"v1","files":{"C:\\Windows\\system.ini":"x"}}`,
			message: `Template path must be relative: C:\Windows\system.ini`,
		},
		{
			name:    "parent segment",
			payload: `{"version":"v1","files":{"../../escape.txt":"x"}}`,
			message: "Invalid template path segment in: ../../escape.txt",
		},
		{
			name:    "current segment",
			payload: `{"version":"v1","files":{"./a.md":"x"}}`,
			message: "Invalid template path segment in: ./a.md",
		},
		{
			name:    "empty segment",
			payload: `{"version":"v1","files":{"a//b.md":"x"}}`,
			message: "Invalid template path segment in: a//b.md",
		},
		{
			name:    "null byte in the path",
			payload: `{"version":"v1","files":{"a\u0000b.md":"x"}}`,
			message: "Invalid template path: a\u0000b.md",
		},
		{
			name:    "duplicate path",
			payload: `{"version":"v1","files":{"universal/a.md":"x","universal\\a.md":"y"}}`,
			message: "Template bundle contains a duplicate path: universal/a.md",
		},
		{
			name:    "schema version that is not a number",
			payload: `{"schemaVersion":"1","version":"v1","files":{"a.md":"x"}}`,
			message: "Template bundle schemaVersion must be a number",
		},
		{
			name:    "bundle that is not an object",
			payload: `[]`,
			message: "Template bundle must be a JSON object",
		},
		{
			name:    "version that is not allowed",
			payload: `{"version":"..","files":{"a.md":"x"}}`,
			message: "Invalid template version: ... Versions may contain only letters, digits, dot, underscore, and hyphen.",
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			_, _, _, err := ParseBundle([]byte(testCase.payload))
			assertContractError(t, err, KindInvalid, testCase.message)
		})
	}
}

func TestParseBundleRejectsTooManyFiles(t *testing.T) {
	files := make([]string, 0, MaxFiles+1)
	for index := 0; index <= MaxFiles; index++ {
		files = append(files, "universal/file-"+strconv.Itoa(index)+".md")
	}
	payload := `{"version":"v1","files":{` + strings.Join(quoteAll(files), ",") + `}}`

	_, _, _, err := ParseBundle([]byte(payload))
	assertContractError(t, err, KindInvalid, "Template bundle contains too many files (2001 > 2000)")
}

func TestParseBundleRejectsOversizedBundle(t *testing.T) {
	payload := `{"version":"v1","files":{"universal/large.md":"` + strings.Repeat("a", MaxBundleBytes+1) + `"}}`

	_, _, _, err := ParseBundle([]byte(payload))
	assertContractError(t, err, KindInvalid, "Template bundle exceeds maximum size of 5242880 bytes")
}

func TestNormalizeRelativePath(t *testing.T) {
	normalized, err := NormalizeRelativePath(`universal\skills\planner\SKILL.md`)
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if normalized != "universal/skills/planner/SKILL.md" {
		t.Fatalf("normalized = %q", normalized)
	}

	if _, err := NormalizeRelativePath(""); err == nil {
		t.Fatal("empty path accepted, want a failure")
	}
}

func TestResolveInsideRejectsEscapingPaths(t *testing.T) {
	root := t.TempDir()

	resolved, err := ResolveInside(root, "universal/skills/planner/SKILL.md")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if !strings.HasSuffix(resolved, "/universal/skills/planner/SKILL.md") {
		t.Fatalf("resolved = %q", resolved)
	}

	for _, relative := range []string{"../escape.txt", "/etc/passwd", "a/../../escape.txt"} {
		if _, err := ResolveInside(root, relative); err == nil {
			t.Fatalf("%q accepted, want a failure", relative)
		} else {
			assertContractError(t, err, KindInvalid, "Path escapes template root: "+relative)
		}
	}
}

func TestCompareSemver(t *testing.T) {
	cases := []struct {
		left     string
		right    string
		expected int
	}{
		{left: "1.0.0", right: "1.0.0", expected: 0},
		{left: "1.0.1", right: "1.0.0", expected: 1},
		{left: "1.0.0", right: "1.0.1", expected: -1},
		{left: "2.0.0", right: "1.9.9", expected: 1},
		{left: "1.0.0", right: "1.0.0-alpha", expected: 1},
		{left: "1.0.0-alpha", right: "1.0.0", expected: -1},
		{left: "1.0.0-alpha", right: "1.0.0-beta", expected: -1},
		{left: "1.0.0-alpha", right: "1.0.0-alpha.1", expected: -1},
		{left: "1.0.0-rc.10", right: "1.0.0-rc.9", expected: -1},
		{left: "1.0.0", right: "1.0", expected: 0},
		{left: "1.0", right: "1.0.0", expected: 0},
	}

	for _, testCase := range cases {
		t.Run(testCase.left+" "+testCase.right, func(t *testing.T) {
			if result := CompareSemver(testCase.left, testCase.right); result != testCase.expected {
				t.Fatalf("compare = %d, want %d", result, testCase.expected)
			}
			if result := CompareSemver(testCase.right, testCase.left); result != -testCase.expected {
				t.Fatalf("reversed compare = %d, want %d", result, -testCase.expected)
			}
		})
	}
}

func TestAssertCompatibleSchema(t *testing.T) {
	if err := AssertCompatibleSchema(SchemaVersion, "Template manifest"); err != nil {
		t.Fatalf("compatible schema rejected: %v", err)
	}
	if err := AssertCompatibleSchema(0, "Template manifest"); err != nil {
		t.Fatalf("absent schema rejected: %v", err)
	}
	err := AssertCompatibleSchema(99, "Template manifest")
	assertContractError(t, err, KindIncompatible, "Template manifest schema version 99 is not supported by this CLI (expected 1)")
}

func TestIsAllowedHost(t *testing.T) {
	cases := []struct {
		hostname     string
		manifestHost string
		allowed      bool
	}{
		{hostname: "example.test", manifestHost: "example.test", allowed: true},
		{hostname: "EXAMPLE.test", manifestHost: "example.test", allowed: true},
		{hostname: "github.com", manifestHost: "example.test", allowed: true},
		{hostname: "objects.githubusercontent.com", manifestHost: "example.test", allowed: true},
		{hostname: "evil.example", manifestHost: "example.test", allowed: false},
		{hostname: "githubusercontent.com", manifestHost: "example.test", allowed: false},
	}

	for _, testCase := range cases {
		t.Run(testCase.hostname, func(t *testing.T) {
			if result := IsAllowedHost(testCase.hostname, testCase.manifestHost); result != testCase.allowed {
				t.Fatalf("allowed = %v, want %v", result, testCase.allowed)
			}
		})
	}
}

func TestIsAllowedHostHonorsTheEnvironment(t *testing.T) {
	t.Setenv("SDS_TEMPLATE_ALLOWED_HOSTS", " Mirror.test , mirror.test ")

	if !IsAllowedHost("mirror.test", "example.test") {
		t.Fatal("configured host rejected, want it allowed")
	}
	if IsAllowedHost("other.test", "example.test") {
		t.Fatal("unconfigured host allowed, want it rejected")
	}
}

func TestIsAllowedHostHonorsTheOverride(t *testing.T) {
	t.Setenv("SDS_TEMPLATE_ALLOWED_HOSTS", "mirror.test")

	if isAllowedHost("mirror.test", "example.test", []string{"other.test"}) {
		t.Fatal("configured host allowed, want the override to replace it")
	}
	if !isAllowedHost("other.test", "example.test", []string{"other.test"}) {
		t.Fatal("overridden host rejected, want it allowed")
	}
}

// assertContractError checks the kind and the message of a contract error.
func assertContractError(t *testing.T, err error, kind, message string) {
	t.Helper()

	if err == nil {
		t.Fatalf("no error, want %q", message)
	}
	contractError, ok := err.(*Error)
	if !ok {
		t.Fatalf("error = %T, want *Error", err)
	}
	if contractError.Kind != kind {
		t.Fatalf("kind = %q, want %q", contractError.Kind, kind)
	}
	if contractError.Message != message {
		t.Fatalf("message = %q, want %q", contractError.Message, message)
	}
	if contractError.Error() != message {
		t.Fatalf("error text = %q, want %q", contractError.Error(), message)
	}
}

// quoteAll quotes a list of strings for a JSON document.
func quoteAll(values []string) []string {
	quoted := make([]string, 0, len(values))
	for _, value := range values {
		quoted = append(quoted, `"`+value+`":"x"`)
	}
	return quoted
}
