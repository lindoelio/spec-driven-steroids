// Command difftest compares the ported template bundle contract with the
// previous release.
//
// The harness runs the same cases against the oracle and against the port
// and reports every difference. Run it with:
//
//	go run ./internal/bundle/difftest
package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/lindoelio/spec-driven-steroids/internal/bundle"
)

// caseFile is the shared case list.
type caseFile struct {
	Cases []testCase `json:"cases"`
}

// testCase is one case of the harness.
type testCase struct {
	Kind               string            `json:"kind"`
	Name               string            `json:"name"`
	Payload            string            `json:"payload"`
	Left               string            `json:"left"`
	Right              string            `json:"right"`
	Hostname           string            `json:"hostname"`
	ManifestHost       string            `json:"manifestHost"`
	AllowedHosts       string            `json:"allowedHosts"`
	Path               string            `json:"path"`
	Root               string            `json:"root"`
	Relative           string            `json:"relative"`
	Bundle             *bundleSpec       `json:"bundle"`
	BundleSpec         *bundleSpec       `json:"bundleSpec"`
	Manifest           *manifestSpec     `json:"manifest"`
	FetchError         string            `json:"fetchError"`
	Env                map[string]string `json:"env"`
	UseDefaultSource   bool              `json:"useDefaultSource"`
	CLIVersion         string            `json:"cliVersion"`
	ManifestURL        string            `json:"manifestUrl"`
	Status             int               `json:"status"`
	ManifestPayload    string            `json:"manifestPayload"`
	BundlePayload      string            `json:"bundlePayload"`
	BundlePayloadBytes int               `json:"bundlePayloadBytes"`
	Steps              []testStep        `json:"steps"`
}

// bundleSpec describes a bundle document.
type bundleSpec struct {
	Version       string       `json:"version"`
	SchemaVersion *int         `json:"schemaVersion"`
	Files         []bundleFile `json:"files"`
	FileCount     *int         `json:"fileCount"`
	OversizeBytes *int         `json:"oversizeBytes"`
}

// bundleFile is one file of a bundle.
type bundleFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// manifestSpec describes a manifest document.
type manifestSpec struct {
	SchemaVersion *int   `json:"schemaVersion"`
	Version       string `json:"version"`
	BundleURL     string `json:"bundleUrl"`
	SHA256        string `json:"sha256"`
	MinCLIVersion string `json:"minCliVersion"`
	PublishedAt   string `json:"publishedAt"`
}

// testStep is one step of a resolution case.
type testStep struct {
	Action         string   `json:"action"`
	Path           string   `json:"path"`
	Content        string   `json:"content"`
	Version        string   `json:"version"`
	RequiredSkills []string `json:"requiredSkills"`
}

func main() {
	here := sourceDirectory()
	casesPath := flag.String("cases", filepath.Join(here, "cases.json"), "the shared case list")
	oraclePath := flag.String("oracle", filepath.Join(here, "oracle.mjs"), "the oracle driver")
	nodePath := flag.String("node", "node", "the node executable")
	flag.Parse()

	cases, err := loadCases(*casesPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "difftest:", err)
		os.Exit(2)
	}

	matched, differences, err := runHarness(cases, *nodePath, *oraclePath, *casesPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "difftest:", err)
		os.Exit(2)
	}

	for _, difference := range differences {
		fmt.Printf("DIFFER %s\n  port:   %s\n  oracle: %s\n", difference.name, difference.port, difference.oracle)
	}
	fmt.Printf("difftest: %d cases, %d matched, %d differed\n", len(cases), matched, len(differences))
	if len(differences) > 0 {
		os.Exit(1)
	}
}

// difference is one case the port and the oracle answered differently.
type difference struct {
	name   string
	port   string
	oracle string
}

// sourceDirectory returns the directory the harness lives in.
func sourceDirectory() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return "."
	}
	return filepath.Dir(file)
}

// runHarness runs the cases against the port and against the oracle and
// reports the differences.
func runHarness(cases []testCase, node, oracle, casesPath string) (int, []difference, error) {
	goRecords, err := runCases(cases)
	if err != nil {
		return 0, nil, err
	}

	oracleRecords, err := runOracle(node, oracle, casesPath)
	if err != nil {
		return 0, nil, err
	}

	matched, differences := compare(goRecords, oracleRecords)
	return matched, differences, nil
}

