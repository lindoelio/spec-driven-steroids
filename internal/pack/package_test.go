package pack

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/lindoelio/spec-driven-steroids/internal/assets"
)

// testOptions returns the options of a packaging run.
func testOptions(outDir string) Options {
	return Options{
		OutDir:      outDir,
		Version:     "1.2.3",
		Owner:       "lindoelio",
		PackageName: "spec-driven-steroids",
		Description: "A spec-driven workflow for AI coding tools.",
		Author:      "lindoelio",
		Icon:        "https://example.com/icon.png",
		Category:    "productivity",
	}
}

// renderTree renders a distribution tree into a temporary directory.
func renderTree(t *testing.T, options Options) (string, Result) {
	t.Helper()

	outDir := filepath.Join(t.TempDir(), "distribution")
	options.OutDir = outDir
	result, err := Render(options)
	if err != nil {
		t.Fatalf("render the distribution tree: %v", err)
	}
	return outDir, result
}

// canonicalFiles returns the canonical skill files, relative to the canonical
// tree root.
func canonicalFiles(t *testing.T) []string {
	t.Helper()

	files, err := canonicalSkillFiles()
	if err != nil {
		t.Fatalf("read the canonical skill files: %v", err)
	}
	return files
}

// readObjectFile reads a JSON object of the rendered tree.
func readObjectFile(t *testing.T, outDir, relative string) map[string]any {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join(outDir, filepath.FromSlash(relative)))
	if err != nil {
		t.Fatalf("read %s: %v", relative, err)
	}
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err != nil {
		t.Fatalf("parse %s: %v", relative, err)
	}
	return object
}

func TestRenderProducesTheDocumentedTree(t *testing.T) {
	outDir, result := renderTree(t, testOptions(""))

	expected := []string{
		".agents/plugins/marketplace.json",
		".claude-plugin/marketplace.json",
		".claude-plugin/plugin.json",
		".codex-plugin/plugin.json",
		".cursor-plugin/marketplace.json",
		".cursor-plugin/plugin.json",
		".minimax-plugin/plugin.json",
		"gemini-extension.json",
		"icon.png",
		"plugin.json",
		"plugins/lindoelio/spec-driven-steroids/plugin.json",
	}
	for _, file := range canonicalFiles(t) {
		expected = append(expected, file, "plugins/lindoelio/spec-driven-steroids/"+file)
	}
	sort.Strings(expected)

	if len(result.Files) != len(expected) {
		t.Fatalf("the tree holds %d files, expected %d: %v", len(result.Files), len(expected), result.Files)
	}
	for index, file := range expected {
		if result.Files[index] != file {
			t.Errorf("file %d is %q, expected %q", index, result.Files[index], file)
		}
	}

	catalogs := []string{".agents/plugins/marketplace.json", ".claude-plugin/marketplace.json", ".cursor-plugin/marketplace.json"}
	if len(result.Catalogs) != len(catalogs) {
		t.Fatalf("the run reported %v, expected %v", result.Catalogs, catalogs)
	}
	for index, catalog := range catalogs {
		if result.Catalogs[index] != catalog {
			t.Errorf("catalog %d is %q, expected %q", index, result.Catalogs[index], catalog)
		}
	}

	for _, file := range expected {
		if _, err := os.Stat(filepath.Join(outDir, filepath.FromSlash(file))); err != nil {
			t.Errorf("%s is missing from the tree: %v", file, err)
		}
	}
}

func TestRenderCopiesTheCanonicalSkillsUnmodified(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	files := canonicalFiles(t)
	if len(files) == 0 {
		t.Fatal("the canonical tree holds no skill file")
	}

	for _, file := range files {
		expected, err := fs.ReadFile(assets.CanonicalFS(), file)
		if err != nil {
			t.Fatalf("read %s from the embedded tree: %v", file, err)
		}
		for _, destination := range []string{
			file,
			"plugins/lindoelio/spec-driven-steroids/" + file,
		} {
			actual, err := os.ReadFile(filepath.Join(outDir, filepath.FromSlash(destination)))
			if err != nil {
				t.Fatalf("read %s: %v", destination, err)
			}
			if string(actual) != string(expected) {
				t.Errorf("%s differs from the embedded canonical content", destination)
			}
		}
	}
}

