// Package manifest reads and writes the install manifests.
//
// The manifest format version 1 stays readable and writable, so an
// installation created by the previous release can still be cleaned up. New
// information is added as an additive field.
package manifest

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// FormatVersion is the manifest format version this implementation writes.
const FormatVersion = 1

// Manifest kinds.
const (
	// KindCanonical records the artifacts written into the artifact root.
	KindCanonical = "canonical"
	// KindPlatform records the platform-side artifacts of one platform.
	KindPlatform = "platform"
)

// InstalledFile is one recorded file.
type InstalledFile struct {
	// Path is the absolute path of the file.
	Path string `json:"path"`
	// SHA256 is the digest of the file content.
	SHA256 string `json:"sha256"`
	// ClaimingPlatforms lists the platforms that wrote the path. A version 1
	// manifest has no such list; reading one treats every recorded file as
	// claimed by the manifest's own platform.
	ClaimingPlatforms []string `json:"claimingPlatforms,omitempty"`
}

// Manifest records one installation.
type Manifest struct {
	// Version is the format version.
	Version int `json:"version"`
	// Platform is the platform that produced the installation.
	Platform string `json:"platform"`
	// Scope is the scope the installation belongs to.
	Scope string `json:"scope"`
	// Root is the platform root.
	Root string `json:"root"`
	// SkillsRoot is the platform skills root.
	SkillsRoot string `json:"skillsRoot"`
	// CLIVersion is the version of the CLI that wrote the manifest.
	CLIVersion string `json:"cliVersion"`
	// TemplateVersion is the version of the template content.
	TemplateVersion string `json:"templateVersion"`
	// InstalledAt is the installation timestamp.
	InstalledAt string `json:"installedAt"`
	// Files are the recorded files.
	Files []InstalledFile `json:"files"`
	// Kind is the manifest kind: canonical or platform.
	Kind string `json:"kind,omitempty"`
	// ProjectRoot is the project artifact root the manifest is keyed by. It
	// is an additive field; a manifest written before the artifact root
	// existed is keyed by its own root.
	ProjectRoot string `json:"projectRoot,omitempty"`
}

// keyRoot returns the path the manifest file name is keyed by.
func (m *Manifest) keyRoot() string {
	if m.ProjectRoot != "" {
		return m.ProjectRoot
	}
	return m.Root
}

// Claims returns the platforms claiming a recorded path. A manifest written
// before the claim list existed claims every path on its own.
func (m *Manifest) Claims(file InstalledFile) []string {
	if len(file.ClaimingPlatforms) > 0 {
		return file.ClaimingPlatforms
	}
	if m.Platform == "" {
		return []string{}
	}
	return []string{m.Platform}
}

// Hash returns the twelve hexadecimal character key of a path, the way the
// previous release derived the project scope manifest key.
func Hash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])[:12]
}

// ProjectKey returns the manifest key of a project scope installation.
//
// The key is the twelve hexadecimal characters of the resolved project
// artifact root.
func ProjectKey(projectRoot string) string {
	return Hash(projectRoot)
}

// GlobalKey returns the manifest key of a user scope installation.
func GlobalKey() string {
	return "global"
}

// CanonicalFileName returns the file name of the canonical manifest.
func CanonicalFileName(scope, projectRoot string) string {
	return fmt.Sprintf("canonical-%s-%s.json", scope, keyFor(scope, projectRoot))
}

// PlatformFileName returns the file name of a platform manifest.
func PlatformFileName(platform, scope, projectRoot string) string {
	return fmt.Sprintf("%s-%s-%s.json", platform, scope, keyFor(scope, projectRoot))
}

// LegacyPlatformFileName returns the file name the previous release wrote for
// a platform installation.
//
// The user scope key was the literal "global"; the project scope key was the
// hash of the platform root, which is not the artifact root.
func LegacyPlatformFileName(platform, scope, legacyPlatformRoot string) string {
	key := GlobalKey()
	if scope == "project" && legacyPlatformRoot != "" {
		key = Hash(legacyPlatformRoot)
	}
	return fmt.Sprintf("%s-%s-%s.json", platform, scope, key)
}

