package bundle

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBundledFSCarriesTheRequiredSkills(t *testing.T) {
	tree := BundledFS()

	entries, err := fs.ReadDir(tree, "universal/skills")
	if err != nil {
		t.Fatalf("read skills: %v", err)
	}

	available := map[string]bool{}
	for _, entry := range entries {
		available[entry.Name()] = true
	}

	for _, skill := range RequiredSkills() {
		if !available[skill] {
			t.Fatalf("the embedded tree does not carry the skill %q", skill)
		}
		if _, err := fs.ReadFile(tree, "universal/skills/"+skill+"/SKILL.md"); err != nil {
			t.Fatalf("read the entry point of %q: %v", skill, err)
		}
	}

	for _, file := range RequiredSkillFiles([]string{"spec-driven-planner"}) {
		if _, err := fs.ReadFile(tree, file); err != nil {
			t.Fatalf("read %q: %v", file, err)
		}
	}
}

func TestBundledFSExposesTheRemoteBundleLayout(t *testing.T) {
	tree := BundledFS()

	entries, err := fs.ReadDir(tree, ".")
	if err != nil {
		t.Fatalf("read root: %v", err)
	}
	if len(entries) != 1 || entries[0].Name() != "universal" || !entries[0].IsDir() {
		t.Fatalf("root entries = %v, want the universal directory", entries)
	}

	if _, err := fs.Stat(tree, "universal/agents/spec-driven.agent.md"); err != nil {
		t.Fatalf("stat agent: %v", err)
	}
	if _, err := fs.Stat(tree, "universal/commands/spec-driven.command.md"); err != nil {
		t.Fatalf("stat command: %v", err)
	}
}

func TestExtractedBundleWritesTheCacheMarker(t *testing.T) {
	root := t.TempDir()
	manifest, bundle := defaultBundle()
	stub := &fetchStub{manifest: manifest, bundle: bundle}

	result := resolveFixture(t, root, ResolveOptions{Fetch: stub.fetch, Source: SourceRemote})

	markerPath := filepath.Join(filepath.Dir(result.RootDir), markerFileName)
	raw, err := os.ReadFile(markerPath)
	if err != nil {
		t.Fatalf("read marker: %v", err)
	}

	text := string(raw)
	if !strings.HasSuffix(text, "}\n") {
		t.Fatalf("marker = %q, want a trailing newline", text)
	}
	if !strings.Contains(text, "\n  \"sha256\": \"") {
		t.Fatalf("marker = %q, want the indented document of the previous release", text)
	}
	if !strings.Contains(text, "\"universal/agents/spec-driven.agent.md\": \"") {
		t.Fatalf("marker = %q, want the file digests", text)
	}
}
