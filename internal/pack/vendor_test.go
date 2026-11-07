package pack

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPortableManifestDeclaresThePackage(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	object := readObjectFile(t, outDir, PortableManifestPath)

	if schema, _ := object["$schema"].(string); schema != SchemaIdentifier {
		t.Errorf("the portable manifest declares the schema %q, expected %q", schema, SchemaIdentifier)
	}
	if name, _ := object["name"].(string); name != "spec-driven-steroids" {
		t.Errorf("the portable manifest declares the name %q", name)
	}
	if version, _ := object["version"].(string); version != "1.2.3" {
		t.Errorf("the portable manifest declares the version %q", version)
	}
	if description, _ := object["description"].(string); description == "" {
		t.Error("the portable manifest declares no description")
	}
	author, ok := object["author"].(map[string]any)
	if !ok {
		t.Fatalf("the portable manifest declares the author %v", object["author"])
	}
	if name, _ := author["name"].(string); name != "lindoelio" {
		t.Errorf("the portable manifest declares the author %q", name)
	}

	references, ok := object["skills"].([]any)
	if !ok {
		t.Fatalf("the portable manifest declares the skills %v", object["skills"])
	}

	skills, err := canonicalSkills()
	if err != nil {
		t.Fatalf("read the canonical skills: %v", err)
	}
	if len(references) != len(skills) {
		t.Fatalf("the portable manifest references %d skills, expected %d", len(references), len(skills))
	}
	for index, skill := range skills {
		reference, _ := references[index].(string)
		if reference != "skills/"+skill {
			t.Errorf("the portable manifest references %q at %d, expected %q", reference, index, "skills/"+skill)
		}
	}
}

func TestVendorManifestsShareThePackageMetadata(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	portable := readObjectFile(t, outDir, PortableManifestPath)
	name, _ := portable["name"].(string)
	version, _ := portable["version"].(string)
	description, _ := portable["description"].(string)

	for _, manifestPath := range []string{ClaudeManifestPath, CursorManifestPath, CodexManifestPath, MiniMaxManifestPath} {
		object := readObjectFile(t, outDir, manifestPath)

		if declared, _ := object["name"].(string); declared != name {
			t.Errorf("%s declares the name %q, expected %q", manifestPath, declared, name)
		}
		if declared, _ := object["version"].(string); declared != version {
			t.Errorf("%s declares the version %q, expected %q", manifestPath, declared, version)
		}
		if declared, _ := object["description"].(string); declared != description {
			t.Errorf("%s declares the description %q, expected %q", manifestPath, declared, description)
		}
	}

	miniMax := readObjectFile(t, outDir, MiniMaxManifestPath)
	if declared, _ := miniMax["author"].(string); declared != "lindoelio" {
		t.Errorf("%s declares the author %q", MiniMaxManifestPath, declared)
	}
	if declared, _ := miniMax["icon"].(string); declared != "https://example.com/icon.png" {
		t.Errorf("%s declares the icon %q", MiniMaxManifestPath, declared)
	}
	if declared, _ := miniMax["category"].(string); declared != "productivity" {
		t.Errorf("%s declares the category %q", MiniMaxManifestPath, declared)
	}
	if schema, _ := miniMax["schemaVersion"].(float64); schema != 1 {
		t.Errorf("%s declares the schema version %v", MiniMaxManifestPath, schema)
	}
}

func TestVendorManifestsDoNotAlterThePortableManifest(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	root, err := os.ReadFile(filepath.Join(outDir, PortableManifestPath))
	if err != nil {
		t.Fatalf("read %s: %v", PortableManifestPath, err)
	}
	subtree, err := os.ReadFile(filepath.Join(outDir, filepath.FromSlash("plugins/lindoelio/spec-driven-steroids/"+PortableManifestPath)))
	if err != nil {
		t.Fatalf("read the package subtree manifest: %v", err)
	}
	if string(root) != string(subtree) {
		t.Error("the package subtree holds a different portable manifest")
	}
}

func TestMiniMaxManifestReferencesEverySkill(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	object := readObjectFile(t, outDir, MiniMaxManifestPath)

	references, ok := object["skills"].([]any)
	if !ok {
		t.Fatalf("the MiniMax manifest declares the skills %v", object["skills"])
	}

	skills, err := canonicalSkills()
	if err != nil {
		t.Fatalf("read the canonical skills: %v", err)
	}
	if len(references) != len(skills) {
		t.Fatalf("the MiniMax manifest references %d skills, expected %d", len(references), len(skills))
	}
	for index, skill := range skills {
		reference, _ := references[index].(string)
		expected := "skills/" + skill + "/SKILL.md"
		if reference != expected {
			t.Errorf("the MiniMax manifest references %q at %d, expected %q", reference, index, expected)
		}
		if _, err := os.Stat(filepath.Join(outDir, filepath.FromSlash(reference))); err != nil {
			t.Errorf("the MiniMax manifest references %q, which the package does not hold", reference)
		}
	}

	if apps, ok := object["apps"].([]any); !ok || len(apps) != 0 {
		t.Errorf("the MiniMax manifest declares the apps %v, expected an empty array", object["apps"])
	}
}

func TestCodexManifestCarriesTheListingInterface(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	object := readObjectFile(t, outDir, CodexManifestPath)

	iface, ok := object["interface"].(map[string]any)
	if !ok {
		t.Fatalf("the Codex manifest declares the interface %v", object["interface"])
	}
	for _, field := range []string{"displayName", "shortDescription", "longDescription", "developerName", "category"} {
		if value, _ := iface[field].(string); strings.TrimSpace(value) == "" {
			t.Errorf("the Codex manifest declares no interface %s", field)
		}
	}
	if skills, _ := object["skills"].(string); skills != "./skills/" {
		t.Errorf("the Codex manifest declares the skills path %q", skills)
	}
}

func TestCursorManifestCarriesTheIconAndTheCategory(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	object := readObjectFile(t, outDir, CursorManifestPath)

	if logo, _ := object["logo"].(string); logo != "https://example.com/icon.png" {
		t.Errorf("the Cursor manifest declares the logo %q", logo)
	}
	if category, _ := object["category"].(string); category != "productivity" {
		t.Errorf("the Cursor manifest declares the category %q", category)
	}
	if skills, _ := object["skills"].(string); skills != "./skills/" {
		t.Errorf("the Cursor manifest declares the skills path %q", skills)
	}
}
