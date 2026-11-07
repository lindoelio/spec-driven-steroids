package emit

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
)

// oraclePath is the built TypeScript implementation, which is the behavioral
// oracle of this rewrite.
const oraclePath = "../../packages/cli/dist/cli/index.js"

// TestParityWithTypeScriptOracle compares the platform-side artifacts of the
// Go implementation with the ones the previous release writes.
//
// The comparison covers every platform and every scope that keeps the legacy
// platform directory. A platform whose root IS the artifact root is skipped,
// because the artifact root layout is the deliberate change of this rewrite.
func TestParityWithTypeScriptOracle(t *testing.T) {
	if _, err := os.Stat(oraclePath); err != nil {
		t.Skip("the TypeScript oracle is not built")
	}
	if _, err := os.Stat("../../packages/cli/node_modules"); err != nil {
		t.Skip("the TypeScript dependencies are not installed")
	}

	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load descriptors: %v", err)
	}

	for _, desc := range registry.All() {
		for _, scope := range desc.Scopes {
			t.Run(desc.ID+"/"+scope, func(t *testing.T) {
				compareWithOracle(t, registry, desc, scope)
			})
		}
	}
}

func compareWithOracle(t *testing.T, registry *descriptor.Registry, desc *descriptor.Descriptor, scope string) {
	t.Helper()

	workDir := t.TempDir()
	homeDir := t.TempDir()

	env := descriptor.Env{
		Home:    homeDir,
		WorkDir: workDir,
		Vars:    map[string]string{},
		OS:      "linux",
	}

	root, ok := registry.VariantPath(env, desc, "root", scope)
	if !ok {
		t.Fatalf("no root path variant for the %s scope", scope)
	}

	// A platform whose root is the artifact root reads the canonical tree
	// directly under the new layout.
	if root == env.WorkDir+"/.agents" || root == env.Home+"/.agents" {
		t.Skip("the platform reads the artifact root directly")
	}

	oracle, err := filepath.Abs(oraclePath)
	if err != nil {
		t.Fatalf("resolve the oracle path: %v", err)
	}
	command := exec.Command("node", oracle, "inject", "--platform", desc.ID, "--scope", scope, "--yes", "--templates", "bundled")
	command.Dir = workDir
	command.Env = append(os.Environ(),
		"HOME="+homeDir,
		"XDG_CONFIG_HOME="+filepath.Join(homeDir, ".config"),
		"XDG_CACHE_HOME="+filepath.Join(homeDir, ".cache"),
	)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("the oracle failed: %v\n%s", err, output)
	}

	expected := collect(t, root)
	skillsRoot, hasSkills := registry.VariantPath(env, desc, "skills", scope)
	if hasSkills && skillsRoot != root {
		for path, content := range collect(t, skillsRoot) {
			expected[path] = content
		}
	}
	if len(expected) == 0 {
		t.Fatalf("the oracle wrote nothing under %s", root)
	}

	plan, err := Build(desc, Options{
		Registry:     registry,
		Env:          env,
		Scope:        scope,
		ArtifactRoot: artifactRootFor(env, scope),
	})
	if err != nil {
		t.Fatalf("build the plan: %v", err)
	}

	actual := map[string][]byte{}
	for _, artifact := range plan.Platform {
		actual[artifact.Path] = artifact.Content
	}

	// The VS Code global scope flattens the prompt files into the platform
	// root, which the post-injection action does after the artifacts are
	// written.
	if scope == "global" && desc.ID == "github-vscode" {
		flattened := map[string][]byte{}
		for path, content := range actual {
			relative, err := filepath.Rel(root, path)
			if err != nil {
				flattened[path] = content
				continue
			}
			segments := strings.Split(relative, string(filepath.Separator))
			if len(segments) == 2 && (segments[0] == "agents" || segments[0] == "prompts") {
				flattened[filepath.Join(root, segments[1])] = content
				continue
			}
			flattened[path] = content
		}
		actual = flattened
	}

	var missing, extra []string
	for path := range expected {
		if _, ok := actual[path]; !ok {
			missing = append(missing, path)
		}
	}
	for path := range actual {
		if _, ok := expected[path]; !ok {
			extra = append(extra, path)
		}
	}
	sort.Strings(missing)
	sort.Strings(extra)

	if len(missing) > 0 {
		t.Errorf("the Go implementation does not write %d file(s) the oracle writes:\n%s", len(missing), strings.Join(missing, "\n"))
	}
	if len(extra) > 0 {
		t.Errorf("the Go implementation writes %d file(s) the oracle does not:\n%s", len(extra), strings.Join(extra, "\n"))
	}

	for path, want := range expected {
		got, ok := actual[path]
		if !ok {
			continue
		}
		if !bytes.Equal(want, got) {
			t.Errorf("the content of %s differs:\n--- oracle ---\n%s\n--- go ---\n%s", path, want, got)
		}
	}
}

func artifactRootFor(env descriptor.Env, scope string) string {
	if scope == "global" {
		return filepath.Join(env.Home, ".agents")
	}
	return filepath.Join(env.WorkDir, ".agents")
}

func collect(t *testing.T, root string) map[string][]byte {
	t.Helper()
	files := map[string][]byte{}
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		files[path] = content
		return nil
	})
	if err != nil {
		t.Fatalf("collect %s: %v", root, err)
	}
	return files
}
