package manifest

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("create %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func TestTheLegacyUserScopeKeyIsTheLiteralGlobal(t *testing.T) {
	if got := LegacyPlatformFileName("claudecode", "global", ""); got != "claudecode-global-global.json" {
		t.Errorf("the legacy user scope key resolved to %q", got)
	}
	if got := PlatformFileName("claudecode", "global", "/work/.agents"); got != "claudecode-global-global.json" {
		t.Errorf("the current user scope key resolved to %q", got)
	}
}

func TestTheLegacyProjectScopeKeyHashesThePlatformRoot(t *testing.T) {
	legacyRoot := "/work/.github"
	want := "github-vscode-project-" + Hash(legacyRoot) + ".json"

	if got := LegacyPlatformFileName("github-vscode", "project", legacyRoot); got != want {
		t.Errorf("the legacy project scope key resolved to %q, want %q", got, want)
	}
}

func TestTheCurrentProjectScopeKeyHashesTheArtifactRoot(t *testing.T) {
	want := "claudecode-project-" + Hash("/work/.agents") + ".json"

	if got := PlatformFileName("claudecode", "project", "/work/.agents"); got != want {
		t.Errorf("the current project scope key resolved to %q, want %q", got, want)
	}
}

func TestTheCanonicalManifestHasItsOwnName(t *testing.T) {
	if got := CanonicalFileName("project", "/work/.agents"); got != "canonical-project-"+Hash("/work/.agents")+".json" {
		t.Errorf("the canonical manifest name resolved to %q", got)
	}
}

func TestTheManifestWrittenByThePreviousReleaseIsFoundAndRead(t *testing.T) {
	dir := t.TempDir()
	store := NewStore(dir)

	legacyRoot := "/work/.github"
	name := LegacyPlatformFileName("github-vscode", "project", legacyRoot)
	writeFile(t, filepath.Join(dir, name), `{"version":1,"platform":"github-vscode","scope":"project","root":"`+legacyRoot+`","skillsRoot":"`+legacyRoot+`/skills","cliVersion":"0.23.0","templateVersion":"0.23.0","installedAt":"2026-01-01T00:00:00.000Z","files":[]}`)

	found, resolvedName, ok := store.Resolve("project", "/work/.agents", "github-vscode", []string{name})
	if !ok {
		t.Fatal("the legacy manifest was not found")
	}
	if resolvedName != name {
		t.Errorf("the manifest resolved to %q, want %q", resolvedName, name)
	}
	if found.Platform != "github-vscode" || found.Scope != "project" {
		t.Errorf("the manifest read back as %+v", found)
	}
}

func TestTheCurrentKeyIsProbedBeforeTheLegacyKey(t *testing.T) {
	dir := t.TempDir()
	store := NewStore(dir)

	current := PlatformFileName("claudecode", "project", "/work/.agents")
	legacy := LegacyPlatformFileName("claudecode", "project", "/work/.claude")
	writeFile(t, filepath.Join(dir, current), `{"version":1,"platform":"claudecode","scope":"project","root":"/work/.agents","files":[]}`)
	writeFile(t, filepath.Join(dir, legacy), `{"version":1,"platform":"claudecode","scope":"project","root":"/work/.claude","files":[]}`)

	_, resolvedName, ok := store.Resolve("project", "/work/.agents", "claudecode", []string{legacy})
	if !ok {
		t.Fatal("the manifest was not found")
	}
	if resolvedName != current {
		t.Errorf("the manifest resolved to %q, want the current key %q", resolvedName, current)
	}
}

func TestAManifestWithoutTheClaimListClaimsItsOwnPaths(t *testing.T) {
	m := &Manifest{Version: 1, Platform: "claudecode"}
	claims := m.Claims(InstalledFile{Path: "/work/.agents/skills/x/SKILL.md"})
	if len(claims) != 1 || claims[0] != "claudecode" {
		t.Errorf("a version 1 manifest claims %v", claims)
	}

	m.Files = []InstalledFile{{Path: "/a", SHA256: "x", ClaimingPlatforms: []string{"a", "b"}}}
	claims = m.Claims(m.Files[0])
	if len(claims) != 2 {
		t.Errorf("a manifest with a claim list claims %v", claims)
	}
}

func TestCleanupRemovesOnlyWhatTheManifestClaims(t *testing.T) {
	dir := t.TempDir()
	root := filepath.Join(dir, "root")

	tracked := filepath.Join(root, "agents", "spec-driven.md")
	writeFile(t, tracked, "tracked")
	unrelated := filepath.Join(root, "agents", "other.md")
	writeFile(t, unrelated, "unrelated")

	digest, err := HashFile(tracked)
	if err != nil {
		t.Fatalf("hash the tracked file: %v", err)
	}

	m := &Manifest{Version: 1, Platform: "claudecode", Scope: "project", Root: root, Files: []InstalledFile{{Path: tracked, SHA256: digest}}}

	result, err := Clean(m, CleanOptions{})
	if err != nil {
		t.Fatalf("clean: %v", err)
	}
	if len(result.Removed) != 1 || result.Removed[0] != tracked {
		t.Errorf("the cleanup removed %v", result.Removed)
	}
	if _, err := os.Stat(unrelated); err != nil {
		t.Error("the unrelated file was removed")
	}
}

