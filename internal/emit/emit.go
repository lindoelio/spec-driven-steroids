// Package emit computes what a platform receives.
//
// The canonical tree is written into the artifact root for the scope. A
// platform that does not read the artifact root receives a platform-side
// artifact for each of its rules: either the canonical bytes, or an artifact
// derived by a declared serialization.
package emit

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/assets"
	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/serialize"
)

// Canonical kinds, the directories the artifact root holds.
const (
	KindSkills   = "skills"
	KindAgents   = "agents"
	KindCommands = "commands"
)

// File is one canonical file.
type File struct {
	// RelPath is the path relative to the canonical tree root.
	RelPath string
	// Content is the file content.
	Content []byte
}

// Artifact is one platform-side artifact.
type Artifact struct {
	// Platform is the platform the artifact belongs to.
	Platform string
	// Kind is the artifact kind.
	Kind string
	// Path is the absolute path of the artifact.
	Path string
	// Content is the artifact content.
	Content []byte
	// Tree marks an artifact that copies a whole directory tree.
	Tree bool
}

// Plan is what an injection writes.
type Plan struct {
	// Scope is the effective scope.
	Scope string
	// Canonical are the canonical files written into the artifact root.
	Canonical []File
	// Platform are the platform-side artifacts.
	Platform []Artifact
}

// CanonicalTree returns the canonical artifact tree.
//
// The tree holds fourteen skill directories, one agent and two commands.
func CanonicalTree() ([]File, error) {
	return CanonicalTreeFrom(assets.CanonicalFS())
}

