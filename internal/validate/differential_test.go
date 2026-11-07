package validate

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"unicode/utf8"
)

const (
	helperEnv     = "SDS_VALIDATE_HELPER"
	helperArgsEnv = "SDS_VALIDATE_ARGS"

	// workspaceToken is the placeholder of the root of a materialized case
	// workspace in the arguments of a corpus case. The differential harness
	// resolves it before it runs a command, and the golden capture records
	// the arguments with the placeholder as they are.
	workspaceToken = "${SDS_GOLDEN_WORKSPACE}"
)

// workspaceFile is one entry of a materialized case workspace.
type workspaceFile struct {
	// Path is the path of the entry relative to the workspace root.
	Path string
	// Dir reports whether the entry is a directory.
	Dir bool
	// Mode holds the permission bits of the entry.
	Mode uint32
	// Content holds the content of a text file.
	Content string
	// Binary reports whether the file holds binary content.
	Binary bool
	// Base64 holds the base64 encoded content of a binary file.
	Base64 string
	// Link holds the target of a symbolic link.
	Link string
}

// digestOf returns the digest of the content of a file. The digest is the key
// of the file in the blob store of the golden fixtures.
func digestOf(content []byte) string {
	digest := sha256.Sum256(content)
	return hex.EncodeToString(digest[:])
}

// isTextContent reports whether a content can be stored as text.
func isTextContent(content []byte) bool {
	return utf8.Valid(content)
}

// encodeBase64 encodes a binary content.
func encodeBase64(content []byte) string {
	return base64.StdEncoding.EncodeToString(content)
}

// decodeBase64 decodes a binary content.
func decodeBase64(content string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(content)
}

// validateCase is one differential test case.
type validateCase struct {
	name string
	args []string
	cwd  string
	// env holds the environment of the case, the empty environment hides the
	// git executable from both implementations.
	env []string
	// workspace is the absolute path of the root of the materialized input
	// tree of the case. The arguments of the case refer to it through the
	// workspace placeholder.
	workspace string
	// files holds the content of the materialized input tree of the case,
	// relative to the workspace root.
	files []workspaceFile
}

// resolve replaces the workspace placeholder of the arguments of the case
// with the absolute path of the workspace of the case.
func (c validateCase) resolve() validateCase {
	arguments := make([]string, 0, len(c.args))
	for _, argument := range c.args {
		arguments = append(arguments, strings.ReplaceAll(argument, workspaceToken, c.workspace))
	}
	c.args = arguments
	return c
}

// TestValidateHelperProcess runs the Go implementation as a CLI. It is
// started by the differential harness through the test binary.
func TestValidateHelperProcess(t *testing.T) {
	if os.Getenv(helperEnv) != "1" {
		t.Skip("helper process")
	}

	var args []string
	if err := json.Unmarshal([]byte(os.Getenv(helperArgsEnv)), &args); err != nil || len(args) == 0 {
		os.Exit(2)
	}

	subcommand := args[0]
	positional := []string{}
	options := Options{Format: "text"}

	rest := args[1:]
	for index := 0; index < len(rest); index++ {
		switch rest[index] {
		case "--format":
			if index+1 < len(rest) {
				options.Format = rest[index+1]
				index++
			}
		case "--target-dir":
			if index+1 < len(rest) {
				options.TargetDir = rest[index+1]
				index++
			}
		case "--requirements":
			if index+1 < len(rest) {
				options.Requirements = rest[index+1]
				index++
			}
		case "--design":
			if index+1 < len(rest) {
				options.Design = rest[index+1]
				index++
			}
		case "--changed":
			if index+1 < len(rest) {
				options.Changed = rest[index+1]
				index++
			}
		default:
			positional = append(positional, rest[index])
		}
	}

	code := Execute(subcommand, positional, options, os.Stdout, os.Stderr)
	os.Exit(code)
}

// TestValidateMatchesOracle compares the Go implementation with the
// TypeScript oracle for every case of the corpus.
func TestValidateMatchesOracle(t *testing.T) {
	root := repositoryRoot(t)

	// The live comparison needs the oracle. Once the TypeScript
	// implementation is removed, the golden fixtures carry the proof.
	oracle := filepath.Join(root, "packages", "cli", "dist", "cli", "index.js")
	if _, err := os.Stat(oracle); err != nil {
		t.Skipf("the TypeScript oracle is not built: %v", err)
	}

	cases, _ := buildCorpus(t, root)

	if len(cases) == 0 {
		t.Fatal("empty corpus")
	}

	filter := os.Getenv("SDS_DIFF_FILTER")
	selected := 0
	failures := 0
	for _, testCase := range cases {
		if filter != "" && !strings.Contains(testCase.name, filter) {
			continue
		}
		selected++
		resolved := testCase.resolve()
		oracleStdout, oracleStderr, oracleCode := runOracle(t, root, resolved.cwd, resolved.args, resolved.env)
		goStdout, goStderr, goCode := runGo(t, resolved.cwd, resolved.args, resolved.env)

		if oracleStdout == goStdout && oracleStderr == goStderr && oracleCode == goCode {
			continue
		}

		failures++
		t.Errorf("case %q differs\nargs: %v\n  oracle exit=%d\n  go     exit=%d", testCase.name, resolved.args, oracleCode, goCode)
		if oracleStdout != goStdout {
			t.Errorf("  stdout oracle:\n%s\n  stdout go:\n%s", oracleStdout, goStdout)
		}
		if oracleStderr != goStderr {
			t.Errorf("  stderr oracle:\n%s\n  stderr go:\n%s", oracleStderr, goStderr)
		}
	}

	t.Logf("differential harness: %d cases, %d selected, %d failures", len(cases), selected, failures)
}