// loadCases reads the shared case list.
func loadCases(path string) ([]testCase, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var file caseFile
	if err := json.Unmarshal(raw, &file); err != nil {
		return nil, err
	}
	return file.Cases, nil
}

// runOracle runs the oracle driver and reads its answers.
func runOracle(node, oracle, casesPath string) ([]any, error) {
	command := exec.Command(node, oracle, casesPath)
	command.Dir = filepath.Dir(oracle)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr
	if err := command.Run(); err != nil {
		return nil, fmt.Errorf("oracle driver failed: %w: %s", err, stderr.String())
	}
	return decodeRecords(stdout.Bytes())
}

// decodeRecords reads the JSON lines of a driver.
func decodeRecords(raw []byte) ([]any, error) {
	records := []any{}
	for _, line := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var record any
		if err := json.Unmarshal([]byte(line), &record); err != nil {
			return nil, fmt.Errorf("decode record: %w", err)
		}
		records = append(records, record)
	}
	return records, nil
}

// compare diffs the answers of the port with the answers of the oracle.
func compare(port, oracle []any) (int, []difference) {
	matched := 0
	differences := []difference{}

	for index, oracleRecord := range oracle {
		if index >= len(port) {
			differences = append(differences, difference{
				name:   recordName(oracleRecord),
				port:   "missing",
				oracle: render(oracleRecord),
			})
			continue
		}
		portRecord := normalize(port[index])
		oracleValue := normalize(oracleRecord)
		if reflect.DeepEqual(portRecord, oracleValue) {
			matched++
			continue
		}
		differences = append(differences, difference{
			name:   recordName(oracleRecord),
			port:   render(portRecord),
			oracle: render(oracleValue),
		})
	}
	for index := len(oracle); index < len(port); index++ {
		differences = append(differences, difference{
			name:   recordName(port[index]),
			port:   render(port[index]),
			oracle: "missing",
		})
	}
	return matched, differences
}

// normalize renders a record as generic JSON so the two sides compare the
// same way.
func normalize(record any) any {
	raw, err := json.Marshal(record)
	if err != nil {
		return record
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return record
	}
	return value
}

// recordName returns the name of a record.
func recordName(record any) string {
	fields, ok := record.(map[string]any)
	if !ok {
		return "unknown"
	}
	name, _ := fields["case"].(string)
	return name
}

// render returns the readable form of a record.
func render(record any) string {
	raw, err := json.Marshal(record)
	if err != nil {
		return fmt.Sprint(record)
	}
	return string(raw)
}

// runCases runs every case against the port.
func runCases(cases []testCase) ([]any, error) {
	records := make([]any, 0, len(cases))
	for _, testCase := range cases {
		result, err := runCase(testCase)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", testCase.Name, err)
		}
		records = append(records, map[string]any{
			"case":   testCase.Name,
			"kind":   testCase.Kind,
			"result": result,
		})
	}
	return records, nil
}

// runCase runs one case against the port.
func runCase(testCase testCase) (any, error) {
	restore := applyEnvironment(testCase.Env)
	defer restore()

	switch testCase.Kind {
	case "manifest":
		return runManifest(testCase)
	case "bundle":
		return runBundle(testCase)
	case "semver":
		return map[string]any{"result": bundle.CompareSemver(testCase.Left, testCase.Right)}, nil
	case "host":
		return map[string]any{"allowed": bundle.IsAllowedHost(testCase.Hostname, testCase.ManifestHost)}, nil
	case "path":
		return runPath(testCase)
	case "inside":
		return runInside(testCase)
	case "resolve":
		return runResolve(testCase)
	case "bundled":
		return runBundled()
	}
	return nil, fmt.Errorf("unknown case kind %q", testCase.Kind)
}

// applyEnvironment sets the environment of a case and returns the function
// that restores it.
func applyEnvironment(values map[string]string) func() {
	if len(values) == 0 {
		return func() {}
	}
	previous := map[string]string{}
	for name, value := range values {
		previous[name] = os.Getenv(name)
		_ = os.Setenv(name, value)
	}
	return func() {
		for name, value := range previous {
			if value == "" {
				_ = os.Unsetenv(name)
				continue
			}
			_ = os.Setenv(name, value)
		}
	}
}

