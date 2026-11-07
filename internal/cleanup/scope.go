package cleanup

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/manifest"
)

// ScopeResult reports what a scoped cleanup did.
type ScopeResult struct {
	// Removed lists the removed paths.
	Removed []string
	// Skipped lists the modified files that were preserved.
	Skipped []string
	// Missing lists the recorded paths that no longer exist.
	Missing []string
	// Retained lists the paths another manifest still claims.
	Retained []string
	// Manifests is the number of manifests the cleanup inspected.
	Manifests int
}

// LegacyNames returns the manifest file names the previous release wrote for
// a scope.
//
// The user scope key was the literal "global"; the project scope key was the
// hash of the platform root, which is not the artifact root.
func LegacyNames(registry *descriptor.Registry, env descriptor.Env, scope string) []string {
	var names []string
	for _, desc := range registry.All() {
		root := registry.LegacyProjectRootPath(env, desc)
		names = append(names, manifest.LegacyPlatformFileName(desc.ID, scope, root))
	}
	sort.Strings(names)
	return names
}

// ResolveInstallation finds the manifest of an installation.
//
// The current key is probed first, then the exact file names the previous
// release wrote, so that an installation created before the rewrite is found
// rather than orphaned.
func ResolveInstallation(store *manifest.Store, registry *descriptor.Registry, env descriptor.Env, scope, platform, projectRoot string) (*manifest.Manifest, string, bool) {
	legacy := LegacyNames(registry, env, scope)
	if platform != "" {
		legacy = filterLegacy(legacy, platform)
	}
	return store.Resolve(scope, projectRoot, platform, legacy)
}

func filterLegacy(names []string, platform string) []string {
	var filtered []string
	for _, name := range names {
		if strings.HasPrefix(name, platform+"-") {
			filtered = append(filtered, name)
		}
	}
	return filtered
}

// CleanScope removes the installation of one platform in one scope.
//
// The canonical manifest and the platform manifests are handled together: the
// platform's own files are removed, and its claim on the canonical tree is
// withdrawn. A canonical file another platform still claims stays in place.
//
// Without a platform, every platform manifest of the scope is removed, which
// is what a scope-wide cleanup promises.
func CleanScope(store *manifest.Store, registry *descriptor.Registry, env descriptor.Env, scope, platform, projectRoot string, options manifest.CleanOptions) (ScopeResult, error) {
	result := ScopeResult{}

	all, err := store.List()
	if err != nil {
		return result, err
	}

	targets := []*manifest.Manifest{}
	cleanedPlatforms := []string{}
	if platform != "" {
		installation, _, found := ResolveInstallation(store, registry, env, scope, platform, projectRoot)
		if found && installation != nil {
			targets = append(targets, installation)
			cleanedPlatforms = append(cleanedPlatforms, installation.Platform)
		}
	} else {
		for _, current := range all {
			if current.Scope != scope || current.Kind == manifest.KindCanonical {
				continue
			}
			targets = append(targets, current)
			cleanedPlatforms = append(cleanedPlatforms, current.Platform)
		}
	}
	sort.Strings(cleanedPlatforms)

	others := withoutAll(all, targets)
	for _, target := range targets {
		result.Manifests++
		cleaned, err := manifest.Clean(target, manifest.CleanOptions{
			Force:  options.Force,
			DryRun: options.DryRun,
			Others: others,
		})
		if err != nil {
			return result, err
		}
		result.Removed = append(result.Removed, cleaned.Removed...)
		result.Skipped = append(result.Skipped, cleaned.Skipped...)
		result.Missing = append(result.Missing, cleaned.Missing...)
		result.Retained = append(result.Retained, cleaned.Retained...)

		if !options.DryRun && len(cleaned.Skipped) == 0 {
			if err := store.Remove(target); err != nil {
				return result, err
			}
		}
	}

	// The canonical tree is only touched when the cleanup actually removed an
	// installation: a platform-scoped cleanup of a platform that holds none
	// leaves the artifact root alone, and a scope-wide cleanup always
	// reaches it.
	canonical, _, canonicalFound := store.Resolve(scope, projectRoot, "", nil)
	if canonicalFound && canonical != nil && (platform == "" || len(cleanedPlatforms) > 0) {
		result.Manifests++
		canonicalOthers := without(all, canonical)

		for _, cleanedPlatform := range cleanedPlatforms {
			withdrawClaim(canonical, cleanedPlatform)
		}
		removable := []manifest.InstalledFile{}
		for _, file := range canonical.Files {
			if len(file.ClaimingPlatforms) == 0 {
				removable = append(removable, file)
			}
		}

		if len(removable) > 0 {
			subset := *canonical
			subset.Files = removable
			cleaned, err := manifest.Clean(&subset, manifest.CleanOptions{
				Force:  options.Force,
				DryRun: options.DryRun,
				Others: canonicalOthers,
			})
			if err != nil {
				return result, err
			}
			result.Removed = append(result.Removed, cleaned.Removed...)
			result.Skipped = append(result.Skipped, cleaned.Skipped...)
			result.Missing = append(result.Missing, cleaned.Missing...)
			result.Retained = append(result.Retained, cleaned.Retained...)
		}

		if !options.DryRun {
			keep := keepFiles(canonical, removable)
			if len(keep) == 0 {
				if err := store.Remove(canonical); err != nil {
					return result, err
				}
			} else {
				updated := *canonical
				updated.Files = keep
				if _, err := store.Write(&updated); err != nil {
					return result, err
				}
			}
		}
	}

	sort.Strings(result.Removed)
	sort.Strings(result.Skipped)
	sort.Strings(result.Missing)
	sort.Strings(result.Retained)
	return result, nil
}

