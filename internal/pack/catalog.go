package pack

import (
	"fmt"
	"io/fs"
	"path"
	"sort"

	"github.com/lindoelio/spec-driven-steroids/internal/assets"
)

// The catalog paths, relative to the distribution tree root.
const (
	// ClaudeCatalogPath is where Claude Code reads a marketplace catalog.
	ClaudeCatalogPath = ".claude-plugin/marketplace.json"
	// CodexCatalogPath is where Codex reads a marketplace catalog.
	CodexCatalogPath = ".agents/plugins/marketplace.json"
	// CursorCatalogPath is where Cursor reads a marketplace catalog.
	CursorCatalogPath = ".cursor-plugin/marketplace.json"
)

// The layout of the distribution tree.
const (
	// pluginsDir holds the package subtree of the MiniMax community registry.
	pluginsDir = "plugins"
	// packageSource is the package directory every catalog references.
	//
	// The distribution tree root is the package the vendor manifests
	// describe, so a marketplace that resolves the source finds the manifest
	// it reads. The MiniMax community registry takes the same package below
	// its own subtree, which the distribution tree carries as well.
	packageSource = "./"
)

// catalogOwner is the maintainer of a marketplace.
type catalogOwner struct {
	// Name is the owner name.
	Name string `json:"name"`
}

// catalogPlugin is one entry of a marketplace catalog.
type catalogPlugin struct {
	// Name is the plugin identifier.
	Name string `json:"name"`
	// Description is the plugin description.
	Description string `json:"description"`
	// Version is the plugin version.
	Version string `json:"version"`
	// Author is the plugin author.
	Author manifestAuthor `json:"author"`
	// Source is where the package is fetched from.
	Source string `json:"source"`
	// Category is the marketplace category.
	Category string `json:"category"`
}

// catalogMetadata is the metadata of a marketplace.
type catalogMetadata struct {
	// Description is the marketplace description.
	Description string `json:"description"`
	// Version is the marketplace version.
	Version string `json:"version"`
}

// sharedCatalog is the catalog of the marketplaces that read the same path.
//
// Claude Code reads it at `.claude-plugin/marketplace.json` and Codex reads
// the same content at `.agents/plugins/marketplace.json`.
type sharedCatalog struct {
	// Schema is the JSON schema of the catalog.
	Schema string `json:"$schema"`
	// Name is the marketplace identifier.
	Name string `json:"name"`
	// Version is the marketplace version.
	Version string `json:"version"`
	// Description is the marketplace description.
	Description string `json:"description"`
	// Owner is the marketplace maintainer.
	Owner catalogOwner `json:"owner"`
	// Plugins are the installable packages.
	Plugins []catalogPlugin `json:"plugins"`
}

// cursorCatalog is the catalog of the Cursor marketplace.
//
// Cursor reads the marketplace version from the metadata object rather than
// from a top level field.
type cursorCatalog struct {
	// Name is the marketplace identifier.
	Name string `json:"name"`
	// Owner is the marketplace maintainer.
	Owner catalogOwner `json:"owner"`
	// Metadata is the marketplace metadata.
	Metadata catalogMetadata `json:"metadata"`
	// Plugins are the installable packages.
	Plugins []catalogPlugin `json:"plugins"`
}

// marketplaceName returns the identifier of the marketplace that serves the
// package.
func marketplaceName(meta packageMeta) string {
	return meta.owner + "-" + meta.name
}

// catalogPluginEntry returns the catalog entry of the package.
//
// Every catalog references the same package directory and the same package
// version.
func catalogPluginEntry(meta packageMeta) catalogPlugin {
	return catalogPlugin{
		Name:        meta.name,
		Description: meta.description,
		Version:     meta.version,
		Author:      manifestAuthor{Name: meta.author},
		Source:      packageSource,
		Category:    meta.category,
	}
}

