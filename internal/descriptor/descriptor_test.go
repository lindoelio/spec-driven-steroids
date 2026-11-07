package descriptor

import (
	"path/filepath"
	"testing"
)

func TestEverySupportedPlatformLoadsAndValidates(t *testing.T) {
	registry, err := Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}

	ids := registry.IDs()
	if len(ids) != 13 {
		t.Errorf("the registry holds %d platforms, want 13: %v", len(ids), ids)
	}

	for _, id := range ids {
		desc, ok := registry.Get(id)
		if !ok {
			t.Fatalf("the platform %q is missing", id)
		}
		if err := desc.Validate(); err != nil {
			t.Errorf("the descriptor %q is invalid: %v", id, err)
		}
		if len(desc.Artifacts) == 0 {
			t.Errorf("the descriptor %q declares no artifact rule", id)
		}
	}
}

func TestValidationNamesTheMissingField(t *testing.T) {
	cases := []struct {
		name      string
		mutate    func(*Descriptor)
		wantField string
	}{
		{
			name:      "the identifier",
			mutate:    func(d *Descriptor) { d.ID = "" },
			wantField: "id",
		},
		{
			name:      "the display name",
			mutate:    func(d *Descriptor) { d.DisplayName = "  " },
			wantField: "displayName",
		},
		{
			name:      "the supported scopes",
			mutate:    func(d *Descriptor) { d.Scopes = nil },
			wantField: "scopes",
		},
		{
			name:      "the artifact rules",
			mutate:    func(d *Descriptor) { d.Artifacts = nil },
			wantField: "artifacts",
		},
		{
			name:      "the mode of a rule",
			mutate:    func(d *Descriptor) { d.Artifacts[0].Mode = "" },
			wantField: "artifacts[0].mode",
		},
		{
			name:      "the filename of a rule",
			mutate:    func(d *Descriptor) { d.Artifacts[0].Filename = "" },
			wantField: "artifacts[0].filename",
		},
		{
			name:      "the serialization of a rule",
			mutate:    func(d *Descriptor) { d.Artifacts[0].Serialization = "" },
			wantField: "artifacts[0].serialization",
		},
		{
			name:      "the fallback scope",
			mutate:    func(d *Descriptor) { d.ScopeFallback = "" },
			wantField: "scopeFallback",
		},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			registry, err := Load()
			if err != nil {
				t.Fatalf("load the descriptors: %v", err)
			}
			desc, _ := registry.Get("claudecode")
			copied := *desc
			copied.Artifacts = append([]ArtifactRule{}, desc.Artifacts...)
			copied.Scopes = append([]string{}, desc.Scopes...)
			test.mutate(&copied)

			err = copied.Validate()
			if err == nil {
				t.Fatal("the incomplete descriptor was accepted")
			}
			validation, ok := err.(*ValidationError)
			if !ok {
				t.Fatalf("the error %v does not name a field", err)
			}
			if validation.Field != test.wantField {
				t.Errorf("the error names the field %q, want %q", validation.Field, test.wantField)
			}
		})
	}
}

func TestAnUnsupportedScopeFallsBackToTheDeclaredOne(t *testing.T) {
	registry, err := Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}

	desc, _ := registry.Get("codex")
	if desc.SupportsScope("global") {
		t.Error("codex declares the user scope")
	}
	if got := desc.ResolveScope("global"); got != "project" {
		t.Errorf("the unsupported scope resolved to %q, want the fallback %q", got, desc.ScopeFallback)
	}
	if got := desc.ResolveScope("project"); got != "project" {
		t.Errorf("the supported scope resolved to %q", got)
	}
}

