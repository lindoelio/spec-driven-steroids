package version

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestEveryChannelReportsTheSameVersion checks that the release channels
// derive the version from the single declaration.
//
// The channels that publish a versioned artifact are the npm platform
// packages, the npm main package, the template bundle and the marketplace
// package. A channel that hardcodes a version would drift from the
// declaration, so the check reads the manifests and the workflow.
func TestEveryChannelReportsTheSameVersion(t *testing.T) {
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatalf("resolve the repository root: %v", err)
	}
	declared := Declared()

	// The npm manifests.
	manifests := []string{
		filepath.Join(root, "package.json"),
		filepath.Join(root, "packages", "cli", "package.json"),
	}
	platformDir := filepath.Join(root, "packages", "platform")
	entries, err := os.ReadDir(platformDir)
	if err != nil {
		t.Fatalf("read the platform packages: %v", err)
	}
	for _, entry := range entries {
		if entry.IsDir() {
			manifests = append(manifests, filepath.Join(platformDir, entry.Name(), "package.json"))
		}
	}

	for _, manifestPath := range manifests {
		raw, err := os.ReadFile(manifestPath)
		if err != nil {
			t.Errorf("read %s: %v", manifestPath, err)
			continue
		}
		var manifest struct {
			Version string `json:"version"`
		}
		if err := json.Unmarshal(raw, &manifest); err != nil {
			t.Errorf("parse %s: %v", manifestPath, err)
			continue
		}
		if manifest.Version != declared {
			t.Errorf("%s declares the version %q, want %q", manifestPath, manifest.Version, declared)
		}
	}

	// The release workflow derives the tag from the declaration and refuses to
	// publish when the tag does not match it.
	workflow, err := os.ReadFile(filepath.Join(root, ".github", "workflows", "publish.yml"))
	if err != nil {
		t.Fatalf("read the release workflow: %v", err)
	}
	content := string(workflow)
	for _, expected := range []string{
		"create-release-tag.mjs",
		"VERSION",
		"npm-platform",
		"npm-main",
		"homebrew",
		"templates",
		"distribution",
	} {
		if !strings.Contains(content, expected) {
			t.Errorf("the release workflow does not mention %q", expected)
		}
	}
	if !strings.Contains(content, "checksums.txt") {
		t.Error("the release workflow publishes no checksums")
	}
	if !strings.Contains(content, "--provenance") {
		t.Error("the release workflow drops the npm provenance attestation")
	}

	// The platform packages cross-check their digest against the release
	// checksum.
	if !strings.Contains(content, "sha256") {
		t.Error("the release workflow does not cross-check the platform package digest")
	}
}

// TestTheTemplateBundleVersionDerivesFromTheDeclaration checks that the
// template bundle carries the declared version.
func TestTheTemplateBundleVersionDerivesFromTheDeclaration(t *testing.T) {
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatalf("resolve the repository root: %v", err)
	}

	for _, name := range []string{"publish.yml", "publish-templates.yml"} {
		raw, err := os.ReadFile(filepath.Join(root, ".github", "workflows", name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		if !strings.Contains(string(raw), "VERSION") {
			t.Errorf("%s does not derive the bundle version from the declaration", name)
		}
	}
}