// repositoryRoot returns the root of the repository.
func repositoryRoot(t *testing.T) string {
	t.Helper()
	working, err := os.Getwd()
	if err != nil {
		t.Fatalf("cannot read the working directory: %v", err)
	}
	return filepath.Dir(filepath.Dir(working))
}

// physicalPath returns the path without symbolic links. The oracle and the Go
// implementation both report the physical path of the working directory, so
// the corpus has to use it as well.
func physicalPath(t *testing.T, path string) string {
	t.Helper()
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		t.Fatalf("cannot resolve %s: %v", path, err)
	}
	return resolved
}

// runOracle runs the TypeScript oracle and returns its output.
func runOracle(t *testing.T, root string, cwd string, args []string, env []string) (string, string, int) {
	t.Helper()
	oracleArgs := append([]string{"validate"}, args...)
	command := exec.Command("node", append([]string{filepath.Join(root, "packages", "cli", "dist", "cli", "index.js")}, oracleArgs...)...)
	command.Dir = cwd
	if env != nil {
		command.Env = env
	}
	return runCommand(t, command)
}

// runGo runs the Go implementation and returns its output.
func runGo(t *testing.T, cwd string, args []string, env []string) (string, string, int) {
	t.Helper()
	payload, err := json.Marshal(args)
	if err != nil {
		t.Fatalf("cannot encode the arguments: %v", err)
	}
	command := exec.Command(os.Args[0], "-test.run=TestValidateHelperProcess")
	command.Dir = cwd
	command.Env = append(os.Environ(), helperEnv+"=1", helperArgsEnv+"="+string(payload))
	if env != nil {
		command.Env = append(env, helperEnv+"=1", helperArgsEnv+"="+string(payload))
	}
	return runCommand(t, command)
}

// runCommand runs a command and captures its output.
func runCommand(t *testing.T, command *exec.Cmd) (string, string, int) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr

	code := 0
	if err := command.Run(); err != nil {
		exitError, ok := err.(*exec.ExitError)
		if !ok {
			t.Fatalf("cannot run %v: %v", command.Args, err)
		}
		code = exitError.ExitCode()
	}

	return stdout.String(), stderr.String(), code
}

// corpusBuilder materializes the inputs of the corpus into temporary
// workspaces.
//
// The corpus used to read the artifacts of the TypeScript tree directly. The
// materialized workspaces replace them: every case owns the files it reads,
// the differential harness and the golden capture run against the same
// workspaces, and the golden fixtures carry the inputs of every case.
type corpusBuilder struct {
	t    *testing.T
	base string
	// files caches the collected content of every workspace.
	files map[string][]workspaceFile
	// missing records the sources the corpus could not use, so a source
	// that disappears cannot shrink the corpus without anyone noticing.
	missing []string
}

// newCorpusBuilder creates a builder that materializes the workspaces under a
// temporary directory.
func newCorpusBuilder(t *testing.T) *corpusBuilder {
	t.Helper()
	return &corpusBuilder{
		t:     t,
		base:  physicalPath(t, t.TempDir()),
		files: map[string][]workspaceFile{},
	}
}

// workspace creates an empty workspace and returns its absolute path.
func (b *corpusBuilder) workspace(name string) string {
	b.t.Helper()
	directory := filepath.Join(b.base, name)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		b.t.Fatalf("cannot create the workspace %s: %v", directory, err)
	}
	return directory
}

// copy copies a file into the workspace.
func (b *corpusBuilder) copy(workspace string, relative string, source string) {
	b.t.Helper()
	destination := filepath.Join(workspace, relative)
	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		b.t.Fatalf("cannot create %s: %v", filepath.Dir(destination), err)
	}
	copyFile(b.t, source, destination)
}

// copySpec copies the artifacts of a spec into the workspace.
func (b *corpusBuilder) copySpec(workspace string, slug string, source string) {
	b.t.Helper()
	for _, file := range []string{"requirements.md", "design.md", "tasks.md"} {
		path := filepath.Join(source, file)
		if _, err := os.Stat(path); err != nil {
			b.missing = append(b.missing, path)
			continue
		}
		b.copy(workspace, specPath(slug, file), path)
	}
}

