package version

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestThePackageManifestsAgreeWithTheDeclaredVersion checks that every
// manifest derives from the declaration.
func TestThePackageManifestsAgreeWithTheDeclaredVersion(t *testing.T) {
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatalf("resolve the repository root: %v", err)
	}

	manifests := []string{
		"package.json",
		filepath.Join("packages", "cli", "package.json"),
	}
	manifests = append(manifests, platformManifestPaths(root)...)

	for _, name := range manifests {
		content, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			continue
		}
		value := extractJSONVersion(string(content))
		if value == "" {
			continue
		}
		if value != Declared() {
			t.Errorf("%s declares the version %q, want %q", name, value, Declared())
		}
	}
}

// TestTheMainPackageNamesEveryPlatformPackage checks that the main package
// declares one optional dependency per platform package, and that the
// repository keeps the workspace protocol.
//
// The published package has to name concrete versions, so the release
// rewrites the specifiers in scripts/prepare-publish.mjs. In the repository
// they stay on the workspace protocol, so that a fresh clone installs the
// local packages instead of versions that are not published yet.
func TestTheMainPackageNamesEveryPlatformPackage(t *testing.T) {
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatalf("resolve the repository root: %v", err)
	}

	content, err := os.ReadFile(filepath.Join(root, "packages", "cli", "package.json"))
	if err != nil {
		t.Skipf("the main package manifest is absent: %v", err)
	}

	var manifest struct {
		OptionalDependencies map[string]string `json:"optionalDependencies"`
	}
	if err := json.Unmarshal(content, &manifest); err != nil {
		t.Fatalf("parse the main package manifest: %v", err)
	}

	platforms := platformManifestPaths(root)
	if len(platforms) == 0 {
		t.Skip("the repository holds no platform package")
	}

	for _, platformPath := range platforms {
		platformContent, err := os.ReadFile(filepath.Join(root, platformPath))
		if err != nil {
			t.Fatalf("read %s: %v", platformPath, err)
		}
		var platform struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(platformContent, &platform); err != nil {
			t.Fatalf("parse %s: %v", platformPath, err)
		}

		specifier, declared := manifest.OptionalDependencies[platform.Name]
		if !declared {
			t.Errorf("the main package does not declare %s", platform.Name)
			continue
		}
		if !strings.HasPrefix(specifier, "workspace:") {
			t.Errorf("the main package declares %s@%s, want the workspace protocol in the repository", platform.Name, specifier)
		}
	}
}

// platformManifestPaths lists the manifests of the platform packages.
func platformManifestPaths(root string) []string {
	platformRoot := filepath.Join(root, "packages", "platform")
	entries, err := os.ReadDir(platformRoot)
	if err != nil {
		return nil
	}

	paths := []string{}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		manifestPath := filepath.Join("packages", "platform", entry.Name(), "package.json")
		if _, err := os.Stat(filepath.Join(root, manifestPath)); err == nil {
			paths = append(paths, manifestPath)
		}
	}
	return paths
}

// extractJSONVersion reads the version field of a package manifest without
// decoding it, so that the check does not depend on the key order the
// manifests are written with.
func extractJSONVersion(content string) string {
	marker := `"version":`
	index := -1
	for i := 0; i+len(marker) <= len(content); i++ {
		if content[i:i+len(marker)] == marker {
			index = i + len(marker)
			break
		}
	}
	if index == -1 {
		return ""
	}
	for index < len(content) && (content[index] == ' ' || content[index] == '\t') {
		index++
	}
	if index >= len(content) || content[index] != '"' {
		return ""
	}
	end := index + 1
	for end < len(content) && content[end] != '"' {
		end++
	}
	return content[index+1 : end]
}
