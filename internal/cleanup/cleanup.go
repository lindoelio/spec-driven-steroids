// Package cleanup removes the artifacts a previous release left behind.
//
// A leftover is reported as a migration candidate only when no current install
// manifest claims that path. A leftover whose body still matches the canonical
// body it was generated from is removed; a leftover the user edited is
// preserved and reported, so the decision stays with the user.
package cleanup

import (
	"bytes"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/assets"
	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/manifest"
	"github.com/lindoelio/spec-driven-steroids/internal/serialize"
)

// Candidate is a leftover the previous release wrote.
type Candidate struct {
	// Platform is the platform that wrote the path.
	Platform string
	// Scope is the scope the path belongs to.
	Scope string
	// Path is the absolute path of the leftover.
	Path string
	// Kind is the artifact kind the path carries.
	Kind string
	// Matches reports whether the body still equals the canonical body the
	// path was generated from.
	Matches bool
	// Reason explains why a preserved file was preserved.
	Reason string
}

// Result reports what a cleanup found.
type Result struct {
	// Removed lists the removed leftovers.
	Removed []string
	// Candidates lists the preserved leftovers that are migration candidates.
	Candidates []Candidate
	// Skipped lists the paths another manifest still claims.
	Skipped []string
}

// Options configures a cleanup.
type Options struct {
	// Registry holds the platform descriptors.
	Registry *descriptor.Registry
	// Env is the environment the paths resolve against.
	Env descriptor.Env
	// Scope is the scope to scan: "global" or "project".
	Scope string
	// Platform limits the scan to one platform. An empty value scans all.
	Platform string
	// Manifests are the current install manifests. A path they claim is
	// never reported as a migration candidate.
	Manifests []*manifest.Manifest
	// ArtifactRoot is the root the canonical tree lives in. The artifact
	// root is owned by the canonical tree, so the legacy scan never reports
	// or removes a path inside it, even when a previous release installed a
	// platform there.
	ArtifactRoot string
	// DryRun computes the result without touching the filesystem.
	DryRun bool
}

// insideRoot reports whether a path lies inside a root.
func insideRoot(path, root string) bool {
	if root == "" {
		return false
	}
	if path == root {
		return true
	}
	return strings.HasPrefix(path, root+string(os.PathSeparator))
}

// Scan finds the leftovers of a scope.
func Scan(options Options) (Result, error) {
	result := Result{}
	claimed := claimedPaths(options.Manifests)

	legacy, err := legacyTree()
	if err != nil {
		return result, err
	}

	for _, desc := range options.Registry.All() {
		if options.Platform != "" && desc.ID != options.Platform {
			continue
		}
		for _, root := range desc.LegacyRoots {
			if root.Scope != options.Scope {
				continue
			}
			rootPath := options.Registry.LegacyRootPath(options.Env, root)
			for _, candidate := range root.Candidates {
				files, err := candidateFiles(rootPath, candidate)
				if err != nil {
					return result, err
				}
				for _, path := range files {
					if claimed[path] {
						result.Skipped = append(result.Skipped, path)
						continue
					}
					if insideRoot(path, options.ArtifactRoot) {
						// The artifact root belongs to the canonical tree.
						continue
					}
					expected, ok := expectedContent(desc, candidate.Kind, options.Scope, legacy, path, rootPath, candidate)
					if !ok {
						continue
					}
					actual, err := os.ReadFile(path)
					if err != nil {
						continue
					}
					if !bytes.Equal(actual, expected) {
						result.Candidates = append(result.Candidates, Candidate{
							Platform: desc.ID,
							Scope:    options.Scope,
							Path:     path,
							Kind:     candidate.Kind,
							Matches:  false,
							Reason:   "the content differs from the canonical body it was generated from",
						})
						continue
					}
					if !options.DryRun {
						if err := os.Remove(path); err != nil {
							return result, err
						}
					}
					result.Removed = append(result.Removed, path)
				}
			}
		}
	}

	sort.Strings(result.Removed)
	sort.Strings(result.Skipped)
	sort.Slice(result.Candidates, func(i, j int) bool { return result.Candidates[i].Path < result.Candidates[j].Path })
	return result, nil
}

// claimedPaths returns every path a current manifest claims.
func claimedPaths(manifests []*manifest.Manifest) map[string]bool {
	claimed := map[string]bool{}
	for _, m := range manifests {
		for _, file := range m.Files {
			claimed[file.Path] = true
		}
	}
	return claimed
}

// candidateFiles returns the files a legacy candidate covers.
func candidateFiles(rootPath string, candidate descriptor.LegacyCandidate) ([]string, error) {
	path := filepath.Join(rootPath, filepath.FromSlash(candidate.Path))
	info, err := os.Stat(path)
	if err != nil {
		return nil, nil
	}
	if !info.IsDir() {
		return []string{path}, nil
	}
	var files []string
	err = filepath.WalkDir(path, func(current string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		files = append(files, current)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	return files, nil
}

// legacyTree indexes the pre-change canonical tree.
func legacyTree() (map[string][]byte, error) {
	tree := assets.LegacyFS()
	files := map[string][]byte{}
	err := fs.WalkDir(tree, ".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		content, err := fs.ReadFile(tree, path)
		if err != nil {
			return err
		}
		files[path] = content
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

// canonicalSource maps an artifact kind to the canonical source it derives from.
func canonicalSource(kind string) string {
	switch kind {
	case descriptor.KindAgent:
		return "agents/spec-driven.agent.md"
	case descriptor.KindSpecDrivenCommand:
		return "commands/spec-driven.command.md"
	case descriptor.KindInjectGuidelinesCmd:
		return "commands/inject-guidelines.command.md"
	}
	return ""
}

// expectedContent computes the content a legacy path was generated from.
func expectedContent(desc *descriptor.Descriptor, kind, scope string, legacy map[string][]byte, path, rootPath string, candidate descriptor.LegacyCandidate) ([]byte, bool) {
	if kind == descriptor.KindSkills {
		relative := strings.TrimPrefix(path, filepath.Join(rootPath, filepath.FromSlash(candidate.Path))+string(filepath.Separator))
		content, ok := legacy["skills/"+filepath.ToSlash(relative)]
		if !ok {
			return nil, false
		}
		return content, true
	}

	source, ok := legacy[canonicalSource(kind)]
	if !ok {
		return nil, false
	}

	transformation, ok := desc.LegacyTransformation(kind, scope)
	if !ok {
		return nil, false
	}
	if transformation == serialize.ProfileCanonicalTree {
		return source, true
	}

	rule, ok := desc.Rule(kind)
	if !ok {
		return nil, false
	}
	result, err := serialize.Apply(serialize.Rule{
		Serialization:    transformation,
		OutputKind:       kind,
		Name:             rule.Frontmatter["name"],
		Description:      rule.Frontmatter["description"],
		AdditionalFields: rule.AdditionalFields,
		CommandAgent:     rule.CommandAgent,
		Substitutions:    substitutionsOf(rule),
		BodyWrapper:      rule.BodyWrapper,
	}, serialize.ParseSource(string(source)))
	if err != nil {
		return nil, false
	}
	return []byte(result.Content), true
}

func substitutionsOf(rule descriptor.ArtifactRule) []serialize.Substitution {
	out := make([]serialize.Substitution, 0, len(rule.Substitutions))
	for _, value := range rule.Substitutions {
		out = append(out, serialize.Substitution{From: value.From, To: value.To})
	}
	return out
}
