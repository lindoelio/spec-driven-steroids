package cleanup

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lindoelio/spec-driven-steroids/internal/assets"
	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/manifest"
	"github.com/lindoelio/spec-driven-steroids/internal/serialize"
)

func testEnv(workDir, homeDir string) descriptor.Env {
	return descriptor.Env{Home: homeDir, WorkDir: workDir, Vars: map[string]string{}, OS: "linux"}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("create %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

// legacyAgentContent returns the content the previous release wrote for the
// agent of a platform.
func legacyAgentContent(t *testing.T, desc *descriptor.Descriptor, scope string) string {
	t.Helper()
	source, err := assets.LegacyFS().Open("agents/spec-driven.agent.md")
	if err != nil {
		t.Fatalf("read the legacy baseline: %v", err)
	}
	defer source.Close()
	content := make([]byte, 0, 4096)
	buffer := make([]byte, 4096)
	for {
		n, err := source.Read(buffer)
		content = append(content, buffer[:n]...)
		if err != nil {
			break
		}
	}

	transformation, ok := desc.LegacyTransformation(descriptor.KindAgent, scope)
	if !ok {
		t.Fatalf("the platform declares no legacy derivation for the agent")
	}
	rule, _ := desc.Rule(descriptor.KindAgent)
	result, err := serialize.Apply(serialize.Rule{
		Serialization:    transformation,
		OutputKind:       descriptor.KindAgent,
		Name:             rule.Frontmatter["name"],
		Description:      rule.Frontmatter["description"],
		AdditionalFields: rule.AdditionalFields,
		CommandAgent:     rule.CommandAgent,
	}, serialize.ParseSource(string(content)))
	if err != nil {
		t.Fatalf("derive the legacy content: %v", err)
	}
	return result.Content
}

func TestAnUnmodifiedLegacyArtifactIsRemoved(t *testing.T) {
	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}
	desc, _ := registry.Get("claudecode")

	workDir := t.TempDir()
	homeDir := t.TempDir()
	env := testEnv(workDir, homeDir)

	legacy := filepath.Join(workDir, ".claude", "agents", "spec-driven.md")
	writeFile(t, legacy, legacyAgentContent(t, desc, "project"))

	result, err := Scan(Options{Registry: registry, Env: env, Scope: "project", Platform: "claudecode"})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if len(result.Removed) != 1 {
		t.Errorf("the scan removed %v", result.Removed)
	}
	if _, err := os.Stat(legacy); err == nil {
		t.Error("the legacy artifact is still on disk")
	}
}

func TestAModifiedLegacyArtifactIsPreservedAndReported(t *testing.T) {
	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}
	desc, _ := registry.Get("claudecode")

	workDir := t.TempDir()
	homeDir := t.TempDir()
	env := testEnv(workDir, homeDir)

	legacy := filepath.Join(workDir, ".claude", "agents", "spec-driven.md")
	writeFile(t, legacy, legacyAgentContent(t, desc, "project")+"\n<!-- edited by the user -->\n")

	result, err := Scan(Options{Registry: registry, Env: env, Scope: "project", Platform: "claudecode"})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if len(result.Removed) != 0 {
		t.Errorf("the scan removed %v although the body differs", result.Removed)
	}
	if len(result.Candidates) != 1 {
		t.Fatalf("the scan reported %d candidates, want 1", len(result.Candidates))
	}
	if result.Candidates[0].Path != legacy {
		t.Errorf("the candidate is %q, want %q", result.Candidates[0].Path, legacy)
	}
	if result.Candidates[0].Matches {
		t.Error("the candidate is reported as matching")
	}
	if _, err := os.Stat(legacy); err != nil {
		t.Error("the modified legacy artifact was removed")
	}
}

func TestAPathACurrentManifestClaimsIsNeverReportedAsALegacyCandidate(t *testing.T) {
	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}
	desc, _ := registry.Get("claudecode")

	workDir := t.TempDir()
	homeDir := t.TempDir()
	env := testEnv(workDir, homeDir)

	legacy := filepath.Join(workDir, ".claude", "agents", "spec-driven.md")
	writeFile(t, legacy, legacyAgentContent(t, desc, "project"))

	claimed := &manifest.Manifest{
		Version:  1,
		Platform: "claudecode",
		Scope:    "project",
		Root:     filepath.Join(workDir, ".claude"),
		Files:    []manifest.InstalledFile{{Path: legacy, SHA256: "digest", ClaimingPlatforms: []string{"claudecode"}}},
	}

	result, err := Scan(Options{Registry: registry, Env: env, Scope: "project", Platform: "claudecode", Manifests: []*manifest.Manifest{claimed}})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if len(result.Removed) != 0 {
		t.Errorf("the scan removed %v although a manifest claims it", result.Removed)
	}
	if len(result.Candidates) != 0 {
		t.Errorf("the scan reported %v although a manifest claims them", result.Candidates)
	}
	if len(result.Skipped) != 1 {
		t.Errorf("the scan skipped %v", result.Skipped)
	}
	if _, err := os.Stat(legacy); err != nil {
		t.Error("the claimed artifact was removed")
	}
}

func TestTheLegacyKeyProbesEverySupportedPlatform(t *testing.T) {
	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}
	env := testEnv("/work", "/home/user")

	names := LegacyNames(registry, env, "project")
	if len(names) != len(registry.All()) {
		t.Errorf("the resolver probes %d names, want one per platform (%d)", len(names), len(registry.All()))
	}
	for _, name := range names {
		if filepath.Ext(name) != ".json" {
			t.Errorf("the probed name %q is not a manifest name", name)
		}
	}
}
