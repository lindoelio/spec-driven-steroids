package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestTheInjectedArtifactsAreRegularFilesInsideTheDeclaredRoots checks the
// properties the injected files have to hold.
//
// The emitter hands over paths and bytes, so the writing is where a symbolic
// link or a path outside the declared roots would appear.
func TestTheInjectedArtifactsAreRegularFilesInsideTheDeclaredRoots(t *testing.T) {
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

	program := NewProgram()
	var written strings.Builder
	program.SetOut(&written)
	program.SetErr(&written)

	if err := program.Parse([]string{"inject", "--platform", "claudecode", "--scope", "project", "--yes"}); err != nil {
		t.Fatalf("parse: %v", err)
	}

	root := filepath.Join(project, ".agents")
	allowed := []string{root, filepath.Join(project, ".claude")}

	found := 0
	err = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			t.Errorf("the injection produced a symbolic link: %s", path)
			return nil
		}
		if info.IsDir() {
			return nil
		}
		found++

		inside := false
		for _, allowedRoot := range allowed {
			if path == allowedRoot || strings.HasPrefix(path, allowedRoot+string(os.PathSeparator)) {
				inside = true
				break
			}
		}
		if !inside {
			t.Errorf("the injection wrote %q, which is outside the declared roots", path)
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		trimmed := strings.TrimSpace(string(content))
		if trimmed != "" && !strings.Contains(trimmed, "\n") && filepath.IsAbs(trimmed) {
			t.Errorf("the injection wrote a pointer file: %s", path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk the artifact root: %v", err)
	}
	if found == 0 {
		t.Fatal("the injection wrote no file")
	}
}