func TestPathsResolveAcrossTheOperatingSystemMatrix(t *testing.T) {
	registry, err := Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}

	cases := []struct {
		name    string
		os      string
		env     map[string]string
		scope   string
		want    string
		anchor  string
		variant string
	}{
		{
			name:   "the VS Code user profile on linux",
			os:     "linux",
			scope:  "global",
			want:   filepath.Join("/home/user", ".config", "Code", "User", "prompts"),
			anchor: "github-vscode",
		},
		{
			name:   "the VS Code user profile on darwin",
			os:     "darwin",
			scope:  "global",
			want:   filepath.Join("/home/user", "Library", "Application Support", "Code", "User", "prompts"),
			anchor: "github-vscode",
		},
		{
			name:   "the VS Code user profile on windows",
			os:     "win32",
			env:    map[string]string{"APPDATA": "C:\\Users\\dev\\AppData\\Roaming"},
			scope:  "global",
			want:   filepath.Join("C:\\Users\\dev\\AppData\\Roaming", "Code", "User", "prompts"),
			anchor: "github-vscode",
		},
		{
			name:    "the Copilot skills directory on windows",
			os:      "win32",
			env:     map[string]string{"USERPROFILE": "C:\\Users\\dev"},
			scope:   "global",
			want:    filepath.Join("C:\\Users\\dev", ".copilot", "skills"),
			anchor:  "github-vscode",
			variant: "skills",
		},
		{
			name:   "the Copilot CLI configuration directory",
			os:     "linux",
			scope:  "global",
			want:   filepath.Join("/home/user", ".config", "github-copilot"),
			anchor: "github-copilot-cli",
		},
		{
			name:   "the OpenCode configuration directory",
			os:     "linux",
			scope:  "global",
			want:   filepath.Join("/home/user", ".config", "opencode"),
			anchor: "opencode",
		},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			desc, _ := registry.Get(test.anchor)
			env := Env{Home: "/home/user", WorkDir: "/work", Vars: test.env, OS: test.os}
			variant := test.variant
			if variant == "" {
				variant = "root"
			}
			got, ok := registry.VariantPath(env, desc, variant, test.scope)
			if !ok {
				t.Fatal("the root path variant did not resolve")
			}
			if got != test.want {
				t.Errorf("the path resolved to %q, want %q", got, test.want)
			}
		})
	}
}

func TestTheArtifactRootPlatformsResolveToTheArtifactRoot(t *testing.T) {
	registry, err := Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}
	env := Env{Home: "/home/user", WorkDir: "/work", Vars: map[string]string{}, OS: "linux"}

	cases := []struct {
		id    string
		scope string
		want  string
	}{
		{"antigravity", "project", filepath.Join("/work", ".agents")},
		{"antigravity-cli", "project", filepath.Join("/work", ".agents")},
		{"minimax-code", "global", filepath.Join("/home/user", ".agents")},
	}

	for _, test := range cases {
		desc, _ := registry.Get(test.id)
		got, ok := registry.VariantPath(env, desc, "root", test.scope)
		if !ok {
			t.Fatalf("the %s platform has no root path variant in the %s scope", test.id, test.scope)
		}
		if got != test.want {
			t.Errorf("the %s platform root resolved to %q, want %q", test.id, got, test.want)
		}
	}
}

func TestEveryPlatformDeclaresItsLegacyDerivations(t *testing.T) {
	registry, err := Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}

	for _, desc := range registry.All() {
		for _, scope := range desc.Scopes {
			for _, kind := range []string{KindAgent, KindSpecDrivenCommand, KindInjectGuidelinesCmd, KindSkills} {
				rule, ok := desc.Rule(kind)
				if !ok {
					continue
				}
				skipped := false
				for _, skippedScope := range rule.SkipScopes {
					if skippedScope == scope {
						skipped = true
					}
				}
				if skipped {
					continue
				}
				if _, ok := desc.LegacyTransformation(kind, scope); !ok {
					t.Errorf("the %s platform declares no legacy derivation for %s in the %s scope", desc.ID, kind, scope)
				}
			}
		}
	}
}