func keyFor(scope, projectRoot string) string {
	if scope == "global" {
		return GlobalKey()
	}
	return ProjectKey(projectRoot)
}

// Store is the manifest store.
type Store struct {
	// Dir is the directory holding the manifests.
	Dir string
}

// NewStore returns a store for a directory.
func NewStore(dir string) *Store { return &Store{Dir: dir} }

// Path returns the absolute path of a manifest file name.
func (s *Store) Path(name string) string { return filepath.Join(s.Dir, name) }

// Read reads a manifest from a path. A file that is not a readable version 1
// manifest yields no manifest.
func (s *Store) Read(path string) (*Manifest, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var manifest Manifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return nil, nil
	}
	if manifest.Version != FormatVersion || manifest.Files == nil {
		return nil, nil
	}
	return &manifest, nil
}

// List returns every readable manifest in the store.
func (s *Store) List() ([]*Manifest, error) {
	entries, err := os.ReadDir(s.Dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var manifests []*Manifest
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		manifest, err := s.Read(filepath.Join(s.Dir, entry.Name()))
		if err != nil || manifest == nil {
			continue
		}
		manifests = append(manifests, manifest)
	}
	sort.Slice(manifests, func(i, j int) bool { return manifests[i].Platform < manifests[j].Platform })
	return manifests, nil
}

// WithWriteLock runs an operation while holding the store write lock.
//
// The canonical manifest accumulates the claims of every platform, so a
// read followed by a write has to be atomic against another injection that
// runs at the same time. Without the lock, the last writer wins and the
// claims of the other platform are lost: a later clean would then remove an
// artifact another platform still uses.
func (s *Store) WithWriteLock(operation func() error) error {
	release, err := s.Lock()
	if err != nil {
		return err
	}
	defer release()
	return operation()
}

// Lock acquires the store write lock and returns the function that releases
// it. A caller that reads the manifests and writes them back holds the lock
// across the whole sequence.
func (s *Store) Lock() (func(), error) {
	return acquireFileLock(filepath.Join(s.Dir, writeLockName), lockTimeout)
}

// Write writes a manifest under the name its kind and scope imply.
func (s *Store) Write(manifest *Manifest) (string, error) {
	var name string
	if manifest.Kind == KindCanonical {
		name = CanonicalFileName(manifest.Scope, manifest.keyRoot())
	} else {
		name = PlatformFileName(manifest.Platform, manifest.Scope, manifest.keyRoot())
	}
	return s.WriteAs(manifest, name)
}

// WriteAs writes a manifest under an explicit name.
func (s *Store) WriteAs(manifest *Manifest, name string) (string, error) {
	if manifest.Version == 0 {
		manifest.Version = FormatVersion
	}
	if err := os.MkdirAll(s.Dir, 0o755); err != nil {
		return "", err
	}
	raw, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return "", err
	}
	// The manifest is written to a temporary file and renamed, so that an
	// interrupted write never leaves a truncated document behind. A truncated
	// manifest would be unreadable, and the installation it records would
	// become invisible to every later command.
	temporary, err := os.CreateTemp(s.Dir, ".manifest-*.json")
	if err != nil {
		return "", err
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)

	if _, err := temporary.Write(append(raw, '\n')); err != nil {
		temporary.Close()
		return "", err
	}
	if err := temporary.Sync(); err != nil {
		temporary.Close()
		return "", err
	}
	if err := temporary.Close(); err != nil {
		return "", err
	}
	if err := os.Chmod(temporaryName, 0o644); err != nil {
		return "", err
	}
	target := filepath.Join(s.Dir, name)
	if err := os.Rename(temporaryName, target); err != nil {
		return "", err
	}
	return target, nil
}

// Remove deletes the manifest of an installation.
func (s *Store) Remove(manifest *Manifest) error {
	name := PlatformFileName(manifest.Platform, manifest.Scope, manifest.keyRoot())
	if manifest.Kind == KindCanonical {
		name = CanonicalFileName(manifest.Scope, manifest.keyRoot())
	}
	err := os.Remove(filepath.Join(s.Dir, name))
	if err != nil && os.IsNotExist(err) {
		return nil
	}
	return err
}

