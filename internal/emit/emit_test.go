package emit

import (
	"bytes"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/serialize"
)

func testOptions(t *testing.T, scope string) (Options, *descriptor.Registry) {
	t.Helper()
	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}
	workDir := t.TempDir()
	homeDir := t.TempDir()
	env := descriptor.Env{Home: homeDir, WorkDir: workDir, Vars: map[string]string{}, OS: "linux"}
	artifactRoot := filepath.Join(workDir, ".agents")
	if scope == "global" {
		artifactRoot = filepath.Join(homeDir, ".agents")
	}
	return Options{
		Registry:     registry,
		Env:          env,
		Scope:        scope,
		ArtifactRoot: artifactRoot,
	}, registry
}

func TestTheCanonicalTreeHoldsFourteenSkillsOneAgentAndTwoCommands(t *testing.T) {
	files, err := CanonicalTree()
	if err != nil {
		t.Fatalf("read the canonical tree: %v", err)
	}

	skills := map[string]bool{}
	agents := 0
	commands := 0
	for _, file := range files {
		switch {
		case strings.HasPrefix(file.RelPath, "skills/"):
			parts := strings.Split(file.RelPath, "/")
			if len(parts) >= 2 {
				skills[parts[1]] = true
			}
		case strings.HasPrefix(file.RelPath, "agents/"):
			agents++
		case strings.HasPrefix(file.RelPath, "commands/"):
			commands++
		}
	}

	if len(skills) != 14 {
		t.Errorf("the canonical tree holds %d skills, want 14: %v", len(skills), skills)
	}
	if agents != 1 {
		t.Errorf("the canonical tree holds %d agents, want 1", agents)
	}
	if commands != 2 {
		t.Errorf("the canonical tree holds %d commands, want 2", commands)
	}
}

// TestANativePlatformReceivesOnlyItsDerivedSkills checks that a platform
// that reads the artifact root receives no copy of the canonical tree.
//
// The canonical skills come from the artifact root itself. The agent and the
// commands the platform cannot read in their own shape are derived as skills
// beside them, and they are the only platform-side artifacts it receives.
func TestANativePlatformReceivesOnlyItsDerivedSkills(t *testing.T) {
	options, registry := testOptions(t, "project")
	desc, _ := registry.Get("antigravity")

	plan, err := Build(desc, options)
	if err != nil {
		t.Fatalf("build the plan: %v", err)
	}
	if len(plan.Canonical) == 0 {
		t.Fatal("the canonical tree is empty")
	}

	derived := []string{}
	for _, artifact := range plan.Platform {
		relative, err := filepath.Rel(options.ArtifactRoot, artifact.Path)
		if err != nil {
			t.Fatalf("relate the artifact path: %v", err)
		}
		derived = append(derived, filepath.ToSlash(relative))
	}
	sort.Strings(derived)

	expected := []string{"skills/inject-guidelines/SKILL.md", "skills/spec-driven/SKILL.md"}
	if len(derived) != len(expected) {
		t.Fatalf("the native platform received %d platform-side artifact(s) %v, want %v", len(derived), derived, expected)
	}
	for index, path := range expected {
		if derived[index] != path {
			t.Errorf("the native platform received %q, want %q", derived[index], path)
		}
	}
}

func TestACopiedArtifactIsByteIdenticalToTheCanonical(t *testing.T) {
	options, registry := testOptions(t, "project")
	desc, _ := registry.Get("claudecode")

	plan, err := Build(desc, options)
	if err != nil {
		t.Fatalf("build the plan: %v", err)
	}

	canonical := map[string][]byte{}
	for _, file := range plan.Canonical {
		canonical[file.RelPath] = file.Content
	}

	skillsRoot, ok := registry.VariantPath(options.Env, desc, "skills", options.Scope)
	if !ok {
		t.Fatal("the platform declares no skills root")
	}

	copied := 0
	for _, artifact := range plan.Platform {
		if artifact.Kind != descriptor.KindSkills {
			continue
		}
		copied++
		relative := strings.TrimPrefix(artifact.Path, skillsRoot)
		relative = strings.TrimPrefix(relative, string(filepath.Separator))
		want, ok := canonical["skills/"+filepath.ToSlash(relative)]
		if !ok {
			t.Errorf("the copied artifact %q has no canonical counterpart", artifact.Path)
			continue
		}
		if !bytes.Equal(want, artifact.Content) {
			t.Errorf("the copied artifact %q differs from the canonical bytes", artifact.Path)
		}
	}
	if copied == 0 {
		t.Error("the platform received no copied skill")
	}
}

