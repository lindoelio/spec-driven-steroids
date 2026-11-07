package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lindoelio/spec-driven-steroids/internal/manifest"
)

// TestTheProjectScopeSelectsThePlatformManifests checks that the commands
// that select the manifests of the project scope find the platform manifests.
//
// A platform manifest records the root of its own platform directory, which
// is a sibling of the artifact root. Binding the selection to the artifact
// root would drop every platform manifest, and the uninstall command would
// report that there is nothing to remove.
func TestTheProjectScopeSelectsThePlatformManifests(t *testing.T) {
	project := t.TempDir()
	state := t.TempDir()

	previous, err := os.Getwd()
	if err != nil {
		t.Fatalf("resolve the working directory: %v", err)
	}
	if err := os.Chdir(project); err != nil {
		t.Fatalf("enter the project directory: %v", err)
	}
	defer func() {
		if err := os.Chdir(previous); err != nil {
			t.Fatalf("restore the working directory: %v", err)
		}
	}()
	t.Setenv("SDS_CONFIG_DIR", state)

	platformRoot := filepath.Join(project, ".claude")
	installed := filepath.Join(platformRoot, "skills", "spec-driven-planner", "SKILL.md")
	if err := os.MkdirAll(filepath.Dir(installed), 0o755); err != nil {
		t.Fatalf("create the installed directory: %v", err)
	}
	if err := os.WriteFile(installed, []byte("# planner\n"), 0o644); err != nil {
		t.Fatalf("write the installed file: %v", err)
	}

	digest, err := manifest.HashFile(installed)
	if err != nil {
		t.Fatalf("hash the installed file: %v", err)
	}

	store := manifest.NewStore(filepath.Join(state, "installs"))
	if _, err := store.Write(&manifest.Manifest{
		Version:    manifest.FormatVersion,
		Platform:   "claudecode",
		Kind:       manifest.KindPlatform,
		Scope:      "project",
		Root:       platformRoot,
		SkillsRoot: filepath.Join(platformRoot, "skills"),
		Files: []manifest.InstalledFile{
			{Path: installed, SHA256: digest, ClaimingPlatforms: []string{"claudecode"}},
		},
	}); err != nil {
		t.Fatalf("write the manifest: %v", err)
	}

	program := NewProgram()
	var written strings.Builder
	program.SetOut(&written)
	program.SetErr(&written)

	if err := program.Parse([]string{"uninstall", "--platform", "claudecode", "--project", "--yes"}); err != nil {
		t.Fatalf("parse: %v", err)
	}

	if _, err := os.Stat(installed); !os.IsNotExist(err) {
		t.Errorf("the installed file was not removed: %v", err)
	}
	if strings.Contains(written.String(), "No project install manifests found") {
		t.Errorf("the command reported that there was nothing to remove:\n%s", written.String())
	}
}