// runManifest parses a manifest.
func runManifest(testCase testCase) (any, error) {
	manifest, err := bundle.ParseManifest([]byte(testCase.Payload))
	if err != nil {
		return errorResult(err), nil
	}
	return map[string]any{
		"ok": true,
		"manifest": map[string]any{
			"version":          manifest.Version,
			"bundleUrl":        manifest.BundleURL,
			"sha256":           optional(manifest.SHA256),
			"minCliVersion":    optional(manifest.MinCLIVersion),
			"publishedAt":      optional(manifest.PublishedAt),
			"schemaVersion":    optionalNumber(manifest.SchemaVersion, manifest.HasSchemaVersion()),
			"schemaVersionSet": manifest.HasSchemaVersion(),
		},
	}, nil
}

// runBundle parses a bundle.
func runBundle(testCase testCase) (any, error) {
	payload := testCase.Payload
	if payload == "" {
		payload = bundleDocument(testCase.BundleSpec)
	}

	bundleValue, entries, byteSize, err := bundle.ParseBundle([]byte(payload))
	if err != nil {
		return errorResult(err), nil
	}

	sample := []any{}
	for index, entry := range entries {
		if index >= 5 {
			break
		}
		sample = append(sample, map[string]any{"path": entry.Path, "contents": entry.Contents})
	}

	return map[string]any{
		"ok":               true,
		"version":          bundleValue.Version,
		"schemaVersion":    optionalNumber(bundleValue.SchemaVersion, bundleValue.HasSchemaVersion()),
		"schemaVersionSet": bundleValue.HasSchemaVersion(),
		"fileCount":        len(bundleValue.Files),
		"byteSize":         byteSize,
		"entries":          sample,
	}, nil
}

// runPath normalizes a path.
func runPath(testCase testCase) (any, error) {
	normalized, err := bundle.NormalizeRelativePath(testCase.Path)
	if err != nil {
		return errorResult(err), nil
	}
	return map[string]any{"ok": true, "normalized": normalized}, nil
}

// runInside resolves a path inside a root.
func runInside(testCase testCase) (any, error) {
	resolved, err := bundle.ResolveInside(testCase.Root, testCase.Relative)
	if err != nil {
		return errorResult(err), nil
	}
	return map[string]any{"ok": true, "resolved": resolved}, nil
}

// errorResult renders a contract error.
func errorResult(err error) map[string]any {
	kind := "invalid"
	message := err.Error()
	var contractError *bundle.Error
	if errors.As(err, &contractError) {
		kind = contractError.Kind
		message = contractError.Message
	}
	return map[string]any{"ok": false, "kind": kind, "message": message}
}

// optional returns a value or null when it is empty.
func optional(value string) any {
	if value == "" {
		return nil
	}
	return value
}

// optionalNumber returns a number or null when the payload carried none.
func optionalNumber(value int, present bool) any {
	if !present {
		return nil
	}
	return value
}

// resolveDocuments renders the bundle and the manifest of a resolution step.
func resolveDocuments(testCase testCase, version string) (string, string) {
	bundleText := testCase.Payload
	if bundleText == "" {
		spec := testCase.Bundle
		if spec == nil {
			spec = testCase.BundleSpec
		}
		if spec != nil {
			copied := *spec
			if version != "" {
				copied.Version = version
			}
			bundleText = bundleDocument(&copied)
		}
	}

	digest := sha256Hex([]byte(bundleText))

	manifest := testCase.Manifest
	if manifest != nil {
		copied := *manifest
		if version != "" {
			copied.Version = version
		}
		return bundleText, manifestDocument(&copied, digest)
	}
	return bundleText, ""
}