func TestRenderWritesNothingInDryRun(t *testing.T) {
	outDir := filepath.Join(t.TempDir(), "distribution")
	options := testOptions(outDir)
	options.DryRun = true

	result, err := Render(options)
	if err != nil {
		t.Fatalf("render the distribution tree: %v", err)
	}
	if len(result.Files) == 0 {
		t.Fatal("the dry run reported no file")
	}
	if _, err := os.Stat(outDir); !os.IsNotExist(err) {
		t.Errorf("the dry run created %s", outDir)
	}
}

func TestRenderRejectsAnIncompleteOption(t *testing.T) {
	cases := map[string]func(*Options){
		"packageName": func(options *Options) { options.PackageName = "" },
		"version":     func(options *Options) { options.Version = "" },
		"owner":       func(options *Options) { options.Owner = "" },
		"description": func(options *Options) { options.Description = "" },
		"author":      func(options *Options) { options.Author = "" },
		"icon":        func(options *Options) { options.Icon = "" },
		"category":    func(options *Options) { options.Category = "" },
	}

	for field, mutate := range cases {
		t.Run(field, func(t *testing.T) {
			options := testOptions(filepath.Join(t.TempDir(), "distribution"))
			mutate(&options)

			_, err := Render(options)
			if err == nil {
				t.Fatalf("the run accepted an empty %s", field)
			}
			if !strings.Contains(err.Error(), field) {
				t.Errorf("the error %q does not name the %s", err, field)
			}
		})
	}
}

func TestRenderRejectsAnInvalidMCPConfiguration(t *testing.T) {
	options := testOptions(filepath.Join(t.TempDir(), "distribution"))
	options.MCPConfig = []byte("{not json")

	_, err := Render(options)
	if err == nil {
		t.Fatal("the run accepted an invalid MCP configuration")
	}
	if !strings.Contains(err.Error(), "MCP") {
		t.Errorf("the error %q does not name the MCP configuration", err)
	}
}

func TestRenderWritesTheMCPConfiguration(t *testing.T) {
	outDir, _ := renderTree(t, testOptions(""))

	if _, err := os.Stat(filepath.Join(outDir, MCPConfigPath)); !os.IsNotExist(err) {
		t.Errorf("the tree holds an %s without an MCP configuration", MCPConfigPath)
	}

	options := testOptions("")
	options.MCPConfig = []byte(`{"mcpServers":{"acme":{"command":"node","args":["server.js"]}}}`)
	outDir, _ = renderTree(t, options)

	raw, err := os.ReadFile(filepath.Join(outDir, MCPConfigPath))
	if err != nil {
		t.Fatalf("read %s: %v", MCPConfigPath, err)
	}
	if string(raw) != string(options.MCPConfig) {
		t.Errorf("the MCP configuration is %q, expected %q", raw, options.MCPConfig)
	}

	for _, manifest := range []string{ClaudeManifestPath, CursorManifestPath, CodexManifestPath} {
		object := readObjectFile(t, outDir, manifest)
		if servers, _ := object["mcpServers"].(string); servers != "./"+MCPConfigPath {
			t.Errorf("%s declares the MCP path %v, expected %q", manifest, object["mcpServers"], "./"+MCPConfigPath)
		}
	}

	miniMax := readObjectFile(t, outDir, MiniMaxManifestPath)
	servers, ok := miniMax["mcpServers"].([]any)
	if !ok || len(servers) != 1 || servers[0] != MCPConfigPath {
		t.Errorf("%s declares the MCP servers %v, expected [%q]", MiniMaxManifestPath, miniMax["mcpServers"], MCPConfigPath)
	}

	gemini := readObjectFile(t, outDir, GeminiManifestPath)
	if _, ok := gemini["mcpServers"].(map[string]any); !ok {
		t.Errorf("%s declares no MCP servers", GeminiManifestPath)
	}
}

func TestRenderReportsEveryMarketplace(t *testing.T) {
	_, result := renderTree(t, testOptions(""))

	report := PublicationReport()
	if len(result.Publication) != len(report) {
		t.Fatalf("the run reported %d marketplaces, expected %d", len(result.Publication), len(report))
	}
	for index, publication := range report {
		if result.Publication[index] != publication {
			t.Errorf("publication %d is %v, expected %v", index, result.Publication[index], publication)
		}
	}
}
