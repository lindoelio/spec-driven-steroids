// Package descriptor holds the declarative platform descriptors.
//
// Every platform difference lives in data: where the platform reads artifacts,
// how it names them, which frontmatter it needs, which serializations derive
// a platform-side artifact, which paths it skips, and which legacy paths the
// previous release wrote. Adding a platform is a configuration change.
package descriptor

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

// Emission modes.
const (
	// ModeNative means the platform reads the artifact root directly, so no
	// platform-side artifact is written.
	ModeNative = "native"
	// ModeCopy writes the canonical bytes to the platform directory.
	ModeCopy = "copy"
	// ModeSerialize derives the platform-side artifact through a declared
	// serialization.
	ModeSerialize = "serialize"
)

// Artifact kinds.
const (
	KindAgent               = "agent"
	KindSpecDrivenCommand   = "spec-driven-command"
	KindInjectGuidelinesCmd = "inject-guidelines-command"
	KindSkills              = "skills"
)

// Serialization profiles.
const (
	SerializationMarkdown     = "markdown"
	SerializationToml         = "toml"
	SerializationTomlCommand  = "toml-command"
	SerializationCommandSkill = "command-skill"
)

// Post-injection actions.
const (
	ActionFlattenVSCodePrompts = "flatten-vscode-prompts"
	ActionRemoveCodexLegacy    = "remove-codex-legacy-commands"
	ActionOpenCodeConfigWrite  = "opencode-project-config"
)

// Segment is one step of a path expression.
//
// A segment is a literal path element, a reference to an anchor, or an
// environment variable with a fallback.
type Segment struct {
	// Literal is a fixed path element.
	Literal string `json:"literal,omitempty"`
	// Anchor names a built-in anchor ("home", "cwd") or an entry of the
	// anchor table.
	Anchor string `json:"anchor,omitempty"`
	// Env names an environment variable.
	Env string `json:"env,omitempty"`
	// Fallback is used when Env is unset or empty.
	Fallback []Segment `json:"fallback,omitempty"`
}

// PathSpec is a path expression.
type PathSpec struct {
	Segments []Segment `json:"segments"`
}

// PathVariant resolves to a path for each scope.
type PathVariant struct {
	// Name identifies the variant inside an artifact rule.
	Name string `json:"name"`
	// Project resolves the variant at project scope.
	Project *PathSpec `json:"project,omitempty"`
	// Global resolves the variant at user scope.
	Global *PathSpec `json:"global,omitempty"`
}

// ArtifactRule declares how one canonical artifact reaches one platform.
type ArtifactRule struct {
	// Kind is the artifact kind: agent, spec-driven-command,
	// inject-guidelines-command or skills.
	Kind string `json:"kind"`
	// Source is the canonical source, relative to the canonical tree root.
	Source string `json:"source"`
	// Mode is the emission mode.
	Mode string `json:"mode"`
	// TargetVariant names the path variant the artifact is written under.
	// An empty value means the platform root.
	TargetVariant string `json:"targetVariant,omitempty"`
	// TargetDir is the directory below the target, relative to it.
	TargetDir string `json:"targetDir,omitempty"`
	// Filename is the file name below the target directory. An empty value
	// means the rule writes a whole directory tree.
	Filename string `json:"filename,omitempty"`
	// Serialization names the profile that derives the artifact.
	Serialization string `json:"serialization,omitempty"`
	// Frontmatter holds the fields the descriptor contributes.
	Frontmatter map[string]string `json:"frontmatter,omitempty"`
	// AdditionalFields holds the platform-specific fields.
	AdditionalFields map[string]string `json:"additionalFields,omitempty"`
	// CommandAgent is the agent a command delegates to.
	CommandAgent string `json:"commandAgent,omitempty"`
	// Substitutions are the body substitutions the serialization applies.
	Substitutions []Substitution `json:"substitutions,omitempty"`
	// BodyWrapper names the registered body wrapper the serialization applies.
	BodyWrapper string `json:"bodyWrapper,omitempty"`
	// SkipScopes lists the scopes this rule is not emitted in.
	SkipScopes []string `json:"skipScopes,omitempty"`
	// ScopeModes overrides the emission mode for a scope. A platform whose
	// root is the artifact root in one scope reads the root directly there
	// and receives a platform-side artifact in another.
	ScopeModes map[string]string `json:"scopeModes,omitempty"`
}