// case builds a case that runs in the workspace.
func (b *corpusBuilder) newCase(name string, workspace string, arguments []string) validateCase {
	b.t.Helper()
	return validateCase{
		name:      name,
		args:      arguments,
		cwd:       workspace,
		workspace: workspace,
		files:     b.collect(workspace),
	}
}

// collect returns the content of every file of the workspace, relative to the
// workspace root.
func (b *corpusBuilder) collect(workspace string) []workspaceFile {
	b.t.Helper()

	if files, ok := b.files[workspace]; ok {
		return files
	}

	files := []workspaceFile{}
	err := filepath.WalkDir(workspace, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		relative, err := filepath.Rel(workspace, path)
		if err != nil {
			return err
		}
		if relative == "." {
			return nil
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}

		file := workspaceFile{Path: filepath.ToSlash(relative), Mode: uint32(info.Mode().Perm())}

		switch {
		case entry.Type()&fs.ModeSymlink != 0:
			target, err := os.Readlink(path)
			if err != nil {
				return err
			}
			file.Link = target
		case entry.IsDir():
			file.Dir = true
		default:
			content, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			if isTextContent(content) {
				file.Content = string(content)
			} else {
				file.Binary = true
				file.Base64 = encodeBase64(content)
			}
		}

		files = append(files, file)
		return nil
	})
	if err != nil {
		b.t.Fatalf("cannot collect the files of %s: %v", workspace, err)
	}

	b.files[workspace] = files
	return files
}

// specPath returns the path of an artifact of a spec, relative to the
// workspace root.
func specPath(slug string, file string) string {
	return filepath.Join(".specs", "changes", slug, file)
}

// workspacePath returns the path of a file of the workspace, with the
// workspace placeholder.
func workspacePath(relative string) string {
	return workspaceToken + "/" + filepath.ToSlash(relative)
}

// buildCorpus assembles the differential corpus.
//
// It also returns the sources it could not use, so the caller can tell a
// corpus that shrank from one that always covered the same ground.
func buildCorpus(t *testing.T, root string) ([]validateCase, []string) {
	t.Helper()

	builder := newCorpusBuilder(t)
	cases := []validateCase{}

	specDir := filepath.Join(root, ".specs", "changes", "go-rewrite-universal-agents")
	slug := "go-rewrite-universal-agents"

	for _, format := range []string{"text", "json"} {
		workspace := builder.workspace("repo-" + format)
		builder.copySpec(workspace, slug, specDir)

		cases = append(cases,
			builder.newCase("repo-requirements-"+format, workspace, []string{"requirements", workspacePath(specPath(slug, "requirements.md")), "--format", format}),
			builder.newCase("repo-design-"+format, workspace, []string{"design", workspacePath(specPath(slug, "design.md")), "--requirements", workspacePath(specPath(slug, "requirements.md")), "--format", format}),
			builder.newCase("repo-tasks-"+format, workspace, []string{"tasks", workspacePath(specPath(slug, "tasks.md")), "--design", workspacePath(specPath(slug, "design.md")), "--requirements", workspacePath(specPath(slug, "requirements.md")), "--format", format}),
			builder.newCase("repo-spec-"+format, workspace, []string{"spec", slug, "--target-dir", workspaceToken, "--format", format}),
			builder.newCase("repo-structure-"+format, workspace, []string{"structure", slug, "--target-dir", workspaceToken, "--format", format}),
			builder.newCase("repo-all-"+format, workspace, []string{"all", "--target-dir", workspaceToken, "--format", format}),
			builder.newCase("repo-relative-requirements-"+format, workspace, []string{"requirements", filepath.ToSlash(specPath(slug, "requirements.md")), "--format", format}),
		)
	}

	// The fixtures of the oracle test suite.
	fixtures := filepath.Join(root, "packages", "test-utils", "src", "fixtures", "fixtures")
	for _, fixture := range []string{"valid-complete-spec", "invalid-missing-files", "invalid-ears-syntax", "invalid-traceability"} {
		directory := filepath.Join(fixtures, fixture)
		for _, file := range []string{"requirements.md", "design.md", "tasks.md"} {
			path := filepath.Join(directory, file)
			if _, err := os.Stat(path); err != nil {
				builder.missing = append(builder.missing, path)
				continue
			}
			for _, format := range []string{"text", "json"} {
				relative := filepath.Join("fixtures", fixture, file)
				workspace := builder.workspace("fixture-" + fixture + "-" + file + "-" + format)
				builder.copy(workspace, relative, path)
				cases = append(cases, builder.newCase(
					"fixture-"+fixture+"-"+file+"-"+format,
					workspace,
					[]string{strings.TrimSuffix(file, ".md"), workspacePath(relative), "--format", format},
				))
			}
		}
	}

	// The reference templates of the oracle.
	templates := filepath.Join(root, "packages", "cli", "templates", "universal", "skills", "agent-work-auditor", "artifacts")
	for _, file := range []string{"requirements.md", "design.md", "tasks.md"} {
		path := filepath.Join(templates, file)
		if _, err := os.Stat(path); err != nil {
			builder.missing = append(builder.missing, path)
			continue
		}
		for _, format := range []string{"text", "json"} {
			relative := filepath.Join("artifacts", file)
			workspace := builder.workspace("template-" + file + "-" + format)
			builder.copy(workspace, relative, path)
			cases = append(cases, builder.newCase(
				"template-"+file+"-"+format,
				workspace,
				[]string{strings.TrimSuffix(file, ".md"), workspacePath(relative), "--format", format},
			))
		}
	}

	cases = append(cases, buildLineEndingCorpus(t, builder, root)...)
	cases = append(cases, buildMutationCorpus(t, builder, specDir)...)
	cases = append(cases, buildBriefCorpus(t, builder)...)
	cases = append(cases, buildAggregateCorpus(t, builder)...)
	cases = append(cases, buildUsageCorpus(t, builder, specDir)...)

	return cases, builder.missing
}

