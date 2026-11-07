package descriptor

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

//go:embed data/platforms.json
var platformFS embed.FS

//go:embed data/anchors.json
var anchorFS embed.FS

// Env is the environment a path expression resolves against.
type Env struct {
	// Home is the home directory.
	Home string
	// WorkDir is the project directory.
	WorkDir string
	// Vars holds the environment variables.
	Vars map[string]string
	// OS is the operating system identifier.
	OS string
}

// DefaultEnv returns the environment of the current process.
func DefaultEnv() Env {
	home, err := os.UserHomeDir()
	if err != nil {
		home = ""
	}
	work, err := os.Getwd()
	if err != nil {
		work = "."
	}
	vars := map[string]string{}
	for _, entry := range os.Environ() {
		if i := strings.IndexByte(entry, '='); i > 0 {
			vars[entry[:i]] = entry[i+1:]
		}
	}
	return Env{Home: home, WorkDir: work, Vars: vars, OS: runtime.GOOS}
}

type anchorTable map[string]map[string][]Segment

// Registry holds every known platform descriptor.
type Registry struct {
	descriptors []*Descriptor
	byID        map[string]*Descriptor
	anchors     anchorTable
}

// Load reads the embedded descriptors.
func Load() (*Registry, error) {
	rawPlatforms, err := platformFS.ReadFile("data/platforms.json")
	if err != nil {
		return nil, fmt.Errorf("read platform descriptors: %w", err)
	}
	var descriptors []*Descriptor
	if err := json.Unmarshal(rawPlatforms, &descriptors); err != nil {
		return nil, fmt.Errorf("parse platform descriptors: %w", err)
	}

	rawAnchors, err := anchorFS.ReadFile("data/anchors.json")
	if err != nil {
		return nil, fmt.Errorf("read path anchors: %w", err)
	}
	var anchors anchorTable
	if err := json.Unmarshal(rawAnchors, &anchors); err != nil {
		return nil, fmt.Errorf("parse path anchors: %w", err)
	}

	registry := &Registry{byID: map[string]*Descriptor{}, anchors: anchors}
	for _, descriptor := range descriptors {
		if err := descriptor.Validate(); err != nil {
			return nil, fmt.Errorf("descriptor %q is invalid: %w", descriptor.ID, err)
		}
		registry.descriptors = append(registry.descriptors, descriptor)
		registry.byID[descriptor.ID] = descriptor
	}
	return registry, nil
}

// All returns every descriptor, ordered by identifier.
func (r *Registry) All() []*Descriptor {
	out := make([]*Descriptor, len(r.descriptors))
	copy(out, r.descriptors)
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// Get returns a descriptor by identifier.
func (r *Registry) Get(id string) (*Descriptor, bool) {
	descriptor, ok := r.byID[id]
	return descriptor, ok
}

// IDs returns every platform identifier, sorted.
func (r *Registry) IDs() []string {
	return SortedIDs(r.descriptors)
}

// GlobalCapable returns the descriptors that support the user scope.
func (r *Registry) GlobalCapable() []*Descriptor {
	var out []*Descriptor
	for _, descriptor := range r.All() {
		if descriptor.SupportsScope("global") {
			out = append(out, descriptor)
		}
	}
	return out
}

// ResolveSegments resolves a path expression against an environment.
//
// A segment that resolves to an absolute path replaces the base it is
// resolved against, which is how an anchor such as the home directory or an
// environment variable contributes a root of its own.
func (r *Registry) ResolveSegments(env Env, segments []Segment, base string) string {
	current := base
	var parts []string
	for _, segment := range segments {
		for _, part := range r.resolveSegment(env, segment, current) {
			if isAbsoluteAnyOS(part) {
				current = part
				parts = nil
				continue
			}
			parts = append(parts, part)
		}
	}
	if len(parts) == 0 {
		return current
	}
	return filepath.Join(append([]string{current}, parts...)...)
}

// isAbsoluteAnyOS reports whether a path is absolute on any supported
// operating system, so that a path resolved for another system still
// contributes a root of its own.
func isAbsoluteAnyOS(value string) bool {
	if strings.HasPrefix(value, "/") {
		return true
	}
	if len(value) >= 3 && value[1] == ':' && (value[2] == '\\' || value[2] == '/') {
		return true
	}
	return false
}

func (r *Registry) resolveParts(env Env, segments []Segment, base string) []string {
	var parts []string
	for _, segment := range segments {
		parts = append(parts, r.resolveSegment(env, segment, base)...)
	}
	return parts
}

func (r *Registry) resolveSegment(env Env, segment Segment, base string) []string {
	switch {
	case segment.Literal != "":
		return []string{segment.Literal}
	case segment.Anchor != "":
		switch segment.Anchor {
		case "home":
			return []string{env.Home}
		case "cwd":
			return []string{env.WorkDir}
		}
		definition, ok := r.anchors[segment.Anchor]
		if !ok {
			return nil
		}
		for _, key := range []string{env.OS, "default"} {
			if variant, found := definition[key]; found {
				return r.resolveParts(env, variant, base)
			}
		}
		return nil
	case segment.Env != "":
		if value := env.Vars[segment.Env]; value != "" {
			return []string{value}
		}
		return r.resolveParts(env, segment.Fallback, base)
	}
	return nil
}

// VariantPath resolves a named path variant in a scope.
func (r *Registry) VariantPath(env Env, descriptor *Descriptor, variantName, scope string) (string, bool) {
	variant, ok := descriptor.Variant(variantName)
	if !ok {
		return "", false
	}
	spec := variant.Project
	base := env.WorkDir
	if scope == "global" {
		spec = variant.Global
		base = env.Home
	}
	if spec == nil {
		return "", false
	}
	return r.ResolveSegments(env, spec.Segments, base), true
}

// LegacyRootPath resolves a legacy root to an absolute path.
func (r *Registry) LegacyRootPath(env Env, root LegacyRoot) string {
	base := env.WorkDir
	if root.Scope == "global" {
		base = env.Home
	}
	return r.ResolveSegments(env, root.Segments, base)
}

// LegacyProjectRootPath resolves the pre-change project root of a platform.
func (r *Registry) LegacyProjectRootPath(env Env, descriptor *Descriptor) string {
	if len(descriptor.LegacyProjectRoot) == 0 {
		return ""
	}
	return r.ResolveSegments(env, descriptor.LegacyProjectRoot, env.WorkDir)
}

// WalkFS lists every file of an embedded tree, relative to it.
func WalkFS(tree fs.FS, prefix string) ([]string, error) {
	var files []string
	err := fs.WalkDir(tree, prefix, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		files = append(files, path)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	return files, nil
}