func TestAModifiedFileIsPreserved(t *testing.T) {
	dir := t.TempDir()
	root := filepath.Join(dir, "root")
	tracked := filepath.Join(root, "agents", "spec-driven.md")
	writeFile(t, tracked, "changed by the user")

	m := &Manifest{Version: 1, Platform: "claudecode", Scope: "project", Root: root, Files: []InstalledFile{{Path: tracked, SHA256: "a-different-digest"}}}

	result, err := Clean(m, CleanOptions{})
	if err != nil {
		t.Fatalf("clean: %v", err)
	}
	if len(result.Skipped) != 1 {
		t.Errorf("the cleanup skipped %v", result.Skipped)
	}
	if _, err := os.Stat(tracked); err != nil {
		t.Error("the modified file was removed")
	}

	forced, err := Clean(m, CleanOptions{Force: true})
	if err != nil {
		t.Fatalf("forced clean: %v", err)
	}
	if len(forced.Removed) != 1 {
		t.Errorf("the forced cleanup removed %v", forced.Removed)
	}
}

func TestAPathAnotherManifestClaimsIsNeverRemoved(t *testing.T) {
	dir := t.TempDir()
	root := filepath.Join(dir, "root")
	shared := filepath.Join(root, "skills", "shared", "SKILL.md")
	writeFile(t, shared, "shared")

	digest, _ := HashFile(shared)
	owner := &Manifest{Version: 1, Platform: "claudecode", Scope: "project", Root: root, Files: []InstalledFile{{Path: shared, SHA256: digest, ClaimingPlatforms: []string{"claudecode"}}}}
	other := &Manifest{Version: 1, Platform: "codex", Scope: "project", Root: root, Files: []InstalledFile{{Path: shared, SHA256: digest, ClaimingPlatforms: []string{"codex"}}}}

	result, err := Clean(owner, CleanOptions{Others: []*Manifest{other}})
	if err != nil {
		t.Fatalf("clean: %v", err)
	}
	if len(result.Removed) != 0 {
		t.Errorf("the cleanup removed %v although another manifest claims it", result.Removed)
	}
	if len(result.Retained) != 1 {
		t.Errorf("the cleanup retained %v", result.Retained)
	}
	if _, err := os.Stat(shared); err != nil {
		t.Error("the shared file was removed")
	}
}

func TestTheParentRemovalStopsAtTheOwningDirectory(t *testing.T) {
	dir := t.TempDir()
	root := filepath.Join(dir, "root")
	tracked := filepath.Join(root, "agents", "spec-driven.md")
	writeFile(t, tracked, "tracked")

	digest, _ := HashFile(tracked)
	m := &Manifest{Version: 1, Platform: "claudecode", Scope: "project", Root: root, Files: []InstalledFile{{Path: tracked, SHA256: digest}}}

	if _, err := Clean(m, CleanOptions{}); err != nil {
		t.Fatalf("clean: %v", err)
	}
	if _, err := os.Stat(root); err != nil {
		t.Error("the owning directory was removed")
	}
}

func TestTheDryRunReturnsTheSameResultWithoutWriting(t *testing.T) {
	dir := t.TempDir()
	root := filepath.Join(dir, "root")
	tracked := filepath.Join(root, "agents", "spec-driven.md")
	writeFile(t, tracked, "tracked")

	digest, _ := HashFile(tracked)
	m := &Manifest{Version: 1, Platform: "claudecode", Scope: "project", Root: root, Files: []InstalledFile{{Path: tracked, SHA256: digest}}}

	result, err := Clean(m, CleanOptions{DryRun: true})
	if err != nil {
		t.Fatalf("dry run: %v", err)
	}
	if len(result.Removed) != 1 {
		t.Errorf("the dry run removed %v", result.Removed)
	}
	if _, err := os.Stat(tracked); err != nil {
		t.Error("the dry run removed the file")
	}
}

// TestTheStoreLockIsExclusive checks that a second writer waits for the lock
// instead of reading and writing the manifests at the same time.
func TestTheStoreLockIsExclusive(t *testing.T) {
	store := NewStore(t.TempDir())

	release, err := store.Lock()
	if err != nil {
		t.Fatalf("lock the store: %v", err)
	}
	defer release()

	acquired := make(chan error, 1)
	go func() {
		second, err := store.Lock()
		if err == nil {
			second()
		}
		acquired <- err
	}()

	select {
	case err := <-acquired:
		t.Fatalf("the second writer acquired the lock while it was held: %v", err)
	case <-time.After(200 * time.Millisecond):
	}

	release()
	select {
	case err := <-acquired:
		if err != nil {
			t.Fatalf("the second writer failed to acquire the released lock: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the second writer did not acquire the released lock")
	}
}

// TestTheStoreLockIsReleasedWhenTheOperationPanics checks that a failed
// operation does not leave the store locked.
func TestTheStoreLockIsReleasedWhenTheOperationFails(t *testing.T) {
	store := NewStore(t.TempDir())

	if err := store.WithWriteLock(func() error { return errors.New("the operation failed") }); err == nil {
		t.Fatal("the operation error was not returned")
	}

	if _, err := os.Stat(filepath.Join(store.Dir, writeLockName)); !os.IsNotExist(err) {
		t.Errorf("the lock file survived the failed operation: %v", err)
	}
}