// sharedCatalogJSON renders the catalog of the marketplaces that read the
// same path.
func sharedCatalogJSON(meta packageMeta) ([]byte, error) {
	catalog := sharedCatalog{
		Schema:      "https://json.schemastore.org/claude-code-marketplace.json",
		Name:        marketplaceName(meta),
		Version:     meta.version,
		Description: meta.description,
		Owner:       catalogOwner{Name: meta.owner},
		Plugins:     []catalogPlugin{catalogPluginEntry(meta)},
	}
	return marshalJSON(catalog)
}

// cursorCatalogJSON renders the catalog of the Cursor marketplace.
func cursorCatalogJSON(meta packageMeta) ([]byte, error) {
	catalog := cursorCatalog{
		Name:     marketplaceName(meta),
		Owner:    catalogOwner{Name: meta.owner},
		Metadata: catalogMetadata{Description: meta.description, Version: meta.version},
		Plugins:  []catalogPlugin{catalogPluginEntry(meta)},
	}
	return marshalJSON(catalog)
}

// catalogPaths returns the catalog paths of the distribution tree, sorted.
func catalogPaths() []string {
	paths := []string{ClaudeCatalogPath, CodexCatalogPath, CursorCatalogPath}
	sort.Strings(paths)
	return paths
}

// packageSubtreePath returns the path of the package subtree of the MiniMax
// community registry, relative to the distribution tree root.
func packageSubtreePath(meta packageMeta) string {
	return path.Join(pluginsDir, meta.owner, meta.name)
}

// buildTree plans the content of the distribution tree.
//
// The tree holds the portable package at its root, the vendor manifests beside
// the portable manifest, the catalog of every marketplace and the package
// subtree the MiniMax community registry takes.
func buildTree(meta packageMeta) (*tree, error) {
	portable, err := portableManifestJSON(meta)
	if err != nil {
		return nil, err
	}
	claude, err := claudeManifestJSON(meta)
	if err != nil {
		return nil, err
	}
	cursor, err := cursorManifestJSON(meta)
	if err != nil {
		return nil, err
	}
	codex, err := codexManifestJSON(meta)
	if err != nil {
		return nil, err
	}
	miniMax, err := miniMaxManifestJSON(meta)
	if err != nil {
		return nil, err
	}
	gemini, err := geminiManifestJSON(meta)
	if err != nil {
		return nil, err
	}
	shared, err := sharedCatalogJSON(meta)
	if err != nil {
		return nil, err
	}
	cursorCatalog, err := cursorCatalogJSON(meta)
	if err != nil {
		return nil, err
	}

	planned := &tree{}
	planned.add(PortableManifestPath, portable)
	planned.add(ClaudeManifestPath, claude)
	planned.add(CursorManifestPath, cursor)
	planned.add(CodexManifestPath, codex)
	planned.add(MiniMaxManifestPath, miniMax)
	planned.add(GeminiManifestPath, gemini)
	planned.add(ClaudeCatalogPath, shared)
	planned.add(CodexCatalogPath, shared)
	planned.add(CursorCatalogPath, cursorCatalog)

	if meta.hasMCP() {
		planned.add(MCPConfigPath, meta.mcp)
	}

	subtree := packageSubtreePath(meta)
	planned.add(path.Join(subtree, PortableManifestPath), portable)

	skills, err := canonicalSkillFiles()
	if err != nil {
		return nil, err
	}
	for _, skill := range skills {
		planned.copy(skill, skill)
		planned.copy(path.Join(subtree, skill), skill)
	}

	return planned, nil
}

// canonicalSkillFiles returns the paths of the canonical skill files, relative
// to the canonical tree root.
func canonicalSkillFiles() ([]string, error) {
	tree := assets.CanonicalFS()
	var files []string
	err := fs.WalkDir(tree, canonicalSkillsDir, func(current string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		files = append(files, current)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("pack: read the canonical skills: %w", err)
	}
	sort.Strings(files)
	return files, nil
}