// TestValidationRejectsATargetPathThatEscapesTheRoot checks that a rule
// cannot name a path outside the target root.
//
// The emitter joins the declared path to the target root, and the join
// resolves a parent reference, so a descriptor that names one would write
// outside the root it claimed.
func TestValidationRejectsATargetPathThatEscapesTheRoot(t *testing.T) {
	cases := []struct {
		name  string
		field string
		rule  ArtifactRule
	}{
		{
			name:  "a parent reference in the target directory",
			field: "artifacts[0].targetDir",
			rule:  ArtifactRule{Kind: KindAgent, Source: "agents/spec-driven.agent.md", Mode: ModeSerialize, TargetVariant: "root", TargetDir: "../../escape", Filename: "spec-driven.md", Serialization: SerializationMarkdown},
		},
		{
			name:  "an absolute target directory",
			field: "artifacts[0].targetDir",
			rule:  ArtifactRule{Kind: KindAgent, Source: "agents/spec-driven.agent.md", Mode: ModeSerialize, TargetVariant: "root", TargetDir: "/etc", Filename: "spec-driven.md", Serialization: SerializationMarkdown},
		},
		{
			name:  "a file name that is a path",
			field: "artifacts[0].filename",
			rule:  ArtifactRule{Kind: KindAgent, Source: "agents/spec-driven.agent.md", Mode: ModeSerialize, TargetVariant: "root", TargetDir: "agents", Filename: "../escape.md", Serialization: SerializationMarkdown},
		},
		{
			name:  "a file name that holds a separator",
			field: "artifacts[0].filename",
			rule:  ArtifactRule{Kind: KindAgent, Source: "agents/spec-driven.agent.md", Mode: ModeSerialize, TargetVariant: "root", TargetDir: "agents", Filename: "nested/spec-driven.md", Serialization: SerializationMarkdown},
		},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			desc := &Descriptor{
				ID:            "test-platform",
				DisplayName:   "Test Platform",
				Scopes:        []string{"project"},
				ScopeFallback: "project",
				PathVariants: []PathVariant{
					{Name: "root", Project: &PathSpec{Segments: []Segment{{Literal: ".test"}}}},
				},
				Artifacts: []ArtifactRule{test.rule},
			}
			err := desc.Validate()
			if err == nil {
				t.Fatal("the descriptor was accepted")
			}
			validation, ok := err.(*ValidationError)
			if !ok {
				t.Fatalf("the error is a %T, want a validation error", err)
			}
			if validation.Field != test.field {
				t.Errorf("the error names the field %q, want %q", validation.Field, test.field)
			}
		})
	}
}

// TestValidationRejectsAnUnknownScopeMode checks that a declared scope mode
// is one of the known modes.
//
// The descriptor is the only source of truth, so a mode that does not exist
// has to be reported instead of being read as the default.
func TestValidationRejectsAnUnknownScopeMode(t *testing.T) {
	desc := &Descriptor{
		ID:            "test-platform",
		DisplayName:   "Test Platform",
		Scopes:        []string{"project"},
		ScopeFallback: "project",
		PathVariants: []PathVariant{
			{Name: "root", Project: &PathSpec{Segments: []Segment{{Literal: ".test"}}}},
		},
		Artifacts: []ArtifactRule{
			{
				Kind:          KindAgent,
				Source:        "agents/spec-driven.agent.md",
				Mode:          ModeSerialize,
				TargetVariant: "root",
				TargetDir:     "agents",
				Filename:      "spec-driven.md",
				Serialization: SerializationMarkdown,
				ScopeModes:    map[string]string{"project": "nativ"},
			},
		},
	}

	err := desc.Validate()
	if err == nil {
		t.Fatal("the descriptor was accepted")
	}
	validation, ok := err.(*ValidationError)
	if !ok {
		t.Fatalf("the error is a %T, want a validation error", err)
	}
	if validation.Field != `artifacts[0].scopeModes["project"]` {
		t.Errorf("the error names the field %q, want the scope mode field", validation.Field)
	}
}