// Candidate describes a manifest file name the resolver probes.
type Candidate struct {
	// Name is the file name.
	Name string
	// Legacy marks a name the previous release wrote.
	Legacy bool
}

// Resolve finds the manifest of an installation.
//
// It probes the current key first, then the exact file names the previous
// release wrote, so that an installation created before the rewrite is found
// rather than orphaned.
//
// The canonical manifest records the artifact root, not the installation of a
// platform. It is therefore only a candidate when no platform is named: a
// platform-scoped lookup that fell back to it would remove the artifact root
// on behalf of a platform that was never installed.
func (s *Store) Resolve(scope, projectRoot, platform string, legacyNames []string) (*Manifest, string, bool) {
	var candidates []Candidate
	if platform == "" {
		candidates = append(candidates, Candidate{Name: CanonicalFileName(scope, projectRoot)})
	} else {
		candidates = append(candidates, Candidate{Name: PlatformFileName(platform, scope, projectRoot)})
	}
	for _, name := range legacyNames {
		candidates = append(candidates, Candidate{Name: name, Legacy: true})
	}

	for _, candidate := range candidates {
		manifest, err := s.Read(s.Path(candidate.Name))
		if err != nil || manifest == nil {
			continue
		}
		return manifest, candidate.Name, true
	}
	return nil, "", false
}

// HashFile returns the SHA-256 digest of a file.
func HashFile(path string) (string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:]), nil
}

// CollectFiles returns every file below a root.
func CollectFiles(root string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
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

// BuildInstalledFiles turns a list of paths into recorded files.
func BuildInstalledFiles(paths []string) ([]InstalledFile, error) {
	seen := map[string]bool{}
	unique := make([]string, 0, len(paths))
	for _, path := range paths {
		if path == "" {
			continue
		}
		resolved, err := filepath.Abs(path)
		if err != nil {
			return nil, err
		}
		if seen[resolved] {
			continue
		}
		seen[resolved] = true
		unique = append(unique, resolved)
	}
	sort.Strings(unique)

	var installed []InstalledFile
	for _, path := range unique {
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			continue
		}
		digest, err := HashFile(path)
		if err != nil {
			return nil, err
		}
		installed = append(installed, InstalledFile{Path: path, SHA256: digest})
	}
	return installed, nil
}

// CleanResult reports what a cleanup did.
type CleanResult struct {
	// Removed lists the removed paths.
	Removed []string
	// Skipped lists the modified files that were preserved.
	Skipped []string
	// Missing lists the recorded paths that no longer exist.
	Missing []string
	// Retained lists the paths another manifest still claims.
	Retained []string
}

// CleanOptions configures a cleanup.
type CleanOptions struct {
	// Force removes modified files as well.
	Force bool
	// DryRun computes the result without touching the filesystem.
	DryRun bool
	// Others holds the other manifests, whose claims protect a path from
	// being removed.
	Others []*Manifest
}

// Clean removes the files a manifest records.
//
// A file another manifest still claims is never removed, a modified file is
// preserved unless forced, and the emptied directories below a claimed root
// are removed while the claimed root itself stays in place.
func Clean(manifest *Manifest, options CleanOptions) (CleanResult, error) {
	result := CleanResult{}
	// A path another manifest still claims is never removed, whatever the
	// platform that claims it.
	others := map[string]bool{}
	for _, other := range options.Others {
		if other == nil || other == manifest {
			continue
		}
		for _, file := range other.Files {
			if len(other.Claims(file)) > 0 {
				others[file.Path] = true
			}
		}
	}

	for _, file := range manifest.Files {
		info, err := os.Stat(file.Path)
		if err != nil || info.IsDir() {
			result.Missing = append(result.Missing, file.Path)
			continue
		}

		if others[file.Path] {
			result.Retained = append(result.Retained, file.Path)
			continue
		}

		// A manifest on disk guides the removal, so the recorded path has to
		// lie inside a root the manifest claims. A manifest that names a
		// path outside its own roots never removes it.
		if !manifest.owns(file.Path) {
			result.Retained = append(result.Retained, file.Path)
			continue
		}

		digest, err := HashFile(file.Path)
		if err != nil {
			return result, err
		}
		if !options.Force && digest != file.SHA256 {
			result.Skipped = append(result.Skipped, file.Path)
			continue
		}

		if !options.DryRun {
			if err := os.Remove(file.Path); err != nil {
				return result, err
			}
			removeEmptyParents(file.Path, []string{manifest.Root, manifest.SkillsRoot})
		}
		result.Removed = append(result.Removed, file.Path)
	}

	sort.Strings(result.Removed)
	sort.Strings(result.Skipped)
	sort.Strings(result.Missing)
	sort.Strings(result.Retained)
	return result, nil
}