// buildMutationCorpus assembles the mutated variants of the repository spec.
func buildMutationCorpus(t *testing.T, builder *corpusBuilder, specDir string) []validateCase {
	t.Helper()
	cases := []validateCase{}

	requirements := filepath.Join(specDir, "requirements.md")
	design := filepath.Join(specDir, "design.md")
	tasks := filepath.Join(specDir, "tasks.md")

	type mutation struct {
		name   string
		mutate func(directory string)
	}

	mutations := []mutation{
		{"missing-design", func(directory string) {
			os.Remove(filepath.Join(directory, "design.md"))
		}},
		{"missing-requirements", func(directory string) {
			os.Remove(filepath.Join(directory, "requirements.md"))
		}},
		{"missing-tasks", func(directory string) {
			os.Remove(filepath.Join(directory, "tasks.md"))
		}},
		{"wrong-req-number", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "requirements.md"), "### REQ-3:", "### REQ-30:")
		}},
		{"criterion-number-mismatch", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "requirements.md"), "1.2 THE `sds` CLI SHALL expose", "1.7 THE `sds` CLI SHALL expose")
		}},
		{"non-ears-criterion", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "requirements.md"), "SHALL execute as a compiled native binary", "must execute as a compiled native binary")
		}},
		{"two-shalls", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "requirements.md"),
				"SHALL execute as a compiled native binary that requires no Node.js runtime and no runtime package dependency.",
				"SHALL execute as a compiled native binary SHALL that requires no Node.js runtime and no runtime package dependency.")
		}},
		{"criterion-without-period", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "requirements.md"),
				"SHALL execute as a compiled native binary that requires no Node.js runtime and no runtime package dependency.",
				"SHALL execute as a compiled native binary that requires no Node.js runtime and no runtime package dependency")
		}},
		{"no-req-ids", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "requirements.md"), "### REQ-1:", "### Requirement One:")
		}},
		{"empty-glossary", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "requirements.md"),
				"| Term | Definition |\n|------|------------|\n| Artifact root |",
				"| Term | Definition |\n|------|------------|\n| Empty |")
		}},
		{"broken-mermaid-fence", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "design.md"), "```mermaid\n", "```mermaid-broken\n")
		}},
		{"unclosed-mermaid-fence", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "design.md"), "```mermaid\nflowchart TD", "```mermaid\nflowchart TD\n")
		}},
		{"missing-implements-link", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "design.md"),
				"_Implements: REQ-1.1, REQ-1.2, REQ-1.9, REQ-4.6, REQ-6.1, REQ-6.2_",
				"Implements: REQ-1.1, REQ-1.2, REQ-1.9, REQ-4.6, REQ-6.1, REQ-6.2")
		}},
		{"invalid-requirement-reference", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "design.md"),
				"_Implements: REQ-1.1, REQ-1.2, REQ-1.9, REQ-4.6, REQ-6.1, REQ-6.2_",
				"_Implements: REQ-99.99_")
		}},
		{"exhaustive-coverage", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "design.md"), "Coverage: Representative", "Coverage: Exhaustive")
		}},
		{"invalid-coverage-value", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "design.md"), "Coverage: Representative", "Coverage: Whatever")
		}},
		{"missing-coverage-declaration", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "design.md"), "Coverage: Representative", "Coverage:")
		}},
		{"phase-out-of-range", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "tasks.md"), "## Phase 3: Subsystem Parity And Fixtures", "## Phase 9: Subsystem Parity And Fixtures")
		}},
		{"dangling-dependency", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "tasks.md"),
				"  - _Implements: DES-6, DES-7, REQ-4.2_",
				"  - _Depends: 9.9_\n  - _Implements: DES-6, DES-7, REQ-4.2_")
		}},
		{"duplicate-task-id", func(directory string) {
			replaceInPattern(t, filepath.Join(directory, "tasks.md"), taskAnchorPattern, "- [$1] 1.1 Create the Go module and CLI entry point")
		}},
		{"invalid-status-marker", func(directory string) {
			replaceInPattern(t, filepath.Join(directory, "tasks.md"), taskAnchorPattern, "- [?] 1.2 Create the Go module and CLI entry point")
		}},
		{"missing-task-traceability", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "tasks.md"),
				"  - _Implements: DES-1, REQ-1.1, REQ-1.2, REQ-1.9, REQ-4.6_",
				"  - Implements the CLI entry point.")
		}},
		{"unknown-design-element", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "tasks.md"),
				"  - _Implements: DES-1, REQ-1.1, REQ-1.2, REQ-1.9, REQ-4.6_",
				"  - _Implements: DES-99, REQ-1.1_")
		}},
		{"unknown-acceptance-criterion", func(directory string) {
			replaceInFile(t, filepath.Join(directory, "tasks.md"),
				"  - _Implements: DES-1, REQ-1.1, REQ-1.2, REQ-1.9, REQ-4.6_",
				"  - _Implements: DES-1, REQ-42.7_")
		}},
		{"empty-tasks-file", func(directory string) {
			os.WriteFile(filepath.Join(directory, "tasks.md"), []byte(""), 0o644)
		}},
		{"empty-design-file", func(directory string) {
			os.WriteFile(filepath.Join(directory, "design.md"), []byte(""), 0o644)
		}},
		{"empty-requirements-file", func(directory string) {
			os.WriteFile(filepath.Join(directory, "requirements.md"), []byte(""), 0o644)
		}},
	}

	for _, item := range mutations {
		slug := "mutated-" + item.name
		workspace := builder.workspace("mutated-" + item.name)
		directory := filepath.Join(workspace, specPath(slug, "requirements.md"))
		if err := os.MkdirAll(directory, 0o755); err != nil {
			t.Fatalf("cannot create %s: %v", directory, err)
		}
		copyFile(t, requirements, filepath.Join(directory, "requirements.md"))
		copyFile(t, design, filepath.Join(directory, "design.md"))
		copyFile(t, tasks, filepath.Join(directory, "tasks.md"))
		item.mutate(directory)

		for _, format := range []string{"text", "json"} {
			cases = append(cases,
				builder.newCase(item.name+"-requirements-"+format, workspace, []string{"requirements", workspacePath(specPath(slug, "requirements.md")), "--format", format}),
				builder.newCase(item.name+"-design-"+format, workspace, []string{"design", workspacePath(specPath(slug, "design.md")), "--requirements", workspacePath(specPath(slug, "requirements.md")), "--format", format}),
				builder.newCase(item.name+"-tasks-"+format, workspace, []string{"tasks", workspacePath(specPath(slug, "tasks.md")), "--design", workspacePath(specPath(slug, "design.md")), "--requirements", workspacePath(specPath(slug, "requirements.md")), "--format", format}),
				builder.newCase(item.name+"-spec-"+format, workspace, []string{"spec", slug, "--target-dir", workspaceToken, "--format", format}),
				builder.newCase(item.name+"-structure-"+format, workspace, []string{"structure", slug, "--target-dir", workspaceToken, "--format", format}),
			)
		}
	}

	// Structure cases that need their own directory layout.
	structures := []struct {
		name  string
		build func(directory string)
	}{
		{"no-lane-artifacts", func(directory string) {}},
		{"unexpected-files", func(directory string) {
			os.WriteFile(filepath.Join(directory, "notes.md"), []byte("notes"), 0o644)
		}},
		{"hidden-files", func(directory string) {
			os.WriteFile(filepath.Join(directory, ".notes"), []byte("hidden"), 0o644)
			os.WriteFile(filepath.Join(directory, ".DS_Store"), []byte(""), 0o644)
		}},
		{"archived-snapshots", func(directory string) {
			archive := filepath.Join(directory, ".archive")
			os.MkdirAll(archive, 0o755)
			for _, file := range []string{"brief.md", "requirements.md", "design.md", "tasks.md"} {
				os.WriteFile(filepath.Join(archive, file), []byte("inactive snapshot"), 0o644)
			}
		}},
	}

	for _, item := range structures {
		slug := "structure-" + item.name
		workspace := builder.workspace("structure-" + item.name)
		directory := filepath.Join(workspace, specPath(slug, "requirements.md"))
		if err := os.MkdirAll(directory, 0o755); err != nil {
			t.Fatalf("cannot create %s: %v", directory, err)
		}
		item.build(directory)

		for _, format := range []string{"text", "json"} {
			cases = append(cases,
				builder.newCase(item.name+"-structure-"+format, workspace, []string{"structure", slug, "--target-dir", workspaceToken, "--format", format}),
				builder.newCase(item.name+"-spec-"+format, workspace, []string{"spec", slug, "--target-dir", workspaceToken, "--format", format}),
			)
		}
	}

	return cases
}

