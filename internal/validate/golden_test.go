package validate

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

const (
	// goldenFixturePath is the location of the golden fixtures, relative to
	// the package directory of the validator.
	goldenFixturePath = "../testdata/fixtures/validator/validate-golden.json"
	// goldenCaptureEnv enables the capture of the golden fixtures. The
	// capture never runs without it.
	goldenCaptureEnv = "SDS_CAPTURE_GOLDEN"
	// goldenSchemaVersion is the version of the layout of the fixture file.
	goldenSchemaVersion = 1
	// goldenCaptureCommand re-captures the fixtures.
	goldenCaptureCommand = "SDS_CAPTURE_GOLDEN=1 go test ./internal/validate/ -run TestCaptureValidatorGoldenFixtures"
)

// goldenFixture is the versioned fixture of the validate command. It carries
// the input and the recorded behavior of every case of the differential
// corpus, so that the parity with the TypeScript implementation survives the
// removal of the TypeScript tree.
type goldenFixture struct {
	// SchemaVersion is the version of the layout of the fixture.
	SchemaVersion int `json:"schemaVersion"`
	// Description explains what the fixture holds.
	Description string `json:"description"`
	// Capture documents how the fixture was recorded.
	Capture goldenCapture `json:"capture"`
	// Blobs holds the content of the files of the cases, keyed by the digest
	// of their content.
	Blobs map[string]goldenBlob `json:"blobs"`
	// Cases holds the recorded behavior of every case of the corpus.
	Cases []goldenCase `json:"cases"`
}

// goldenCapture documents the provenance of the fixture.
type goldenCapture struct {
	// Oracle is the entry point of the TypeScript implementation.
	Oracle string `json:"oracle"`
	// Command re-captures the fixture.
	Command string `json:"command"`
	// WorkspaceToken is the placeholder of the absolute path of the
	// workspace of a case.
	WorkspaceToken string `json:"workspaceToken"`
}

// goldenBlob is the content of one file of a case.
type goldenBlob struct {
	// Encoding is "utf8" or "base64".
	Encoding string `json:"encoding"`
	// Content is the content of the file.
	Content string `json:"content"`
}

// goldenCase is one recorded case of the corpus.
type goldenCase struct {
	// Name is the name of the case in the corpus.
	Name string `json:"name"`
	// Cwd is the working directory of the case, relative to the workspace
	// root of the case.
	Cwd string `json:"cwd"`
	// Env holds the environment overrides of the case. A null value means
	// that the case inherits the environment of the test process.
	Env []string `json:"env"`
	// Args holds the arguments of the validate command. The workspace
	// placeholder marks the absolute path of the workspace of the case.
	Args []string `json:"args"`
	// Files holds the input of the case, relative to the workspace root.
	Files []goldenFileRef `json:"files"`
	// Stdout, Stderr and ExitCode are the recorded behavior of the oracle.
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exitCode"`
}

// goldenFileRef is one file of the input of a case.
type goldenFileRef struct {
	// Path is the path of the file, relative to the workspace root.
	Path string `json:"path"`
	// Dir reports whether the entry is a directory.
	Dir bool `json:"dir,omitempty"`
	// Mode holds the permission bits of the entry.
	Mode string `json:"mode,omitempty"`
	// Blob is the digest of the content of the file.
	Blob string `json:"blob,omitempty"`
	// Link holds the target of a symbolic link.
	Link string `json:"link,omitempty"`
}

// TestValidateMatchesTheGoldenFixtures replays the recorded behavior of the
// TypeScript oracle against the Go implementation.
//
// The test is self-contained: it only needs the golden fixture file. It does
// not need the TypeScript implementation, the spec directory of the
// repository or the fixtures of the TypeScript tree. It skips when the
// fixture file is missing, so that a fresh checkout that has not captured the
// fixtures yet still builds.
func TestValidateMatchesTheGoldenFixtures(t *testing.T) {
	fixture := readGoldenFixture(t)

	failures := 0
	for _, record := range fixture.Cases {
		workspace := physicalPath(t, t.TempDir())
		materializeGoldenCase(t, workspace, record, fixture.Blobs)

		arguments := make([]string, 0, len(record.Args))
		for _, argument := range record.Args {
			arguments = append(arguments, substituteWorkspace(argument, workspaceToken, workspace))
		}

		cwd := workspace
		if record.Cwd != "" && record.Cwd != "." {
			cwd = filepath.Join(workspace, filepath.FromSlash(record.Cwd))
		}

		stdout, stderr, code := runGo(t, cwd, arguments, record.Env)

		expectedStdout := substituteWorkspace(record.Stdout, workspaceToken, workspace)
		expectedStderr := substituteWorkspace(record.Stderr, workspaceToken, workspace)

		if stdout == expectedStdout && stderr == expectedStderr && code == record.ExitCode {
			continue
		}

		failures++
		t.Errorf("case %q differs\nargs: %v\n  expected exit=%d\n  actual   exit=%d", record.Name, arguments, record.ExitCode, code)
		if stdout != expectedStdout {
			t.Errorf("  stdout expected:\n%s\n  stdout actual:\n%s", expectedStdout, stdout)
		}
		if stderr != expectedStderr {
			t.Errorf("  stderr expected:\n%s\n  stderr actual:\n%s", expectedStderr, stderr)
		}
	}

	t.Logf("golden replay: %d cases, %d failures", len(fixture.Cases), failures)
}