// owns reports whether a recorded path lies inside a root the manifest
// claims.
func (m *Manifest) owns(path string) bool {
	for _, root := range []string{m.Root, m.SkillsRoot} {
		if root == "" {
			continue
		}
		resolved, err := filepath.Abs(root)
		if err != nil {
			continue
		}
		resolved = filepath.Clean(resolved)
		absolute, err := filepath.Abs(path)
		if err != nil {
			continue
		}
		absolute = filepath.Clean(absolute)
		if absolute == resolved || strings.HasPrefix(absolute, resolved+string(os.PathSeparator)) {
			return true
		}
	}
	return false
}

// removeEmptyParents removes the emptied directories below a claimed root.
//
// The walk stops at the claimed root and never continues upward, so a shared
// directory is never removed.
func removeEmptyParents(filePath string, stops []string) {
	resolvedStops := make([]string, 0, len(stops))
	for _, stop := range stops {
		if stop == "" {
			continue
		}
		resolved, err := filepath.Abs(stop)
		if err != nil {
			continue
		}
		resolvedStops = append(resolvedStops, filepath.Clean(resolved))
	}
	if len(resolvedStops) == 0 {
		return
	}

	current := filepath.Dir(filepath.Clean(filePath))
	for {
		// A claimed root is never removed, even when it ends up empty.
		if isAnyOf(current, resolvedStops) {
			return
		}
		if !underAny(current, resolvedStops) {
			return
		}
		entries, err := os.ReadDir(current)
		if err != nil || len(entries) > 0 {
			return
		}
		if err := os.Remove(current); err != nil {
			return
		}
		parent := filepath.Dir(current)
		if parent == current {
			return
		}
		current = parent
	}
}

// isAnyOf reports whether a path is one of the given roots.
func isAnyOf(path string, roots []string) bool {
	for _, root := range roots {
		if path == root {
			return true
		}
	}
	return false
}

func underAny(path string, roots []string) bool {
	for _, root := range roots {
		if path == root {
			continue
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			continue
		}
		if relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)) && !filepath.IsAbs(relative) {
			return true
		}
	}
	return false
}

// writeLockName is the name of the lock file that guards the store.
const writeLockName = ".manifests.lock"

const (
	lockTimeout      = 5 * time.Second
	lockPollInterval = 25 * time.Millisecond
)

// acquireFileLock creates an exclusive lock file and waits for it when it is
// held by another live process.
func acquireFileLock(lockPath string, timeout time.Duration) (func(), error) {
	if err := os.MkdirAll(filepath.Dir(lockPath), 0o755); err != nil {
		return nil, err
	}
	startedAt := time.Now()
	for {
		file, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if err == nil {
			_, _ = file.WriteString(strconv.Itoa(os.Getpid()))
			_ = file.Close()
			return func() { _ = os.Remove(lockPath) }, nil
		}
		if !errors.Is(err, os.ErrExist) {
			return nil, err
		}

		owner, ownerErr := readLockOwner(lockPath)
		if ownerErr != nil {
			_ = os.Remove(lockPath)
			continue
		}
		if owner > 0 {
			if err := syscall.Kill(owner, 0); err != nil {
				_ = os.Remove(lockPath)
				continue
			}
		}

		if time.Since(startedAt) > timeout {
			return nil, fmt.Errorf("Timed out waiting for the manifest write lock: %s", lockPath)
		}
		time.Sleep(lockPollInterval)
	}
}

// readLockOwner reads the process id recorded in a lock file.
func readLockOwner(lockPath string) (int, error) {
	raw, err := os.ReadFile(lockPath)
	if err != nil {
		return 0, err
	}
	owner, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil {
		return 0, err
	}
	return owner, nil
}