// buildLineEndingCorpus assembles the corpus of documents that use Windows
// line endings, which the oracle treats differently from the Go regular
// expressions.
func buildLineEndingCorpus(t *testing.T, builder *corpusBuilder, root string) []validateCase {
	t.Helper()
	cases := []validateCase{}

	for _, file := range []string{"requirements.md", "design.md", "tasks.md"} {
		source := filepath.Join(root, ".specs", "changes", "go-rewrite-universal-agents", file)
		content, err := os.ReadFile(source)
		if err != nil {
			t.Fatalf("cannot read %s: %v", source, err)
		}
		converted := strings.ReplaceAll(string(content), "\n", "\r\n")
		for _, format := range []string{"text", "json"} {
			name := "crlf-" + file + "-" + format
			workspace := builder.workspace(name)
			path := filepath.Join(workspace, "crlf-"+file)
			if err := os.WriteFile(path, []byte(converted), 0o644); err != nil {
				t.Fatalf("cannot write %s: %v", path, err)
			}
			cases = append(cases, builder.newCase(name, workspace, []string{strings.TrimSuffix(file, ".md"), workspacePath("crlf-" + file), "--format", format}))
		}
	}

	// A spec slug whose path is a file instead of a directory.
	for _, format := range []string{"text", "json"} {
		name := "file-artifact-structure-" + format
		workspace := builder.workspace(name)
		fileSlug := filepath.Join(workspace, ".specs", "changes", "file-artifact")
		if err := os.MkdirAll(filepath.Dir(fileSlug), 0o755); err != nil {
			t.Fatalf("cannot create %s: %v", fileSlug, err)
		}
		if err := os.WriteFile(fileSlug, []byte("not a directory"), 0o644); err != nil {
			t.Fatalf("cannot write %s: %v", fileSlug, err)
		}
		cases = append(cases, builder.newCase(name, workspace, []string{"structure", "file-artifact", "--target-dir", workspaceToken, "--format", format}))
	}

	// A spec slug that does not exist.
	for _, format := range []string{"text", "json"} {
		name := "missing-slug-structure-" + format
		workspace := builder.workspace(name)
		cases = append(cases, builder.newCase(name, workspace, []string{"structure", "does-not-exist", "--target-dir", workspaceToken, "--format", format}))
	}

	// A spec whose requirements artifact is a directory.
	for _, format := range []string{"text", "json"} {
		name := "directory-artifact-spec-" + format
		workspace := builder.workspace(name)
		slug := "directory-artifact"
		directory := filepath.Join(workspace, specPath(slug, "requirements.md"))
		if err := os.MkdirAll(directory, 0o755); err != nil {
			t.Fatalf("cannot create %s: %v", directory, err)
		}
		cases = append(cases, builder.newCase(name, workspace, []string{"spec", slug, "--target-dir", workspaceToken, "--format", format}))
	}

	return cases
}

