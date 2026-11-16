package pack

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// violationFor returns the violations reported for one marketplace.
func violationFor(violations []string, marketplace string) []string {
	var found []string
	for _, entry := range violations {
		if strings.HasPrefix(entry, marketplace+": ") {
			found = append(found, entry)
		}
	}
	return found
}

func TestValidateAcceptsTheRenderedTree(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	violations, err := Validate(outDir)
	if err != nil {
		t.Fatalf("validate the distribution tree: %v", err)
	}
	if len(violations) > 0 {
		t.Fatalf("the rendered tree violates %d rules: %v", len(violations), violations)
	}
}

func TestValidateRejectsASymbolicLink(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	link := filepath.Join(outDir, "skills", "linked-skill")
	if err := os.Symlink(filepath.Join(outDir, "skills", "spec-driven-planner"), link); err != nil {
		t.Skipf("the platform does not support symbolic links: %v", err)
	}

	violations, err := Validate(outDir)
	if err != nil {
		t.Fatalf("validate the distribution tree: %v", err)
	}
	found := violationFor(violations, treeMarketplace)
	if len(found) == 0 {
		t.Fatalf("the tree holds a symbolic link, but no violation was reported: %v", violations)
	}
	if !strings.Contains(found[0], "symbolic link") {
		t.Errorf("the violation %q does not name the symbolic link", found[0])
	}
}

func TestValidateRejectsANativeBinary(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	executable := filepath.Join(outDir, "skills", "tool.exe")
	if err := os.WriteFile(executable, []byte("MZ\x00\x00binary"), 0o644); err != nil {
		t.Fatalf("write the native binary: %v", err)
	}

	violations, err := Validate(outDir)
	if err != nil {
		t.Fatalf("validate the distribution tree: %v", err)
	}
	found := violationFor(violations, treeMarketplace)
	if len(found) == 0 {
		t.Fatalf("the tree holds a native binary, but no violation was reported: %v", violations)
	}
	if !strings.Contains(found[0], "native binary") {
		t.Errorf("the violation %q does not name the native binary", found[0])
	}
}

func TestValidateRejectsBinaryContentWithoutAKnownExtension(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	binary := filepath.Join(outDir, "skills", "reference.md")
	if err := os.WriteFile(binary, []byte{0x7f, 'E', 'L', 'F', 0x02, 0x01, 0x00, 0x00}, 0o644); err != nil {
		t.Fatalf("write the binary content: %v", err)
	}

	violations, err := Validate(outDir)
	if err != nil {
		t.Fatalf("validate the distribution tree: %v", err)
	}
	if len(violationFor(violations, treeMarketplace)) == 0 {
		t.Fatalf("the tree holds binary content, but no violation was reported: %v", violations)
	}
}

func TestValidateReportsAMissingVendorManifest(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	if err := os.Remove(filepath.Join(outDir, filepath.FromSlash(CursorManifestPath))); err != nil {
		t.Fatalf("remove the Cursor manifest: %v", err)
	}

	violations, err := Validate(outDir)
	if err != nil {
		t.Fatalf("validate the distribution tree: %v", err)
	}
	found := violationFor(violations, MarketplaceCursor)
	if len(found) == 0 {
		t.Fatalf("the tree holds no Cursor manifest, but no violation was reported: %v", violations)
	}
	if !strings.Contains(found[0], CursorManifestPath) {
		t.Errorf("the violation %q does not name the missing manifest", found[0])
	}
}

func TestValidateReportsACatalogThatPointsAtAnotherPackage(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	catalog := readObjectFile(t, outDir, CursorCatalogPath)
	plugins, _ := catalog["plugins"].([]any)
	plugin, _ := plugins[0].(map[string]any)
	plugin["source"] = "./packages/elsewhere"
	raw, err := json.MarshalIndent(catalog, "", "  ")
	if err != nil {
		t.Fatalf("render the catalog: %v", err)
	}
	if err := os.WriteFile(filepath.Join(outDir, filepath.FromSlash(CursorCatalogPath)), raw, 0o644); err != nil {
		t.Fatalf("write the catalog: %v", err)
	}

	violations, err := Validate(outDir)
	if err != nil {
		t.Fatalf("validate the distribution tree: %v", err)
	}
	if len(violationFor(violations, catalogMarketplace)) == 0 {
		t.Fatalf("the catalogs disagree about the package directory, but no violation was reported: %v", violations)
	}
}

func TestValidateReportsAMissingGeminiManifest(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	if err := os.Remove(filepath.Join(outDir, GeminiManifestPath)); err != nil {
		t.Fatalf("remove the Gemini manifest: %v", err)
	}

	violations, err := Validate(outDir)
	if err != nil {
		t.Fatalf("validate the distribution tree: %v", err)
	}
	found := violationFor(violations, MarketplaceGemini)
	if len(found) == 0 {
		t.Fatalf("the tree holds no Gemini manifest, but no violation was reported: %v", violations)
	}
}

func TestValidateReportsAnUnreadableTree(t *testing.T) {
	if _, err := Validate(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Fatal("the validation accepted a tree that does not exist")
	}
}

func TestRenderReplacesAPreExistingSymlink(t *testing.T) {
	outDir := filepath.Join(t.TempDir(), "distribution")
	options := testOptions(outDir)

	if err := os.MkdirAll(filepath.Join(outDir, "skills"), 0o755); err != nil {
		t.Fatalf("create the output directory: %v", err)
	}
	link := filepath.Join(outDir, "skills", "linked")
	if err := os.Symlink(filepath.Join(outDir, "skills"), link); err != nil {
		t.Skipf("the platform does not support symbolic links: %v", err)
	}

	// The render validates the tree it is about to write, so an entry left
	// outside that tree is replaced rather than followed or validated.
	if _, err := Render(options); err != nil {
		t.Fatalf("the render failed on a pre-existing entry: %v", err)
	}
	if info, err := os.Lstat(link); err == nil && info.Mode()&os.ModeSymlink != 0 {
		t.Error("the render kept the pre-existing symbolic link")
	}
}
