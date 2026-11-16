// Package config resolves the artifact root and the internal state
// directories.
//
// The artifact root is the platform-neutral location every managed artifact
// lives in: `.agents` inside the working directory at project scope and
// `.agents` under the home directory at user scope. The internal state —
// install manifests and the template cache — lives elsewhere, because it is
// bookkeeping rather than an injected artifact.
package config

import (
	"os"
	"path/filepath"
	"runtime"
)

// Layer identifies which of the two artifact roots a resolution came from.
type Layer string

const (
	// LayerProject is the project artifact root, inside the working directory.
	LayerProject Layer = "project"
	// LayerUser is the user artifact root, under the home directory.
	LayerUser Layer = "user"
)

// Scope is an injection scope.
type Scope string

const (
	// ScopeProject installs into the project artifact root.
	ScopeProject Scope = "project"
	// ScopeGlobal installs into the user artifact root.
	ScopeGlobal Scope = "global"
)

// ArtifactRootName is the directory name of the artifact root.
const ArtifactRootName = ".agents"

// Artifact kinds held under an artifact root.
const (
	KindSkills   = "skills"
	KindAgents   = "agents"
	KindCommands = "commands"
)

// Resolver holds the environment a resolution runs against.
type Resolver struct {
	// WorkDir is the project directory. It defaults to the process working directory.
	WorkDir string
	// HomeDir is the home directory. It defaults to the user home directory.
	HomeDir string
	// Env is the environment used for the overrides. It defaults to the process environment.
	Env map[string]string
	// OS is the operating system identifier. It defaults to the runtime identifier.
	OS string
}

// Default returns a resolver bound to the current process.
func Default() Resolver {
	work, err := os.Getwd()
	if err != nil {
		work = "."
	}
	home, err := os.UserHomeDir()
	if err != nil {
		home = ""
	}
	return Resolver{
		WorkDir: work,
		HomeDir: home,
		Env:     environMap(),
		OS:      runtime.GOOS,
	}
}

func environMap() map[string]string {
	env := map[string]string{}
	for _, entry := range os.Environ() {
		for i := 0; i < len(entry); i++ {
			if entry[i] == '=' {
				env[entry[:i]] = entry[i+1:]
				break
			}
		}
	}
	return env
}

func (r Resolver) env(name string) string { return r.Env[name] }

// Home returns the home directory the resolver uses.
func (r Resolver) Home() string {
	if r.HomeDir != "" {
		return r.HomeDir
	}
	if home := r.env("HOME"); home != "" {
		return home
	}
	return os.Getenv("HOME")
}

// ProjectRoot returns the project artifact root: `.agents` inside the working directory.
func (r Resolver) ProjectRoot() string {
	return filepath.Join(r.WorkDir, ArtifactRootName)
}

// UserRoot returns the user artifact root: `.agents` under the home directory.
func (r Resolver) UserRoot() string {
	return filepath.Join(r.Home(), ArtifactRootName)
}

// RootFor returns the artifact root of a scope.
func (r Resolver) RootFor(scope Scope) string {
	if scope == ScopeGlobal {
		return r.UserRoot()
	}
	return r.ProjectRoot()
}

// LayerFor returns the layer a scope resolves to.
func (r Resolver) LayerFor(scope Scope) Layer {
	if scope == ScopeGlobal {
		return LayerUser
	}
	return LayerProject
}

// KindDir returns the directory of an artifact kind under a root.
func KindDir(root, kind string) string {
	return filepath.Join(root, kind)
}

// ProjectSkillsDir returns the canonical skills directory at project scope.
func (r Resolver) ProjectSkillsDir() string {
	return filepath.Join(r.ProjectRoot(), KindSkills)
}

// UserSkillsDir returns the canonical skills directory at user scope.
func (r Resolver) UserSkillsDir() string {
	return filepath.Join(r.UserRoot(), KindSkills)
}

// ConfigDir returns the configuration directory that holds the install manifest store.
//
// SDS_CONFIG_DIR names the store directory directly rather than a parent of it,
// which is the behaviour of the release this implementation replaces.
func (r Resolver) ConfigDir() string {
	if dir := r.env("SDS_CONFIG_DIR"); dir != "" {
		return dir
	}
	if r.OS == "win32" {
		base := r.env("APPDATA")
		if base == "" {
			base = filepath.Join(r.Home(), "AppData", "Roaming")
		}
		return filepath.Join(base, "spec-driven-steroids")
	}
	if dir := r.env("XDG_CONFIG_HOME"); dir != "" {
		return filepath.Join(dir, "spec-driven-steroids")
	}
	return filepath.Join(r.Home(), ".config", "spec-driven-steroids")
}

// InstallDir returns the directory holding the install manifests.
func (r Resolver) InstallDir() string {
	return filepath.Join(r.ConfigDir(), "installs")
}

// BackupDir returns the directory holding install backups.
func (r Resolver) BackupDir() string {
	return filepath.Join(r.ConfigDir(), "backups")
}

// CacheDir returns the template bundle cache directory.
func (r Resolver) CacheDir() string {
	if dir := r.env("SDS_TEMPLATE_CACHE_DIR"); dir != "" {
		return dir
	}
	switch r.OS {
	case "win32":
		base := r.env("LOCALAPPDATA")
		if base == "" {
			base = filepath.Join(r.Home(), "AppData", "Local")
		}
		return filepath.Join(base, "spec-driven-steroids", "templates")
	case "darwin":
		return filepath.Join(r.Home(), "Library", "Caches", "spec-driven-steroids", "templates")
	default:
		base := r.env("XDG_CACHE_HOME")
		if base == "" {
			base = filepath.Join(r.Home(), ".cache")
		}
		return filepath.Join(base, "spec-driven-steroids", "templates")
	}
}