// TestCaptureValidatorGoldenFixtures records the behavior of the TypeScript
// oracle for every case of the corpus.
//
// The capture only runs when SDS_CAPTURE_GOLDEN=1 is set, so that it never
// runs by accident. Re-capture the fixtures with:
//
//	SDS_CAPTURE_GOLDEN=1 go test ./internal/validate/ -run TestCaptureValidatorGoldenFixtures
//
// The capture is deterministic. The corpus is materialized in a temporary
// directory and the absolute path of that directory is the only part of the
// recorded output that changes between two runs. The capture replaces that
// path with the workspace placeholder, so two captures produce the same file
// byte for byte. The capture needs the TypeScript implementation: it is the
// last moment at which the oracle is available.
func TestCaptureValidatorGoldenFixtures(t *testing.T) {
	if os.Getenv(goldenCaptureEnv) != "1" {
		t.Skipf("set %s=1 to capture the golden fixtures", goldenCaptureEnv)
	}

	root := repositoryRoot(t)
	oracle := filepath.Join(root, "packages", "cli", "dist", "cli", "index.js")
	if _, err := os.Stat(oracle); err != nil {
		t.Skipf("the oracle is not built: %v", err)
	}

	cases := buildCorpus(t, root)
	fixture := goldenFixture{
		SchemaVersion: goldenSchemaVersion,
		Description: "Golden fixtures of the validate command. Every case carries the input " +
			"of the case, relative to the workspace root of the case, and the behavior of the " +
			"TypeScript oracle: its standard output, its standard error and its exit code.",
		Capture: goldenCapture{
			Oracle:         "packages/cli/dist/cli/index.js",
			Command:        goldenCaptureCommand,
			WorkspaceToken: workspaceToken,
		},
		Blobs: map[string]goldenBlob{},
		Cases: []goldenCase{},
	}

	for _, testCase := range cases {
		resolved := testCase.resolve()
		stdout, stderr, code := runOracle(t, root, resolved.cwd, resolved.args, resolved.env)

		if strings.Contains(stdout, workspaceToken) || strings.Contains(stderr, workspaceToken) {
			t.Fatalf("the output of the case %q contains the workspace placeholder", testCase.name)
		}

		record := goldenCase{
			Name:     testCase.name,
			Cwd:      relativeWorkspacePath(t, resolved.workspace, resolved.cwd),
			Env:      testCase.env,
			Args:     testCase.args,
			Files:    []goldenFileRef{},
			Stdout:   substituteWorkspace(stdout, resolved.workspace, workspaceToken),
			Stderr:   substituteWorkspace(stderr, resolved.workspace, workspaceToken),
			ExitCode: code,
		}

		for _, file := range testCase.files {
			reference := goldenFileRef{
				Path: file.Path,
				Dir:  file.Dir,
				Mode: fmt.Sprintf("%04o", file.Mode),
				Link: file.Link,
			}
			if !file.Dir {
				reference.Blob = fixture.addBlob(t, file)
			}
			record.Files = append(record.Files, reference)
		}

		fixture.Cases = append(fixture.Cases, record)
	}

	writeGoldenFixture(t, fixture)
	t.Logf("captured %d cases into %s", len(fixture.Cases), goldenFixturePath)
}

// addBlob stores the content of a file in the blob store of the fixture and
// returns the digest of the content. The store keeps the fixture small: the
// corpus repeats the same artifacts in many cases.
func (f *goldenFixture) addBlob(t *testing.T, file workspaceFile) string {
	t.Helper()

	content := []byte(file.Content)
	encoding := "utf8"

	if file.Binary {
		decoded, err := decodeBase64(file.Base64)
		if err != nil {
			t.Fatalf("cannot decode the content of %s: %v", file.Path, err)
		}
		content = decoded
		encoding = "base64"
	}

	if strings.Contains(string(content), workspaceToken) {
		t.Fatalf("the content of %s contains the workspace placeholder", file.Path)
	}

	digest := digestOf(content)
	if _, ok := f.Blobs[digest]; !ok {
		stored := file.Content
		if file.Binary {
			stored = file.Base64
		}
		f.Blobs[digest] = goldenBlob{Encoding: encoding, Content: stored}
	}

	return digest
}