// buildBriefCorpus assembles the brief lane corpus.
func buildBriefCorpus(t *testing.T, builder *corpusBuilder) []validateCase {
	t.Helper()
	cases := []validateCase{}

	validBrief := `# Change Brief

**Lane:** brief

## Intent

Validate a lightweight approved plan.

## Non-Goals

- Changing full-lane validation.

## Acceptance Criteria

- REQ-1: The brief is validated before implementation.

## Repository Evidence

- Existing: ` + "`src/validate.ts`" + ` - Validation entry point.

## Implementation Plan

- [ ] 1. Validate the brief
  - Change: Add deterministic brief validation.
  - Files: ` + "`src/validate.ts`" + `
  - Verify: ` + "`pnpm test`" + `
  - _Implements: REQ-1_

## Final Verification

- ` + "`pnpm test`" + `
`

	placeholderBrief := strings.ReplaceAll(validBrief, "Validate a lightweight approved plan.", "<observable outcome>")
	unorderedBrief := strings.ReplaceAll(validBrief, "## Acceptance Criteria", "## Acceptance Criteria\n\n## Risks\n\n- A risk.")
	unsupportedBrief := strings.ReplaceAll(validBrief, "## Final Verification", "## Unknown Section\n\ntext\n\n## Final Verification")
	warningBrief := strings.ReplaceAll(validBrief, "- Verify: `pnpm test`", "- Verify: Tests pass")
	desBrief := strings.ReplaceAll(validBrief, "_Implements: REQ-1_", "_Implements: DES-1, REQ-1_")
	decimalBrief := strings.ReplaceAll(validBrief, "_Implements: REQ-1_", "_Implements: REQ-1.1_")
	missingEvidenceBrief := strings.ReplaceAll(validBrief, "- Existing: `src/validate.ts` - Validation entry point.", "- Existing: `src/other.ts` - Validation entry point.")

	briefs := []struct {
		name    string
		content string
	}{
		{"valid-brief", validBrief},
		{"placeholder-brief", placeholderBrief},
		{"unordered-brief", unorderedBrief},
		{"unsupported-section-brief", unsupportedBrief},
		{"warning-brief", warningBrief},
		{"des-reference-brief", desBrief},
		{"decimal-reference-brief", decimalBrief},
		{"missing-evidence-brief", missingEvidenceBrief},
		{"empty-brief", ""},
	}

	for _, item := range briefs {
		slug := "brief-" + item.name

		for _, format := range []string{"text", "json"} {
			workspace := builder.workspace("brief-" + item.name + "-" + format)
			directory := filepath.Join(workspace, ".specs", "changes", slug)
			if err := os.MkdirAll(directory, 0o755); err != nil {
				t.Fatalf("cannot create %s: %v", directory, err)
			}
			if err := os.WriteFile(filepath.Join(directory, "brief.md"), []byte(item.content), 0o644); err != nil {
				t.Fatalf("cannot write the brief: %v", err)
			}

			cases = append(cases,
				builder.newCase(item.name+"-brief-"+format, workspace, []string{"brief", workspacePath(specPath(slug, "brief.md")), "--format", format}),
				builder.newCase(item.name+"-spec-"+format, workspace, []string{"spec", slug, "--target-dir", workspaceToken, "--format", format}),
				builder.newCase(item.name+"-structure-"+format, workspace, []string{"structure", slug, "--target-dir", workspaceToken, "--format", format}),
			)
		}
	}

	// A directory that mixes both lanes.
	for _, format := range []string{"text", "json"} {
		name := "mixed-lane-" + format
		workspace := builder.workspace(name)
		mixed := filepath.Join(workspace, ".specs", "changes", "mixed-lane")
		if err := os.MkdirAll(mixed, 0o755); err != nil {
			t.Fatalf("cannot create %s: %v", mixed, err)
		}
		if err := os.WriteFile(filepath.Join(mixed, "brief.md"), []byte(validBrief), 0o644); err != nil {
			t.Fatalf("cannot write the brief: %v", err)
		}
		if err := os.WriteFile(filepath.Join(workspace, specPath("mixed-lane", "requirements.md")), []byte(""), 0o644); err != nil {
			t.Fatalf("cannot write the requirements: %v", err)
		}

		cases = append(cases,
			builder.newCase("mixed-lane-structure-"+format, workspace, []string{"structure", "mixed-lane", "--target-dir", workspaceToken, "--format", format}),
			builder.newCase("mixed-lane-spec-"+format, workspace, []string{"spec", "mixed-lane", "--target-dir", workspaceToken, "--format", format}),
		)
	}

	return cases
}