// bundleDocument renders a bundle document the way the oracle driver does.
func bundleDocument(spec *bundleSpec) string {
	if spec == nil {
		return ""
	}

	files := []bundleFile{}
	switch {
	case spec.FileCount != nil:
		for index := 0; index < *spec.FileCount; index++ {
			files = append(files, bundleFile{Path: fmt.Sprintf("universal/file-%d.md", index), Content: "x"})
		}
	case spec.OversizeBytes != nil:
		files = append(files, bundleFile{Path: "universal/large.md", Content: strings.Repeat("a", *spec.OversizeBytes)})
	default:
		files = spec.Files
	}

	schemaVersion := 1
	if spec.SchemaVersion != nil {
		schemaVersion = *spec.SchemaVersion
	}

	var builder strings.Builder
	builder.WriteString(`{"schemaVersion":`)
	builder.WriteString(jsonNumber(schemaVersion))
	builder.WriteString(`,"version":`)
	builder.WriteString(jsonString(spec.Version))
	builder.WriteString(`,"files":{`)
	for index, file := range files {
		if index > 0 {
			builder.WriteString(",")
		}
		builder.WriteString(jsonString(file.Path))
		builder.WriteString(":")
		builder.WriteString(jsonString(file.Content))
	}
	builder.WriteString("}}")
	return builder.String()
}

// manifestDocument renders a manifest document the way the oracle driver
// does.
func manifestDocument(spec *manifestSpec, digest string) string {
	if spec == nil {
		return ""
	}

	var builder strings.Builder
	builder.WriteString("{")
	first := true
	write := func(name, value string) {
		if !first {
			builder.WriteString(",")
		}
		first = false
		builder.WriteString(jsonString(name))
		builder.WriteString(":")
		builder.WriteString(value)
	}

	if spec.SchemaVersion != nil {
		write("schemaVersion", jsonNumber(*spec.SchemaVersion))
	}
	write("version", jsonString(spec.Version))
	write("bundleUrl", jsonString(spec.BundleURL))
	if spec.SHA256 != "" {
		value := spec.SHA256
		if value == "{{digest}}" {
			value = digest
		}
		write("sha256", jsonString(value))
	}
	if spec.MinCLIVersion != "" {
		write("minCliVersion", jsonString(spec.MinCLIVersion))
	}
	if spec.PublishedAt != "" {
		write("publishedAt", jsonString(spec.PublishedAt))
	}
	builder.WriteString("}")
	return builder.String()
}

// jsonString renders a JSON string.
func jsonString(value string) string {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return `""`
	}
	return strings.TrimRight(buffer.String(), "\n")
}

// jsonNumber renders a JSON number.
func jsonNumber(value int) string {
	return fmt.Sprintf("%d", value)
}

// sha256Hex returns the hex digest of a payload.
func sha256Hex(payload []byte) string {
	digest := sha256.Sum256(payload)
	return hex.EncodeToString(digest[:])
}

// runBundled resolves the bundled source the way the command line does.
func runBundled() (any, error) {
	source, err := bundle.Resolve(context.Background(), bundle.ResolveOptions{Source: bundle.SourceBundled})
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"source":         source.Source,
		"version":        source.Version,
		"fallbackReason": optional(source.FallbackReason),
		"warnings":       source.Warnings,
	}, nil
}

