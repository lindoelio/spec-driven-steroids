// Package pack renders the portable Agent Plugin package, the vendor
// manifests, the marketplace catalogs and the distribution tree.
//
// The portable package holds a `plugin.json` manifest, the canonical skills
// tree and an optional `mcp.json`. Every vendor manifest is derived from the
// same package metadata and is emitted beside the portable manifest without
// altering it; the Gemini CLI extension manifest is the single exception and
// belongs at the root of the distribution tree. Every catalog references the
// same package directory and the same package version, and one shared catalog
// serves the two marketplaces that read the same path.
//
// The rendered tree is validated against the documented layout of every
// consuming marketplace, and a tree that holds a symbolic link or a native
// binary is rejected.
//
// The tree belongs outside the working tree of this repository, because the
// repository ignores the path the Codex catalog lives at.
package pack

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/assets"
)

// SchemaIdentifier is the Agent Plugins schema the portable manifest declares.
const SchemaIdentifier = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"

// The identity patterns the package metadata must satisfy. An owner or a name
// outside these patterns would escape the package subtree path or break a
// vendor schema, so the tree is rejected before anything is written.
var (
	packageNameShape    = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$`)
	packageOwnerPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)
)

// validPackageName reports whether a name satisfies the Agent Plugins name
// schema: lowercase, alphanumeric with '.' or '-' separators, at most 64
// characters, and never a doubled separator.
func validPackageName(name string) bool {
	if len(name) == 0 || len(name) > 64 {
		return false
	}
	if strings.Contains(name, "--") || strings.Contains(name, "..") {
		return false
	}
	return packageNameShape.MatchString(name)
}

// Options configures a packaging run.
type Options struct {
	// OutDir is the directory the distribution tree is written to. It must
	// be OUTSIDE the repository working tree, because the repository ignores
	// some of the paths the catalogs need.
	OutDir string
	// Version is the package version.
	Version string
	// Owner is the marketplace owner name.
	Owner string
	// PackageName is the portable package name.
	PackageName string
	// Description is the package description.
	Description string
	// Author is the package author.
	Author string
	// Icon is the package icon path or URL.
	Icon string
	// Category is the marketplace category.
	Category string
	// MCPConfig is the optional MCP configuration, as raw JSON. Empty means none.
	MCPConfig []byte
	// DryRun computes the tree without writing it.
	DryRun bool
}

// Result reports what a packaging run produced.
type Result struct {
	// OutDir is the directory the tree was written to.
	OutDir string
	// Files are the written files, relative to OutDir, sorted.
	Files []string
	// Catalogs are the catalog paths, relative to OutDir, sorted.
	Catalogs []string
	// Publication reports the publication mode of every marketplace.
	Publication []Publication
}

// Render renders the portable package, the vendor manifests, the catalogs and
// the distribution tree.
//
// The tree is written to a staging directory and validated against the layout
// every consuming marketplace expects before it reaches Options.OutDir, so a
// tree that violates a layout never leaves a partial package behind. A dry
// run validates the computed tree and writes nothing to Options.OutDir.
func Render(options Options) (Result, error) {
	if strings.TrimSpace(options.OutDir) == "" {
		return Result{}, errors.New("pack: the output directory is required")
	}

	meta, err := buildMeta(options)
	if err != nil {
		return Result{}, err
	}

	tree, err := buildTree(meta)
	if err != nil {
		return Result{}, err
	}

	result := Result{
		OutDir:      options.OutDir,
		Files:       tree.paths(),
		Catalogs:    catalogPaths(),
		Publication: PublicationReport(),
	}

	if options.DryRun {
		if err := validateTree(tree); err != nil {
			return result, err
		}
		return result, nil
	}

	parent := filepath.Dir(options.OutDir)
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return result, fmt.Errorf("pack: create the output parent: %w", err)
	}
	staging, err := os.MkdirTemp(parent, ".sds-package-")
	if err != nil {
		return result, fmt.Errorf("pack: create the staging directory: %w", err)
	}
	defer os.RemoveAll(staging)

	if err := tree.write(staging); err != nil {
		return result, err
	}
	if err := validateTree(tree); err != nil {
		return result, err
	}

	if err := mergeTree(staging, options.OutDir); err != nil {
		return result, err
	}

	return result, nil
}

// validateTree writes the planned tree to a temporary directory and validates
// it, so the vendor rules run against the exact bytes the release would ship.
func validateTree(tree *tree) error {
	staging, err := os.MkdirTemp("", "sds-package-validate-")
	if err != nil {
		return fmt.Errorf("pack: create the validation directory: %w", err)
	}
	defer os.RemoveAll(staging)

	if err := tree.write(staging); err != nil {
		return err
	}
	violations, err := Validate(staging)
	if err != nil {
		return err
	}
	if len(violations) > 0 {
		return fmt.Errorf("pack: the distribution tree violates %d marketplace rules: %s",
			len(violations), strings.Join(violations, "; "))
	}
	return nil
}

// mergeTree moves the staged entries into the output directory, replacing an
// entry of the same name.
func mergeTree(staging, outDir string) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return fmt.Errorf("pack: create the output directory: %w", err)
	}
	entries, err := os.ReadDir(staging)
	if err != nil {
		return fmt.Errorf("pack: read the staging directory: %w", err)
	}
	for _, entry := range entries {
		source := filepath.Join(staging, entry.Name())
		target := filepath.Join(outDir, entry.Name())
		if err := os.RemoveAll(target); err != nil {
			return fmt.Errorf("pack: replace %s: %w", target, err)
		}
		if err := os.Rename(source, target); err != nil {
			return fmt.Errorf("pack: place %s: %w", target, err)
		}
	}
	return nil
}

// packageMeta is the identity every manifest and catalog is derived from.
type packageMeta struct {
	// name is the portable package name.
	name string
	// version is the package version.
	version string
	// owner is the marketplace owner name.
	owner string
	// description is the package description.
	description string
	// author is the package author.
	author string
	// icon is the package icon path or URL.
	icon string
	// category is the marketplace category.
	category string
	// skills are the packaged skill directory names, sorted.
	skills []string
	// mcp holds the raw MCP configuration, empty when none is supplied.
	mcp []byte
	// mcpServers holds the parsed MCP servers, empty when none is supplied.
	mcpServers map[string]json.RawMessage
}

// hasMCP reports whether an MCP configuration was supplied.
func (m packageMeta) hasMCP() bool { return len(m.mcp) > 0 }

// buildMeta validates the options and derives the package metadata.
func buildMeta(options Options) (packageMeta, error) {
	meta := packageMeta{
		name:        strings.TrimSpace(options.PackageName),
		version:     strings.TrimSpace(options.Version),
		owner:       strings.TrimSpace(options.Owner),
		description: strings.TrimSpace(options.Description),
		author:      strings.TrimSpace(options.Author),
		icon:        strings.TrimSpace(options.Icon),
		category:    strings.TrimSpace(options.Category),
	}

	required := []struct {
		field string
		value string
	}{
		{"packageName", meta.name},
		{"version", meta.version},
		{"owner", meta.owner},
		{"description", meta.description},
		{"author", meta.author},
		{"icon", meta.icon},
		{"category", meta.category},
	}
	for _, entry := range required {
		if entry.value == "" {
			return packageMeta{}, fmt.Errorf("pack: %s is required", entry.field)
		}
	}

	if !validPackageName(meta.name) {
		return packageMeta{}, fmt.Errorf("pack: the package name %q must be a lowercase name of at most 64 characters with no '--' or '..'", meta.name)
	}
	if !packageOwnerPattern.MatchString(meta.owner) {
		return packageMeta{}, fmt.Errorf("pack: the owner %q must start with a letter or digit and hold only letters, digits, '.', '_' and '-'", meta.owner)
	}

	skills, err := canonicalSkills()
	if err != nil {
		return packageMeta{}, err
	}
	meta.skills = skills

	if len(options.MCPConfig) > 0 {
		if !json.Valid(options.MCPConfig) {
			return packageMeta{}, errors.New("pack: the MCP configuration is not valid JSON")
		}
		servers, err := parseMCPServers(options.MCPConfig)
		if err != nil {
			return packageMeta{}, err
		}
		meta.mcp = append([]byte(nil), options.MCPConfig...)
		meta.mcpServers = servers
	}

	return meta, nil
}

// canonicalSkills returns the skill directory names of the canonical tree.
//
// The inventory comes from the embedded tree, so the packaged skills are
// exactly the artifacts the CLI injects.
func canonicalSkills() ([]string, error) {
	tree := assets.CanonicalFS()
	entries, err := fs.ReadDir(tree, canonicalSkillsDir)
	if err != nil {
		return nil, fmt.Errorf("pack: read the canonical skills: %w", err)
	}

	var skills []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		if _, err := fs.Stat(tree, path.Join(canonicalSkillsDir, name, skillFile)); err != nil {
			continue
		}
		skills = append(skills, name)
	}
	sort.Strings(skills)
	if len(skills) == 0 {
		return nil, errors.New("pack: the canonical tree holds no skill")
	}
	return skills, nil
}

// parseMCPServers reads the MCP servers of a configuration.
//
// The configuration holds either the server map itself or the map below an
// `mcpServers` key.
func parseMCPServers(raw []byte) (map[string]json.RawMessage, error) {
	var wrapper struct {
		MCPServers map[string]json.RawMessage `json:"mcpServers"`
	}
	if err := json.Unmarshal(raw, &wrapper); err == nil && wrapper.MCPServers != nil {
		return wrapper.MCPServers, nil
	}

	var servers map[string]json.RawMessage
	if err := json.Unmarshal(raw, &servers); err != nil {
		return nil, fmt.Errorf("pack: read the MCP configuration: %w", err)
	}
	if servers == nil {
		servers = map[string]json.RawMessage{}
	}
	return servers, nil
}

// entry is one file of the rendered tree.
type entry struct {
	// destination is the path of the file, relative to the tree root.
	destination string
	// content holds the literal content of the file.
	content []byte
	// source holds the path of the copied file in the canonical tree.
	source string
}

// tree is the planned content of a distribution tree.
type tree struct {
	// entries are the files of the tree.
	entries []entry
}

// add records a file with literal content.
func (t *tree) add(destination string, content []byte) {
	t.entries = append(t.entries, entry{destination: destination, content: content})
}

// copy records a file copied from the canonical tree.
func (t *tree) copy(destination, source string) {
	t.entries = append(t.entries, entry{destination: destination, source: source})
}

// paths returns the paths of every file of the tree, sorted.
func (t *tree) paths() []string {
	paths := make([]string, 0, len(t.entries))
	for _, item := range t.entries {
		paths = append(paths, item.destination)
	}
	sort.Strings(paths)
	return paths
}

// write writes the tree below a directory.
//
// A destination that escapes the directory is rejected instead of written.
func (t *tree) write(outDir string) error {
	base, err := filepath.Abs(outDir)
	if err != nil {
		return fmt.Errorf("pack: resolve the output directory: %w", err)
	}
	for _, item := range t.entries {
		target := filepath.Join(base, filepath.FromSlash(item.destination))
		if target != base && !strings.HasPrefix(target, base+string(os.PathSeparator)) {
			return fmt.Errorf("pack: %s escapes the output directory", item.destination)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return fmt.Errorf("pack: create the directory of %s: %w", item.destination, err)
		}

		content := item.content
		if item.source != "" {
			raw, err := fs.ReadFile(assets.CanonicalFS(), item.source)
			if err != nil {
				return fmt.Errorf("pack: read %s from the canonical tree: %w", item.source, err)
			}
			content = raw
		}

		if err := os.WriteFile(target, content, 0o644); err != nil {
			return fmt.Errorf("pack: write %s: %w", item.destination, err)
		}
	}
	return nil
}
