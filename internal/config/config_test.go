package config

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func testResolver() Resolver {
	return Resolver{
		WorkDir: "/work",
		HomeDir: "/home/user",
		Env:     map[string]string{},
		OS:      "linux",
	}
}

func TestArtifactRootsResolveToThePlatformNeutralRoot(t *testing.T) {
	resolver := testResolver()

	if got := resolver.ProjectRoot(); got != filepath.Join("/work", ".agents") {
		t.Errorf("the project root resolved to %q", got)
	}
	if got := resolver.UserRoot(); got != filepath.Join("/home/user", ".agents") {
		t.Errorf("the user root resolved to %q", got)
	}
	if got := resolver.RootFor(ScopeProject); got != resolver.ProjectRoot() {
		t.Errorf("the project scope resolved to %q", got)
	}
	if got := resolver.RootFor(ScopeGlobal); got != resolver.UserRoot() {
		t.Errorf("the user scope resolved to %q", got)
	}
}

func TestBothScopesShareOneInternalLayout(t *testing.T) {
	resolver := testResolver()

	for _, kind := range []string{KindSkills, KindAgents, KindCommands} {
		project := KindDir(resolver.ProjectRoot(), kind)
		user := KindDir(resolver.UserRoot(), kind)
		if filepath.Base(project) != filepath.Base(user) {
			t.Errorf("the %s layout differs between the scopes: %q and %q", kind, project, user)
		}
	}
}

func TestLayersAreReported(t *testing.T) {
	resolver := testResolver()

	if got := resolver.LayerFor(ScopeProject); got != LayerProject {
		t.Errorf("the project scope resolved to the layer %q", got)
	}
	if got := resolver.LayerFor(ScopeGlobal); got != LayerUser {
		t.Errorf("the user scope resolved to the layer %q", got)
	}
}

func TestInternalStateKeepsItsLocation(t *testing.T) {
	cases := []struct {
		name      string
		os        string
		env       map[string]string
		configDir string
		cacheDir  string
	}{
		{
			name:      "linux uses the XDG directories",
			os:        "linux",
			env:       map[string]string{"XDG_CONFIG_HOME": "/xdg/config", "XDG_CACHE_HOME": "/xdg/cache"},
			configDir: "/xdg/config/spec-driven-steroids",
			cacheDir:  "/xdg/cache/spec-driven-steroids/templates",
		},
		{
			name:      "linux falls back to the home directories",
			os:        "linux",
			env:       map[string]string{},
			configDir: "/home/user/.config/spec-driven-steroids",
			cacheDir:  "/home/user/.cache/spec-driven-steroids/templates",
		},
		{
			name:      "darwin keeps its own cache directory",
			os:        "darwin",
			env:       map[string]string{},
			configDir: "/home/user/.config/spec-driven-steroids",
			cacheDir:  "/home/user/Library/Caches/spec-driven-steroids/templates",
		},
		{
			name:      "windows follows APPDATA and LOCALAPPDATA",
			os:        "win32",
			env:       map[string]string{"APPDATA": "/appdata", "LOCALAPPDATA": "/localappdata"},
			configDir: filepath.Join("/appdata", "spec-driven-steroids"),
			cacheDir:  filepath.Join("/localappdata", "spec-driven-steroids", "templates"),
		},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			resolver := Resolver{WorkDir: "/work", HomeDir: "/home/user", Env: test.env, OS: test.os}
			if got := resolver.ConfigDir(); got != test.configDir {
				t.Errorf("the configuration directory resolved to %q, want %q", got, test.configDir)
			}
			if got := resolver.CacheDir(); got != test.cacheDir {
				t.Errorf("the cache directory resolved to %q, want %q", got, test.cacheDir)
			}
		})
	}
}

func TestTheConfigurationOverrideNamesTheStoreDirectoryDirectly(t *testing.T) {
	resolver := Resolver{WorkDir: "/work", HomeDir: "/home/user", Env: map[string]string{"SDS_CONFIG_DIR": "/custom/state"}, OS: "linux"}

	if got := resolver.ConfigDir(); got != "/custom/state" {
		t.Errorf("the configuration directory resolved to %q", got)
	}
	if got := resolver.InstallDir(); got != filepath.Join("/custom/state", "installs") {
		t.Errorf("the install directory resolved to %q", got)
	}
}

func TestTheTemplateCacheOverrideNamesTheCacheDirectory(t *testing.T) {
	resolver := Resolver{WorkDir: "/work", HomeDir: "/home/user", Env: map[string]string{"SDS_TEMPLATE_CACHE_DIR": "/custom/cache"}, OS: "linux"}

	if got := resolver.CacheDir(); got != "/custom/cache" {
		t.Errorf("the cache directory resolved to %q", got)
	}
}

func TestDefaultResolverReadsTheProcessEnvironment(t *testing.T) {
	resolver := Default()
	if resolver.OS != runtime.GOOS {
		t.Errorf("the operating system resolved to %q", resolver.OS)
	}
	if resolver.Home() == "" {
		t.Error("the home directory is empty")
	}
	if _, err := os.Stat(resolver.WorkDir); err != nil {
		t.Errorf("the working directory %q is not reachable: %v", resolver.WorkDir, err)
	}
}