// readGoldenFixture reads the golden fixture file. It skips the test when
// the file is missing.
func readGoldenFixture(t *testing.T) goldenFixture {
	t.Helper()

	content, err := os.ReadFile(goldenFixturePath)
	if err != nil {
		t.Skipf("the golden fixtures are not captured: %v", err)
	}

	fixture := goldenFixture{}
	if err := json.Unmarshal(content, &fixture); err != nil {
		t.Fatalf("cannot read the golden fixtures: %v", err)
	}

	if fixture.SchemaVersion != goldenSchemaVersion {
		t.Fatalf("the golden fixtures use the schema version %d, the test expects %d", fixture.SchemaVersion, goldenSchemaVersion)
	}

	return fixture
}

// writeGoldenFixture writes the golden fixture file.
func writeGoldenFixture(t *testing.T, fixture goldenFixture) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(goldenFixturePath), 0o755); err != nil {
		t.Fatalf("cannot create the fixture directory: %v", err)
	}

	file, err := os.Create(goldenFixturePath)
	if err != nil {
		t.Fatalf("cannot create the fixture file: %v", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")

	if err := encoder.Encode(fixture); err != nil {
		t.Fatalf("cannot write the fixture file: %v", err)
	}
}

// materializeGoldenCase writes the recorded input of a case into the
// workspace.
func materializeGoldenCase(t *testing.T, workspace string, record goldenCase, blobs map[string]goldenBlob) {
	t.Helper()

	for _, file := range record.Files {
		path := filepath.Join(workspace, filepath.FromSlash(file.Path))

		if file.Dir {
			if err := os.MkdirAll(path, 0o755); err != nil {
				t.Fatalf("cannot create %s: %v", path, err)
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("cannot create %s: %v", filepath.Dir(path), err)
		}

		if file.Link != "" {
			if err := os.Symlink(file.Link, path); err != nil {
				t.Fatalf("cannot create the link %s: %v", path, err)
			}
			continue
		}

		blob, ok := blobs[file.Blob]
		if !ok {
			t.Fatalf("the blob %q of %q is missing", file.Blob, file.Path)
		}

		content := []byte(blob.Content)
		if blob.Encoding == "base64" {
			decoded, err := decodeBase64(blob.Content)
			if err != nil {
				t.Fatalf("cannot decode the blob %q: %v", file.Blob, err)
			}
			content = decoded
		}

		// The digest of the blob is the key of the blob store, so the
		// fixture carries its own integrity check.
		if digest := digestOf(content); digest != file.Blob {
			t.Fatalf("the blob %q of %q does not match its content", file.Blob, file.Path)
		}

		if err := os.WriteFile(path, content, 0o644); err != nil {
			t.Fatalf("cannot write %s: %v", path, err)
		}

		if file.Mode != "" {
			mode, err := strconv.ParseUint(file.Mode, 8, 32)
			if err != nil {
				t.Fatalf("cannot read the mode %q of %q: %v", file.Mode, file.Path, err)
			}
			if err := os.Chmod(path, os.FileMode(mode)); err != nil {
				t.Fatalf("cannot set the mode of %s: %v", path, err)
			}
		}
	}
}

// substituteWorkspace replaces one workspace path with another.
//
// The oracle prints the absolute path of the files it reads and the corpus
// lives in a temporary directory, so the absolute path of the workspace
// changes on every run. The capture replaces that path with the workspace
// placeholder, and the replay replaces the placeholder with the path of the
// materialized workspace.
//
// The placeholder marks the temporary path and nothing else. Every other
// byte of the diagnostics, the order of the issues, the punctuation, the
// emoji and the exit code are compared as they are.
func substituteWorkspace(value string, from string, to string) string {
	return strings.ReplaceAll(value, from, to)
}

// relativeWorkspacePath returns the path of a directory, relative to the
// workspace root of a case.
func relativeWorkspacePath(t *testing.T, workspace string, directory string) string {
	t.Helper()

	relative, err := filepath.Rel(workspace, directory)
	if err != nil {
		t.Fatalf("cannot relate %s to %s: %v", directory, workspace, err)
	}

	return filepath.ToSlash(relative)
}