func TestADerivedArtifactEqualsTheCanonicalBodyWithTheDeclaredSubstitutions(t *testing.T) {
	options, registry := testOptions(t, "project")
	desc, _ := registry.Get("codex")

	plan, err := Build(desc, options)
	if err != nil {
		t.Fatalf("build the plan: %v", err)
	}

	rule, ok := desc.Rule(descriptor.KindSpecDrivenCommand)
	if !ok {
		t.Fatal("the platform declares no command rule")
	}

	var derived *Artifact
	for i := range plan.Platform {
		if plan.Platform[i].Kind == descriptor.KindSpecDrivenCommand {
			derived = &plan.Platform[i]
		}
	}
	if derived == nil {
		t.Fatal("the platform received no derived command")
	}

	source := ""
	for _, file := range plan.Canonical {
		if file.RelPath == rule.Source {
			source = string(file.Content)
		}
	}
	parsed := serialize.ParseSource(source)

	body := parsed.Body
	for _, substitution := range rule.Substitutions {
		body = strings.ReplaceAll(body, substitution.From, substitution.To)
	}
	body = strings.TrimSpace(body)

	if !strings.Contains(string(derived.Content), body) {
		t.Errorf("the derived artifact does not carry the substituted body:\n%s", derived.Content)
	}
	if strings.Contains(string(derived.Content), "{{args}}") {
		t.Error("the derived artifact kept the argument placeholder")
	}
}

// TestNoPlatformSideArtifactIsAPointerFile checks that no platform-side
// artifact is a pointer to another path.
//
// A symbolic link cannot be produced by the emitter, which hands over bytes;
// the injection test of the command layer checks the written files.
func TestNoPlatformSideArtifactIsAPointerFile(t *testing.T) {
	options, registry := testOptions(t, "project")

	for _, desc := range registry.All() {
		for _, scope := range desc.Scopes {
			local := options
			local.Scope = scope
			if scope == "global" {
				local.ArtifactRoot = filepath.Join(options.Env.Home, ".agents")
			}
			plan, err := Build(desc, local)
			if err != nil {
				t.Fatalf("build the plan for %s: %v", desc.ID, err)
			}

			for _, artifact := range plan.Platform {
				if err := os.MkdirAll(filepath.Dir(artifact.Path), 0o755); err != nil {
					t.Fatalf("create %s: %v", filepath.Dir(artifact.Path), err)
				}
				if err := os.WriteFile(artifact.Path, artifact.Content, 0o644); err != nil {
					t.Fatalf("write %s: %v", artifact.Path, err)
				}

				if isPointerFile(artifact.Content) {
					t.Errorf("the %s platform produced a pointer file: %s", desc.ID, artifact.Path)
				}
			}
		}
	}
}

// isPointerFile reports whether a content is a pointer to another path rather
// than the artifact itself.
func isPointerFile(content []byte) bool {
	trimmed := strings.TrimSpace(string(content))
	if trimmed == "" {
		return false
	}
	if strings.ContainsAny(trimmed, "\n") {
		return false
	}
	return filepath.IsAbs(trimmed) || strings.HasPrefix(trimmed, "./")
}

func TestTheEmittedPathsStayUnderTheDeclaredTarget(t *testing.T) {
	options, registry := testOptions(t, "project")

	for _, desc := range registry.All() {
		for _, scope := range desc.Scopes {
			local := options
			local.Scope = scope
			if scope == "global" {
				local.ArtifactRoot = filepath.Join(options.Env.Home, ".agents")
			}
			plan, err := Build(desc, local)
			if err != nil {
				t.Fatalf("build the plan for %s: %v", desc.ID, err)
			}

			roots := []string{}
			for _, variant := range desc.PathVariants {
				root, ok := registry.VariantPath(options.Env, desc, variant.Name, scope)
				if !ok {
					continue
				}
				roots = append(roots, root)
			}
			if len(roots) == 0 {
				t.Fatalf("the %s platform declares no path for the %s scope", desc.ID, scope)
			}

			for _, artifact := range plan.Platform {
				if !filepath.IsAbs(artifact.Path) {
					t.Errorf("the %s platform produced a relative path %q", desc.ID, artifact.Path)
					continue
				}
				inside := false
				for _, root := range roots {
					if artifact.Path == root || strings.HasPrefix(artifact.Path, root+string(os.PathSeparator)) {
						inside = true
						break
					}
				}
				if !inside {
					t.Errorf("the %s platform wrote %q, which is outside its declared roots %v", desc.ID, artifact.Path, roots)
				}
			}
		}
	}
}

// TestTheCollisionRuleSkipsTheKindItNames checks the rule that decides which
// artifact wins a shared path.
//
// The rule is a domain rule of the descriptor: one kind is skipped when
// another one already claims the same path.
func TestTheCollisionRuleSkipsTheKindItNames(t *testing.T) {
	desc := &descriptor.Descriptor{
		ID: "test-platform",
		CollisionRules: []descriptor.CollisionRule{
			{First: "agent", Skip: "spec-driven-command"},
		},
	}
	rulePaths := map[string]string{"agent": "/root/skills/spec-driven/SKILL.md"}

	if !collides(desc, "spec-driven-command", "/root/skills/spec-driven/SKILL.md", rulePaths) {
		t.Error("the command was not skipped for the path the agent claims")
	}
	if collides(desc, "agent", "/root/skills/spec-driven/SKILL.md", rulePaths) {
		t.Error("the agent was skipped by its own rule")
	}
	if collides(desc, "inject-guidelines-command", "/root/skills/inject-guidelines/SKILL.md", rulePaths) {
		t.Error("an unrelated kind was skipped")
	}
}