// ModeFor returns the emission mode of the rule in a scope.
func (r ArtifactRule) ModeFor(scope string) string {
	if mode, ok := r.ScopeModes[scope]; ok {
		return mode
	}
	return r.Mode
}

// Substitution is one body rewrite a serialization applies.
type Substitution struct {
	// From is the literal text to replace.
	From string `json:"from"`
	// To is the replacement.
	To string `json:"to"`
}

// SkipRule suppresses artifact kinds in a scope.
type SkipRule struct {
	// Scope is the scope the rule applies to. An empty scope means every scope.
	Scope string `json:"scope,omitempty"`
	// Kinds are the artifact kinds the rule suppresses.
	Kinds []string `json:"kinds"`
}

// CollisionRule suppresses an artifact kind when it would overwrite another.
type CollisionRule struct {
	// First is the kind that claims the path.
	First string `json:"first"`
	// Skip is the kind that is suppressed when both resolve to the same file.
	Skip string `json:"skip"`
}

// PostInjectAction declares one action run after the artifacts are written.
type PostInjectAction struct {
	// Action names the action from the closed registry.
	Action string `json:"action"`
	// Scope is the scope the action applies to. An empty scope means every scope.
	Scope string `json:"scope,omitempty"`
	// Target is the file the action touches, relative to the platform root.
	Target string `json:"target,omitempty"`
}

// LegacyRoot is a pre-change platform directory, with the candidate files it
// holds.
type LegacyRoot struct {
	// Scope is the scope the root belongs to.
	Scope string `json:"scope"`
	// Segments resolve the root relative to the home directory (global) or
	// the working directory (project).
	Segments []Segment `json:"segments"`
	// Candidates are the paths the previous release wrote there.
	Candidates []LegacyCandidate `json:"candidates"`
}

// LegacyCandidate is one path the previous release wrote inside a legacy root.
type LegacyCandidate struct {
	// Path is relative to the legacy root. A directory means the whole tree.
	Path string `json:"path"`
	// Kind is the artifact kind the path carries.
	Kind string `json:"kind"`
}

// LegacyDerivation declares the transformation the previous release applied
// to an artifact kind, so that a legacy artifact can be compared against the
// canonical body it was generated from.
type LegacyDerivation struct {
	// Kind is the artifact kind.
	Kind string `json:"kind"`
	// Scope is the scope the derivation applies to.
	Scope string `json:"scope"`
	// Transformation names the serialization profile the previous release used.
	Transformation string `json:"transformation"`
}

// Descriptor is the complete declarative description of one platform.
type Descriptor struct {
	// ID is the platform identifier.
	ID string `json:"id"`
	// DisplayName is the human readable name.
	DisplayName string `json:"displayName"`
	// Scopes are the supported scopes.
	Scopes []string `json:"scopes"`
	// ScopeFallback is the scope substituted when an unsupported one is requested.
	ScopeFallback string `json:"scopeFallback"`
	// Artifacts are the artifact rules.
	Artifacts []ArtifactRule `json:"artifacts"`
	// PathVariants are the named path anchors.
	PathVariants []PathVariant `json:"pathVariants"`
	// SkipRules are the scope-conditional suppressions.
	SkipRules []SkipRule `json:"skipRules"`
	// CollisionRules are the target-collision suppressions.
	CollisionRules []CollisionRule `json:"collisionRules"`
	// PostInjectActions are the post-injection actions.
	PostInjectActions []PostInjectAction `json:"postInjectActions"`
	// LegacyRoots are the pre-change platform directories.
	LegacyRoots []LegacyRoot `json:"legacyRoots"`
	// LegacyProjectRoot is the pre-change project root of the platform,
	// relative to the working directory. It is the value the legacy manifest
	// filename key hashes.
	LegacyProjectRoot []Segment `json:"legacyProjectRoot,omitempty"`
	// LegacyDerivations are the per-kind, per-scope legacy transformations.
	LegacyDerivations []LegacyDerivation `json:"legacyDerivations"`
}

// ValidationError reports a descriptor problem together with the field that
// caused it.
type ValidationError struct {
	// Field is the offending field, such as "artifacts[2].filename".
	Field string
	// Message explains what is missing or wrong.
	Message string
}