// withoutAll returns the manifests that are not among the given ones.
func withoutAll(manifests []*manifest.Manifest, excluded []*manifest.Manifest) []*manifest.Manifest {
	var kept []*manifest.Manifest
	for _, candidate := range manifests {
		excludedHere := false
		for _, current := range excluded {
			if sameInstallation(candidate, current) {
				excludedHere = true
				break
			}
		}
		if excludedHere {
			continue
		}
		kept = append(kept, candidate)
	}
	return kept
}

// withdrawClaim removes a platform from the claim list of every recorded file.
func withdrawClaim(m *manifest.Manifest, platform string) {
	for i := range m.Files {
		m.Files[i].ClaimingPlatforms = withoutClaim(m.Files[i].ClaimingPlatforms, platform)
	}
}

func withoutClaim(claims []string, platform string) []string {
	var kept []string
	for _, claim := range claims {
		if claim == platform {
			continue
		}
		kept = append(kept, claim)
	}
	return kept
}

// keepFiles returns the recorded files that are not in the removable set.
func keepFiles(m *manifest.Manifest, removable []manifest.InstalledFile) []manifest.InstalledFile {
	removablePaths := map[string]bool{}
	for _, file := range removable {
		removablePaths[file.Path] = true
	}
	var kept []manifest.InstalledFile
	for _, file := range m.Files {
		if removablePaths[file.Path] {
			continue
		}
		kept = append(kept, file)
	}
	return kept
}

// without returns the manifests that are not the excluded one.
//
// The manifests are read more than once, so the exclusion compares the
// installation a manifest records rather than the pointer.
func without(manifests []*manifest.Manifest, exclude *manifest.Manifest) []*manifest.Manifest {
	var out []*manifest.Manifest
	for _, candidate := range manifests {
		if sameInstallation(candidate, exclude) {
			continue
		}
		out = append(out, candidate)
	}
	return out
}

// sameInstallation reports whether two manifests record the same installation.
func sameInstallation(left, right *manifest.Manifest) bool {
	if left == nil || right == nil {
		return left == right
	}
	return left.Platform == right.Platform &&
		left.Scope == right.Scope &&
		left.Root == right.Root &&
		left.Kind == right.Kind
}

// Backup copies the recorded paths of an installation.
//
// The backup covers the recorded artifact paths rather than the root as a
// whole, because the root is shared with other tools under the new layout.
func Backup(store *manifest.Store, registry *descriptor.Registry, env descriptor.Env, scope, platform, projectRoot, destination string, options manifest.CleanOptions) ([]string, error) {
	installation, _, found := ResolveInstallation(store, registry, env, scope, platform, projectRoot)
	if !found || installation == nil {
		return nil, nil
	}

	var copied []string
	for _, file := range installation.Files {
		if !fileExists(file.Path) {
			continue
		}
		target := filepath.Join(destination, filepath.Base(filepath.Dir(file.Path)), filepath.Base(file.Path))
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return copied, err
		}
		content, err := os.ReadFile(file.Path)
		if err != nil {
			return copied, err
		}
		if err := os.WriteFile(target, content, 0o644); err != nil {
			return copied, err
		}
		copied = append(copied, target)
	}
	sort.Strings(copied)
	return copied, nil
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