// runResolve runs a resolution case.
func runResolve(testCase testCase) (any, error) {
	root, err := os.MkdirTemp("", "sds-difftest-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(root)

	cacheDir := filepath.Join(root, "cache")
	bundleText, manifestText := resolveDocuments(testCase, "")

	fetch := func(_ context.Context, url string) (int, []byte, error) {
		if testCase.FetchError != "" {
			return 0, nil, errors.New(testCase.FetchError)
		}
		status := testCase.Status
		if status == 0 {
			status = 200
		}
		if strings.HasSuffix(url, "/templates-bundle.json") {
			if testCase.BundlePayloadBytes > 0 {
				return status, []byte(strings.Repeat("x", testCase.BundlePayloadBytes)), nil
			}
			if testCase.BundlePayload != "" {
				return status, []byte(testCase.BundlePayload), nil
			}
			return status, []byte(bundleText), nil
		}
		if testCase.ManifestPayload != "" {
			return status, []byte(testCase.ManifestPayload), nil
		}
		return status, []byte(manifestText), nil
	}

	records := []any{}
	rootDir := ""

	for _, step := range testCase.Steps {
		switch step.Action {
		case "resolve":
			bundleText, manifestText = resolveDocuments(testCase, step.Version)
			options := bundle.ResolveOptions{
				CacheDir:       cacheDir,
				ManifestURL:    firstNonEmpty(testCase.ManifestURL, "https://example.test/templates-manifest.json"),
				CLIVersion:     firstNonEmpty(testCase.CLIVersion, "1.0.0"),
				Fetch:          fetch,
				RequiredSkills: step.RequiredSkills,
			}
			if !testCase.UseDefaultSource {
				options.Source = bundle.SourceRemote
			}
			source, err := bundle.Resolve(context.Background(), options)
			if err != nil {
				return nil, err
			}
			rootDir = source.RootDir
			touchVersionDir(rootDir, len(records))
			records = append(records, map[string]any{
				"action":         "resolve",
				"source":         source.Source,
				"version":        source.Version,
				"sha256":         optional(source.SHA256),
				"fallbackReason": optional(source.FallbackReason),
				"errorKind":      optional(source.ErrorKind),
				"warnings":       source.Warnings,
			})
		case "removeFile":
			if rootDir != "" {
				if err := os.Remove(filepath.Join(rootDir, step.Path)); err != nil && !os.IsNotExist(err) {
					return nil, err
				}
			}
			records = append(records, map[string]any{"action": "removeFile", "ok": true})
		case "writeFile":
			if rootDir != "" {
				target := filepath.Join(rootDir, step.Path)
				if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
					return nil, err
				}
				if err := os.WriteFile(target, []byte(step.Content), 0o644); err != nil {
					return nil, err
				}
			}
			records = append(records, map[string]any{"action": "writeFile", "ok": true})
		case "createFile":
			target := filepath.Join(root, step.Path)
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return nil, err
			}
			if err := os.WriteFile(target, []byte(step.Content), 0o644); err != nil {
				return nil, err
			}
			records = append(records, map[string]any{"action": "createFile", "ok": true})
		case "listFiles":
			records = append(records, map[string]any{"action": "listFiles", "files": listFiles(rootDir)})
		case "marker":
			records = append(records, map[string]any{"action": "marker", "marker": readMarker(rootDir)})
		case "listCache":
			records = append(records, map[string]any{"action": "listCache", "versions": listCacheVersions(cacheDir)})
		case "exists":
			_, err := os.Stat(filepath.Join(root, step.Path))
			records = append(records, map[string]any{"action": "exists", "exists": err == nil})
		default:
			return nil, fmt.Errorf("unknown step %q", step.Action)
		}
	}

	return map[string]any{"records": records}, nil
}

// listFiles lists the files of a directory, relative to it.
func listFiles(root string) []string {
	files := []string{}
	if root == "" {
		return files
	}
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		files = append(files, filepath.ToSlash(relative))
		return nil
	})
	sort.Strings(files)
	return files
}

// touchVersionDir gives the extracted bundle version an age of its own, so
// the retention of the cache does not depend on the resolution of the clock
// of the filesystem.
func touchVersionDir(rootDir string, index int) {
	if rootDir == "" {
		return
	}
	stamp := time.Unix(int64(1700000000+index*60), 0)
	_ = os.Chtimes(filepath.Dir(rootDir), stamp, stamp)
}

// listCacheVersions lists the bundle versions the cache keeps.
func listCacheVersions(cacheDir string) []string {
	versions := []string{}
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return versions
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		versions = append(versions, entry.Name())
	}
	sort.Strings(versions)
	return versions
}

// readMarker reads the cache marker of an extracted bundle.
func readMarker(rootDir string) any {
	if rootDir == "" {
		return nil
	}
	raw, err := os.ReadFile(filepath.Join(filepath.Dir(rootDir), ".sds-template-bundle.json"))
	if err != nil {
		return nil
	}
	var marker struct {
		SHA256  string            `json:"sha256"`
		Version string            `json:"version"`
		Files   map[string]string `json:"files"`
	}
	if err := json.Unmarshal(raw, &marker); err != nil {
		return nil
	}
	files := map[string]any{}
	for name, digest := range marker.Files {
		files[name] = digest
	}
	return map[string]any{
		"sha256":  marker.SHA256,
		"version": marker.Version,
		"files":   files,
		"raw":     normalizeMarker(string(raw)),
	}
}

// normalizeMarker replaces the extraction time of a marker, so the harness
// compares the document the previous release wrote.
func normalizeMarker(raw string) string {
	return markerTimestamp.ReplaceAllString(raw, `"extractedAt": "TIMESTAMP"`)
}

// markerTimestamp matches the extraction time of a cache marker.
var markerTimestamp = regexp.MustCompile(`"extractedAt":\s*"[^"]*"`)

// firstNonEmpty returns the first value that is not empty.
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
