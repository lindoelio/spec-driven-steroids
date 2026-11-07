package pack

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSharedCatalogServesClaudeCodeAndCodex(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	claude, err := os.ReadFile(filepath.Join(outDir, filepath.FromSlash(ClaudeCatalogPath)))
	if err != nil {
		t.Fatalf("read %s: %v", ClaudeCatalogPath, err)
	}
	codex, err := os.ReadFile(filepath.Join(outDir, filepath.FromSlash(CodexCatalogPath)))
	if err != nil {
		t.Fatalf("read %s: %v", CodexCatalogPath, err)
	}
	if string(claude) != string(codex) {
		t.Errorf("%s does not carry the same content as %s", CodexCatalogPath, ClaudeCatalogPath)
	}
}

func TestCatalogsCarryTheMarketplaceFields(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	for _, catalogPath := range catalogPaths() {
		object := readObjectFile(t, outDir, catalogPath)

		if name, _ := object["name"].(string); name == "" {
			t.Errorf("the catalog %s declares no name", catalogPath)
		}
		owner, ok := object["owner"].(map[string]any)
		if !ok {
			t.Fatalf("the catalog %s declares the owner %v", catalogPath, object["owner"])
		}
		if name, _ := owner["name"].(string); name != "lindoelio" {
			t.Errorf("the catalog %s declares the owner %q", catalogPath, name)
		}
		plugins, ok := object["plugins"].([]any)
		if !ok || len(plugins) == 0 {
			t.Fatalf("the catalog %s declares the plugins %v", catalogPath, object["plugins"])
		}
		plugin, ok := plugins[0].(map[string]any)
		if !ok {
			t.Fatalf("the catalog %s declares a plugin that is not an object", catalogPath)
		}
		if name, _ := plugin["name"].(string); name != "spec-driven-steroids" {
			t.Errorf("the catalog %s declares the plugin %q", catalogPath, name)
		}
		if source, _ := plugin["source"].(string); source == "" {
			t.Errorf("the catalog %s declares a plugin without a source", catalogPath)
		}
	}
}

func TestCatalogsReferenceTheSamePackageDirectoryAndVersion(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	var source, version string
	for index, catalogPath := range catalogPaths() {
		object := readObjectFile(t, outDir, catalogPath)
		plugins, _ := object["plugins"].([]any)
		plugin, _ := plugins[0].(map[string]any)

		currentSource, _ := plugin["source"].(string)
		currentVersion, _ := plugin["version"].(string)

		if index == 0 {
			source, version = currentSource, currentVersion
			continue
		}
		if currentSource != source {
			t.Errorf("the catalog %s references the package directory %q, expected %q", catalogPath, currentSource, source)
		}
		if currentVersion != version {
			t.Errorf("the catalog %s references the package version %q, expected %q", catalogPath, currentVersion, version)
		}
	}

	if version != "1.2.3" {
		t.Errorf("the catalogs reference the package version %q", version)
	}

	// The referenced package directory is the distribution tree, which holds
	// the manifest every marketplace reads.
	if _, err := os.Stat(filepath.Join(outDir, filepath.FromSlash(ClaudeManifestPath))); err != nil {
		t.Errorf("the referenced package directory holds no %s: %v", ClaudeManifestPath, err)
	}
}

func TestMiniMaxPackageSubtreeHoldsThePortablePackage(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	subtree := "plugins/lindoelio/spec-driven-steroids"

	object := readObjectFile(t, outDir, subtree+"/"+PortableManifestPath)
	if schema, _ := object["$schema"].(string); schema != SchemaIdentifier {
		t.Errorf("the package subtree holds the schema %q", schema)
	}
	if name, _ := object["name"].(string); name != "spec-driven-steroids" {
		t.Errorf("the package subtree holds the name %q", name)
	}

	skills, err := canonicalSkills()
	if err != nil {
		t.Fatalf("read the canonical skills: %v", err)
	}
	for _, skill := range skills {
		if _, err := os.Stat(filepath.Join(outDir, filepath.FromSlash(subtree+"/skills/"+skill+"/SKILL.md"))); err != nil {
			t.Errorf("the package subtree holds no skill %q: %v", skill, err)
		}
	}
}

func TestGeminiManifestIsAtTheRootOfTheTree(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	object := readObjectFile(t, outDir, GeminiManifestPath)

	if name, _ := object["name"].(string); name != "spec-driven-steroids" {
		t.Errorf("the Gemini manifest declares the name %q", name)
	}
	if version, _ := object["version"].(string); version != "1.2.3" {
		t.Errorf("the Gemini manifest declares the version %q", version)
	}
	if description, _ := object["description"].(string); description == "" {
		t.Error("the Gemini manifest declares no description")
	}
}

func TestCatalogsCoverEveryMarketplaceThatReadsOne(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	// The Codex catalog lives at the native path, outside the manifest
	// directory, and the shared catalog serves Claude Code as well.
	for _, catalogPath := range []string{ClaudeCatalogPath, CodexCatalogPath, CursorCatalogPath} {
		if _, err := os.Stat(filepath.Join(outDir, filepath.FromSlash(catalogPath))); err != nil {
			t.Errorf("the tree holds no catalog %s: %v", catalogPath, err)
		}
	}
}