// buildAggregateCorpus assembles the corpus of the aggregate validator.
func buildAggregateCorpus(t *testing.T, builder *corpusBuilder) []validateCase {
	t.Helper()
	cases := []validateCase{}

	for _, format := range []string{"text", "json"} {
		name := "all-empty-" + format
		workspace := builder.workspace(name)
		empty := filepath.Join(workspace, "empty")
		if err := os.MkdirAll(filepath.Join(empty, ".specs", "changes"), 0o755); err != nil {
			t.Fatalf("cannot create the empty project: %v", err)
		}
		cases = append(cases, builder.newCase(name, workspace, []string{"all", "--target-dir", workspacePath("empty"), "--format", format}))
	}

	for _, format := range []string{"text", "json"} {
		name := "all-missing-directory-" + format
		workspace := builder.workspace(name)
		cases = append(cases, builder.newCase(name, workspace, []string{"all", "--target-dir", workspacePath("missing"), "--format", format}))
	}

	// A git repository with a spec, to exercise the --changed option.
	for _, format := range []string{"text", "json"} {
		workspace := builder.workspace("all-git-" + format)
		repository := filepath.Join(workspace, "repository")
		if err := os.MkdirAll(filepath.Join(repository, ".specs", "changes", "git-spec"), 0o755); err != nil {
			t.Fatalf("cannot create the repository: %v", err)
		}
		if err := os.WriteFile(filepath.Join(repository, ".specs", "changes", "git-spec", "brief.md"), []byte("nonsense"), 0o644); err != nil {
			t.Fatalf("cannot write the brief: %v", err)
		}
		git(t, repository, "init", "-q")
		git(t, repository, "-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-q", "--allow-empty", "-m", "init")

		// The case that hides the git executable from both implementations.
		missing := builder.newCase("all-git-missing-"+format, workspace, []string{"all", "--target-dir", workspacePath("repository"), "--changed", "HEAD", "--format", format})
		missing.env = []string{"PATH=/nonexistent"}

		cases = append(cases,
			missing,
			builder.newCase("all-git-head-"+format, workspace, []string{"all", "--target-dir", workspacePath("repository"), "--changed", "HEAD", "--format", format}),
			builder.newCase("all-git-unknown-ref-"+format, workspace, []string{"all", "--target-dir", workspacePath("repository"), "--changed", "does-not-exist", "--format", format}),
			builder.newCase("all-git-directory-"+format, workspace, []string{"all", "--target-dir", workspacePath("repository"), "--format", format}),
		)
	}

	return cases
}