// Error implements the error interface, naming the offending field when the
// validation error carries one.
func (e *ValidationError) Error() string {
	if e.Field == "" {
		return e.Message
	}
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// Validate checks that the descriptor carries every required field and
// reports the first missing one by name.
func (d *Descriptor) Validate() error {
	if strings.TrimSpace(d.ID) == "" {
		return &ValidationError{Field: "id", Message: "is required"}
	}
	if strings.TrimSpace(d.DisplayName) == "" {
		return &ValidationError{Field: "displayName", Message: "is required"}
	}
	if len(d.Scopes) == 0 {
		return &ValidationError{Field: "scopes", Message: "must declare at least one supported scope"}
	}
	for i, scope := range d.Scopes {
		if scope != "global" && scope != "project" {
			return &ValidationError{Field: fmt.Sprintf("scopes[%d]", i), Message: "must be \"global\" or \"project\""}
		}
	}
	if strings.TrimSpace(d.ScopeFallback) == "" {
		return &ValidationError{Field: "scopeFallback", Message: "is required"}
	}
	if len(d.Artifacts) == 0 {
		return &ValidationError{Field: "artifacts", Message: "must declare at least one artifact rule"}
	}

	variants := map[string]bool{}
	for i, variant := range d.PathVariants {
		if strings.TrimSpace(variant.Name) == "" {
			return &ValidationError{Field: fmt.Sprintf("pathVariants[%d].name", i), Message: "is required"}
		}
		if variant.Project == nil && variant.Global == nil {
			return &ValidationError{Field: fmt.Sprintf("pathVariants[%d]", i), Message: "must declare a project or a global path"}
		}
		variants[variant.Name] = true
	}

	for i, rule := range d.Artifacts {
		base := fmt.Sprintf("artifacts[%d]", i)
		if strings.TrimSpace(rule.Kind) == "" {
			return &ValidationError{Field: base + ".kind", Message: "is required"}
		}
		if strings.TrimSpace(rule.Source) == "" {
			return &ValidationError{Field: base + ".source", Message: "is required"}
		}
		switch rule.Mode {
		case ModeNative, ModeCopy, ModeSerialize:
		case "":
			return &ValidationError{Field: base + ".mode", Message: "is required"}
		default:
			return &ValidationError{Field: base + ".mode", Message: fmt.Sprintf("must be one of %q, %q or %q", ModeNative, ModeCopy, ModeSerialize)}
		}
		if rule.Mode != ModeNative && rule.TargetVariant == "" {
			return &ValidationError{Field: base + ".targetVariant", Message: "is required for a platform-side artifact"}
		}
		if rule.TargetVariant != "" && !variants[rule.TargetVariant] {
			return &ValidationError{Field: base + ".targetVariant", Message: fmt.Sprintf("names an unknown path variant %q", rule.TargetVariant)}
		}
		if rule.Mode == ModeSerialize {
			if strings.TrimSpace(rule.Serialization) == "" {
				return &ValidationError{Field: base + ".serialization", Message: "is required for a derived artifact"}
			}
			if !knownSerialization(rule.Serialization) {
				return &ValidationError{Field: base + ".serialization", Message: fmt.Sprintf("names an unknown serialization %q", rule.Serialization)}
			}
		}
		if rule.Mode != ModeNative && rule.Filename == "" && rule.Kind != KindSkills {
			return &ValidationError{Field: base + ".filename", Message: "is required for a platform-side artifact"}
		}
		if err := validateTargetPath(base+".targetDir", rule.TargetDir); err != nil {
			return err
		}
		if err := validateTargetPath(base+".filename", rule.Filename); err != nil {
			return err
		}
		if strings.ContainsAny(rule.Filename, `/\`) {
			return &ValidationError{Field: base + ".filename", Message: "must be a file name, not a path"}
		}
		for scope, mode := range rule.ScopeModes {
			switch mode {
			case ModeNative, ModeCopy, ModeSerialize:
			default:
				return &ValidationError{Field: fmt.Sprintf("%s.scopeModes[%q]", base, scope), Message: fmt.Sprintf("must be one of %q, %q or %q", ModeNative, ModeCopy, ModeSerialize)}
			}
			if !d.SupportsScope(scope) {
				return &ValidationError{Field: fmt.Sprintf("%s.scopeModes[%q]", base, scope), Message: fmt.Sprintf("names a scope the platform does not support")}
			}
		}
	}

	for i, action := range d.PostInjectActions {
		if !knownAction(action.Action) {
			return &ValidationError{Field: fmt.Sprintf("postInjectActions[%d].action", i), Message: fmt.Sprintf("names an unknown action %q", action.Action)}
		}
	}

	for i, derivation := range d.LegacyDerivations {
		if strings.TrimSpace(derivation.Kind) == "" {
			return &ValidationError{Field: fmt.Sprintf("legacyDerivations[%d].kind", i), Message: "is required"}
		}
		if strings.TrimSpace(derivation.Scope) == "" {
			return &ValidationError{Field: fmt.Sprintf("legacyDerivations[%d].scope", i), Message: "is required"}
		}
	}

	return nil
}

// validateTargetPath checks that a declared target path stays inside the
// target root.
//
// The emitter joins the declared path to the target root, and the join
// resolves a parent reference. A descriptor that names one would write
// outside the root it claimed, so the descriptor is rejected instead.
func validateTargetPath(field, value string) error {
	if value == "" {
		return nil
	}
	if filepath.IsAbs(value) {
		return &ValidationError{Field: field, Message: "must be a relative path"}
	}
	for _, element := range strings.Split(filepath.ToSlash(value), "/") {
		if element == ".." {
			return &ValidationError{Field: field, Message: "must stay inside the target root"}
		}
	}
	return nil
}

func knownSerialization(name string) bool {
	switch name {
	case SerializationMarkdown, SerializationToml, SerializationTomlCommand, SerializationCommandSkill:
		return true
	}
	return false
}

func knownAction(name string) bool {
	switch name {
	case ActionFlattenVSCodePrompts, ActionRemoveCodexLegacy, ActionOpenCodeConfigWrite:
		return true
	}
	return false
}

// SupportsScope reports whether the platform supports a scope.
func (d *Descriptor) SupportsScope(scope string) bool {
	for _, candidate := range d.Scopes {
		if candidate == scope {
			return true
		}
	}
	return false
}

// ResolveScope returns the scope the platform uses for a requested scope,
// substituting the declared fallback when the request is unsupported.
func (d *Descriptor) ResolveScope(requested string) string {
	if d.SupportsScope(requested) {
		return requested
	}
	return d.ScopeFallback
}

// Rule returns the artifact rule of a kind.
func (d *Descriptor) Rule(kind string) (ArtifactRule, bool) {
	for _, rule := range d.Artifacts {
		if rule.Kind == kind {
			return rule, true
		}
	}
	return ArtifactRule{}, false
}

// Variant returns a named path variant.
func (d *Descriptor) Variant(name string) (PathVariant, bool) {
	for _, variant := range d.PathVariants {
		if variant.Name == name {
			return variant, true
		}
	}
	return PathVariant{}, false
}

// Skips reports whether an artifact kind is suppressed in a scope.
func (d *Descriptor) Skips(kind, scope string) bool {
	for _, rule := range d.SkipRules {
		if rule.Scope != "" && rule.Scope != scope {
			continue
		}
		for _, candidate := range rule.Kinds {
			if candidate == kind {
				return true
			}
		}
	}
	return false
}

// Actions returns the post-injection actions that apply in a scope.
func (d *Descriptor) Actions(scope string) []PostInjectAction {
	var actions []PostInjectAction
	for _, action := range d.PostInjectActions {
		if action.Scope != "" && action.Scope != scope {
			continue
		}
		actions = append(actions, action)
	}
	return actions
}

// LegacyTransformation returns the transformation the previous release applied
// to an artifact kind in a scope.
func (d *Descriptor) LegacyTransformation(kind, scope string) (string, bool) {
	for _, derivation := range d.LegacyDerivations {
		if derivation.Kind == kind && derivation.Scope == scope {
			return derivation.Transformation, true
		}
	}
	return "", false
}

// SortedIDs returns the platform identifiers in a stable order.
func SortedIDs(descriptors []*Descriptor) []string {
	ids := make([]string, 0, len(descriptors))
	for _, descriptor := range descriptors {
		ids = append(ids, descriptor.ID)
	}
	sort.Strings(ids)
	return ids
}