// CanonicalTreeFrom returns the canonical artifact tree of a resolved
// template source.
//
// The source exposes the tree under the "universal" prefix a remote bundle
// uses, so the prefix is stripped and the paths of the tree stay the same for
// both sources.
func CanonicalTreeFrom(source fs.FS) ([]File, error) {
	if source == nil {
		return CanonicalTree()
	}
	var files []File
	err := fs.WalkDir(source, ".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		content, err := fs.ReadFile(source, path)
		if err != nil {
			return err
		}
		relative := strings.TrimPrefix(path, "universal/")
		if relative == path {
			relative = strings.TrimPrefix(path, "./")
		}
		files = append(files, File{RelPath: relative, Content: content})
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(files, func(i, j int) bool { return files[i].RelPath < files[j].RelPath })
	return files, nil
}

// CanonicalPath returns the path of a canonical file inside an artifact root.
func CanonicalPath(root, relPath string) string {
	return filepath.Join(root, filepath.FromSlash(relPath))
}

// Options configures a plan.
type Options struct {
	// Registry holds the platform descriptors.
	Registry *descriptor.Registry
	// Env is the environment the paths resolve against.
	Env descriptor.Env
	// Scope is the effective scope.
	Scope string
	// ArtifactRoot is the artifact root of the scope.
	ArtifactRoot string
	// Tree is the resolved canonical tree. It is nil for the embedded tree.
	Tree fs.FS
}

// Build computes the canonical tree and the platform-side artifacts of one
// platform.
func Build(desc *descriptor.Descriptor, options Options) (*Plan, error) {
	plan := &Plan{Scope: options.Scope}

	canonical, err := CanonicalTreeFrom(options.Tree)
	if err != nil {
		return nil, err
	}
	plan.Canonical = canonical

	tree := canonicalTreeIndex(canonical)

	// The target path of every rule is resolved first, because a collision
	// rule compares the path of one kind with the path of another.
	rulePaths := map[string]string{}
	for _, rule := range desc.Artifacts {
		if contains(rule.SkipScopes, options.Scope) || desc.Skips(rule.Kind, options.Scope) {
			continue
		}
		if rule.ModeFor(options.Scope) == descriptor.ModeNative {
			continue
		}
		targetRoot, err := resolveTarget(options, desc, rule)
		if err != nil {
			return nil, err
		}
		if rule.Kind == descriptor.KindSkills {
			rulePaths[rule.Kind] = targetRoot
			continue
		}
		rulePaths[rule.Kind] = filepath.Join(targetRoot, rule.TargetDir, rule.Filename)
	}

	for _, rule := range desc.Artifacts {
		if contains(rule.SkipScopes, options.Scope) {
			continue
		}
		if desc.Skips(rule.Kind, options.Scope) {
			continue
		}
		mode := rule.ModeFor(options.Scope)
		if mode == descriptor.ModeNative {
			continue
		}

		targetRoot, err := resolveTarget(options, desc, rule)
		if err != nil {
			return nil, err
		}

		switch rule.Kind {
		case descriptor.KindSkills:
			files, err := subtreeOf(canonical, rule.Source)
			if err != nil {
				return nil, err
			}
			for _, file := range files {
				plan.Platform = append(plan.Platform, Artifact{
					Platform: desc.ID,
					Kind:     rule.Kind,
					Path:     filepath.Join(targetRoot, filepath.FromSlash(strings.TrimPrefix(file.RelPath, rule.Source+"/"))),
					Content:  file.Content,
				})
			}
		default:
			source, ok := tree[rule.Source]
			if !ok {
				return nil, fmt.Errorf("canonical source %q is missing", rule.Source)
			}

			path := filepath.Join(targetRoot, rule.TargetDir, rule.Filename)
			if collides(desc, rule.Kind, path, rulePaths) {
				continue
			}

			// The copy mode writes the canonical bytes unchanged. The other
			// modes derive a platform-side artifact from the canonical one.
			if mode == descriptor.ModeCopy {
				plan.Platform = append(plan.Platform, Artifact{
					Platform: desc.ID,
					Kind:     rule.Kind,
					Path:     path,
					Content:  source.Content,
				})
				continue
			}

			parsed := serialize.ParseSource(string(source.Content))

			serialization := rule.Serialization
			if serialization == "" {
				serialization = serialize.ProfileMarkdown
			}
			result, err := serialize.Apply(serialize.Rule{
				Serialization:    serialization,
				OutputKind:       rule.Kind,
				Name:             rule.Frontmatter["name"],
				Description:      rule.Frontmatter["description"],
				AdditionalFields: rule.AdditionalFields,
				CommandAgent:     rule.CommandAgent,
				Substitutions:    toSubstitutions(rule.Substitutions),
				BodyWrapper:      rule.BodyWrapper,
			}, parsed)
			if err != nil {
				return nil, err
			}

			plan.Platform = append(plan.Platform, Artifact{
				Platform: desc.ID,
				Kind:     rule.Kind,
				Path:     path,
				Content:  []byte(result.Content),
			})
		}
	}

	sort.Slice(plan.Platform, func(i, j int) bool { return plan.Platform[i].Path < plan.Platform[j].Path })
	return plan, nil
}

// resolveTarget resolves the directory a rule writes under.
func resolveTarget(options Options, desc *descriptor.Descriptor, rule descriptor.ArtifactRule) (string, error) {
	if rule.TargetVariant == "" {
		return "", fmt.Errorf("descriptor %q has a rule without a target variant", desc.ID)
	}
	path, ok := options.Registry.VariantPath(options.Env, desc, rule.TargetVariant, options.Scope)
	if !ok {
		return "", fmt.Errorf("descriptor %q has no path variant %q for the %s scope", desc.ID, rule.TargetVariant, options.Scope)
	}
	return path, nil
}

func canonicalTreeIndex(canonical []File) map[string]File {
	index := make(map[string]File, len(canonical))
	for _, file := range canonical {
		index[file.RelPath] = file
	}
	return index
}

func subtreeOf(canonical []File, prefix string) ([]File, error) {
	var files []File
	for _, file := range canonical {
		if strings.HasPrefix(file.RelPath, prefix+"/") {
			files = append(files, file)
		}
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("canonical source %q is missing", prefix)
	}
	return files, nil
}

func toSubstitutions(values []descriptor.Substitution) []serialize.Substitution {
	out := make([]serialize.Substitution, 0, len(values))
	for _, value := range values {
		out = append(out, serialize.Substitution{From: value.From, To: value.To})
	}
	return out
}

func contains(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}

// collides reports whether a rule is suppressed because another rule already
// claims the same path.
func collides(desc *descriptor.Descriptor, kind, path string, rulePaths map[string]string) bool {
	for _, rule := range desc.CollisionRules {
		if rule.Skip != kind {
			continue
		}
		other, ok := rulePaths[rule.First]
		if !ok {
			continue
		}
		if other == path {
			return true
		}
	}
	return false
}

// FlattenedPromptDirs are the directories a flattening action moves out of.
var FlattenedPromptDirs = []string{"agents", "prompts"}

// FlattenedPaths returns the paths the flattened prompt files occupy.
//
// A platform that declares the flattening action publishes its prompts in the
// platform root itself, so the recorded path differs from the written one.
func FlattenedPaths(root string, paths []string) []string {
	out := make([]string, 0, len(paths))
	for _, path := range paths {
		relative, err := filepath.Rel(root, path)
		if err != nil {
			out = append(out, path)
			continue
		}
		segments := strings.Split(relative, string(filepath.Separator))
		if len(segments) == 2 && contains(FlattenedPromptDirs, segments[0]) {
			out = append(out, filepath.Join(root, segments[1]))
			continue
		}
		out = append(out, path)
	}
	return out
}