// buildUsageCorpus assembles the corpus of the usage failures.
func buildUsageCorpus(t *testing.T, builder *corpusBuilder, specDir string) []validateCase {
	t.Helper()
	cases := []validateCase{}

	workspace := builder.workspace("usage-missing-path")
	cases = append(cases, builder.newCase("usage-missing-path", workspace, []string{"requirements"}))

	workspace = builder.workspace("usage-missing-slug")
	cases = append(cases, builder.newCase("usage-missing-slug", workspace, []string{"spec"}))

	workspace = builder.workspace("usage-missing-file")
	cases = append(cases, builder.newCase("usage-missing-file", workspace, []string{"requirements", workspacePath("does-not-exist.md")}))

	workspace = builder.workspace("usage-missing-design-file")
	cases = append(cases, builder.newCase("usage-missing-design-file", workspace, []string{"design", workspacePath("does-not-exist.md")}))

	workspace = builder.workspace("usage-missing-requirements-file")
	builder.copySpec(workspace, "go-rewrite-universal-agents", specDir)
	cases = append(cases, builder.newCase("usage-missing-requirements-file", workspace, []string{"design", workspacePath(specPath("go-rewrite-universal-agents", "design.md")), "--requirements", workspacePath("does-not-exist.md")}))

	workspace = builder.workspace("usage-missing-spec")
	cases = append(cases, builder.newCase("usage-missing-spec", workspace, []string{"spec", "does-not-exist", "--target-dir", workspaceToken}))

	return cases
}

// copyFile copies a file.
func copyFile(t *testing.T, source string, destination string) {
	t.Helper()
	content, err := os.ReadFile(source)
	if err != nil {
		t.Fatalf("cannot read %s: %v", source, err)
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		t.Fatalf("cannot create %s: %v", filepath.Dir(destination), err)
	}
	if err := os.WriteFile(destination, content, 0o644); err != nil {
		t.Fatalf("cannot write %s: %v", destination, err)
	}
}

// replaceInFile replaces a substring of a file.
func replaceInFile(t *testing.T, path string, old string, replacement string) {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("cannot read %s: %v", path, err)
	}
	if !strings.Contains(string(content), old) {
		t.Fatalf("the mutation anchor %q is missing in %s", old, path)
	}
	updated := strings.Replace(string(content), old, replacement, 1)
	if err := os.WriteFile(path, []byte(updated), 0o644); err != nil {
		t.Fatalf("cannot write %s: %v", path, err)
	}
}

// taskAnchorPattern matches the task line of the corpus. The pattern keeps
// the mutation anchors of the corpus stable when the status marker of the
// task changes.
var taskAnchorPattern = regexp.MustCompile(`- \[([ xX])\] 1\.2 Create the Go module and CLI entry point`)

// replaceInPattern replaces the first match of a pattern in a file.
func replaceInPattern(t *testing.T, path string, pattern *regexp.Regexp, replacement string) {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("cannot read %s: %v", path, err)
	}
	if !pattern.Match(content) {
		t.Fatalf("the mutation anchor %q is missing in %s", pattern.String(), path)
	}
	updated := pattern.ReplaceAll(content, []byte(replacement))
	if err := os.WriteFile(path, updated, 0o644); err != nil {
		t.Fatalf("cannot write %s: %v", path, err)
	}
}

// gitCommitDate is the fixed date of the commits of the corpus. The date is
// fixed because it reaches the content of the git repository: the commit
// object, the reference and the reflog of the commit carry it. A fixed date
// keeps the captured fixtures of the git cases deterministic.
const gitCommitDate = "2024-01-01T00:00:00+00:00"

// git runs a git command in a directory.
func git(t *testing.T, directory string, arguments ...string) {
	t.Helper()
	command := exec.Command("git", arguments...)
	command.Dir = directory
	command.Env = append(os.Environ(),
		"GIT_AUTHOR_DATE="+gitCommitDate,
		"GIT_COMMITTER_DATE="+gitCommitDate,
	)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v: %s", arguments, err, output)
	}
}
