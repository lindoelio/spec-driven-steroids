package cleanup

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/manifest"
)

// install writes a manifest that claims a file, and the file itself.
func install(t *testing.T, store *manifest.Store, m *manifest.Manifest, path, content string, claims ...string) string {
	t.Helper()
	writeFile(t, path, content)
	digest, err := manifest.HashFile(path)
	if err != nil {
		t.Fatalf("hash %s: %v", path, err)
	}
	m.Files = append(m.Files, manifest.InstalledFile{
		Path:              path,
		SHA256:            digest,
		ClaimingPlatforms: claims,
	})
	if _, err := store.Write(m); err != nil {
		t.Fatalf("write the manifest: %v", err)
	}
	return path
}

// TestACleanOfAPlatformThatWasNeverInstalledKeepsTheCanonicalTree checks that
// a platform-scoped cleanup of a platform that holds no installation removes
// nothing.
//
// The canonical manifest records the artifact root, not the installation of a
// platform. A lookup that fell back to it would remove the artifact root on
// behalf of a platform that was never installed.
func TestACleanOfAPlatformThatWasNeverInstalledKeepsTheCanonicalTree(t *testing.T) {
	workDir := t.TempDir()
	homeDir := t.TempDir()
	env := testEnv(workDir, homeDir)
	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}

	artifactRoot := filepath.Join(workDir, ".agents")
	store := manifest.NewStore(filepath.Join(homeDir, "config", "installs"))

	canonical := filepath.Join(artifactRoot, "skills", "spec-driven-planner", "SKILL.md")
	install(t, store, &manifest.Manifest{
		Version:     manifest.FormatVersion,
		Platform:    "canonical",
		Kind:        manifest.KindCanonical,
		Scope:       "project",
		Root:        artifactRoot,
		SkillsRoot:  filepath.Join(artifactRoot, "skills"),
		ProjectRoot: artifactRoot,
	}, canonical, "the canonical body")

	result, err := CleanScope(store, registry, env, "project", "qoder", artifactRoot, manifest.CleanOptions{})
	if err != nil {
		t.Fatalf("clean the scope: %v", err)
	}
	if len(result.Removed) != 0 {
		t.Errorf("the cleanup removed %v, want nothing", result.Removed)
	}
	if _, err := os.Stat(canonical); err != nil {
		t.Errorf("the canonical artifact was removed: %v", err)
	}
}

// TestAScopeWideCleanupRemovesEveryPlatformOfTheScope checks that a cleanup
// without a platform removes the platform artifacts too.
//
// The command promises to clean every platform of the scope.
func TestAScopeWideCleanupRemovesEveryPlatformOfTheScope(t *testing.T) {
	workDir := t.TempDir()
	homeDir := t.TempDir()
	env := testEnv(workDir, homeDir)
	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}

	artifactRoot := filepath.Join(workDir, ".agents")
	store := manifest.NewStore(filepath.Join(homeDir, "config", "installs"))

	canonical := filepath.Join(artifactRoot, "skills", "spec-driven-planner", "SKILL.md")
	install(t, store, &manifest.Manifest{
		Version:     manifest.FormatVersion,
		Platform:    "canonical",
		Kind:        manifest.KindCanonical,
		Scope:       "project",
		Root:        artifactRoot,
		SkillsRoot:  filepath.Join(artifactRoot, "skills"),
		ProjectRoot: artifactRoot,
	}, canonical, "the canonical body", "claudecode", "codex")

	for _, platform := range []string{"claudecode", "codex"} {
		root := filepath.Join(workDir, "."+platform)
		install(t, store, &manifest.Manifest{
			Version:     manifest.FormatVersion,
			Platform:    platform,
			Kind:        manifest.KindPlatform,
			Scope:       "project",
			Root:        root,
			SkillsRoot:  filepath.Join(root, "skills"),
			ProjectRoot: artifactRoot,
		}, filepath.Join(root, "skills", "spec-driven-planner", "SKILL.md"), "the platform body", platform)
	}

	result, err := CleanScope(store, registry, env, "project", "", artifactRoot, manifest.CleanOptions{})
	if err != nil {
		t.Fatalf("clean the scope: %v", err)
	}
	if len(result.Removed) != 3 {
		t.Errorf("the cleanup removed %d file(s), want 3: %v", len(result.Removed), result.Removed)
	}
	if _, err := os.Stat(canonical); !os.IsNotExist(err) {
		t.Errorf("the canonical artifact survived the cleanup: %v", err)
	}
	manifests, err := store.List()
	if err != nil {
		t.Fatalf("list the manifests: %v", err)
	}
	if len(manifests) != 0 {
		t.Errorf("%d manifest(s) survived the cleanup", len(manifests))
	}
}

// TestTheLegacyScanNeverTouchesTheArtifactRoot checks that the legacy scan
// leaves the artifact root alone.
//
// The artifact root belongs to the canonical tree. A previous release that
// installed a platform there shares the paths with the canonical tree, so a
// scan that treated it as a platform directory would remove the current
// artifacts.
func TestTheLegacyScanNeverTouchesTheArtifactRoot(t *testing.T) {
	workDir := t.TempDir()
	homeDir := t.TempDir()
	env := testEnv(workDir, homeDir)
	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}

	artifactRoot := filepath.Join(workDir, ".agents")
	canonical := filepath.Join(artifactRoot, "skills", "agent-work-auditor", "SKILL.md")
	writeFile(t, canonical, "the canonical body")

	result, err := Scan(Options{
		Registry:     registry,
		Env:          env,
		Scope:        "project",
		ArtifactRoot: artifactRoot,
	})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if len(result.Candidates) != 0 {
		t.Errorf("the scan reported %v as a legacy candidate", result.Candidates)
	}
	if _, err := os.Stat(canonical); err != nil {
		t.Errorf("the canonical artifact was removed: %v", err)
	}
}
