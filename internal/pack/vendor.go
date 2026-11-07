package pack

import (
	"encoding/json"
	"fmt"
	"path"
)

// The vendor manifest paths, relative to the distribution tree root.
const (
	// PortableManifestPath is the portable manifest of the package.
	PortableManifestPath = "plugin.json"
	// MCPConfigPath is the optional MCP configuration of the package.
	MCPConfigPath = "mcp.json"
	// ClaudeManifestPath is the Claude Code plugin manifest.
	ClaudeManifestPath = ".claude-plugin/plugin.json"
	// CursorManifestPath is the Cursor plugin manifest.
	CursorManifestPath = ".cursor-plugin/plugin.json"
	// CodexManifestPath is the Codex plugin manifest.
	CodexManifestPath = ".codex-plugin/plugin.json"
	// MiniMaxManifestPath is the MiniMax Code plugin manifest.
	MiniMaxManifestPath = ".minimax-plugin/plugin.json"
	// GeminiManifestPath is the Gemini CLI extension manifest, at the root of
	// the distribution tree.
	GeminiManifestPath = "gemini-extension.json"
)

// The paths of the canonical content inside the portable package.
const (
	// canonicalSkillsDir holds the canonical skills tree.
	canonicalSkillsDir = "skills"
	// skillFile is the file every skill directory holds.
	skillFile = "SKILL.md"
	// skillsPath is the path of the skills tree, relative to the package root.
	skillsPath = "./" + canonicalSkillsDir + "/"
	// mcpPath is the path of the MCP configuration, relative to the package root.
	mcpPath = "./" + MCPConfigPath
)

// manifestAuthor is the author of a manifest.
type manifestAuthor struct {
	// Name is the author name.
	Name string `json:"name"`
}

// portableManifest is the portable Agent Plugin manifest.
//
// It declares the plugin identity, the schema identifier, the version, the
// description and the packaged skills.
type portableManifest struct {
	// Schema is the Agent Plugins schema identifier.
	Schema string `json:"$schema"`
	// Name is the plugin identifier.
	Name string `json:"name"`
	// Description is the plugin description.
	Description string `json:"description"`
	// Version is the plugin version.
	Version string `json:"version"`
	// Author is the plugin author.
	Author manifestAuthor `json:"author"`
	// MCPServers points at the MCP configuration, absent without one.
	MCPServers string `json:"mcpServers,omitempty"`
}

// claudeManifest is the Claude Code plugin manifest.
type claudeManifest struct {
	// Name is the plugin identifier.
	Name string `json:"name"`
	// Description is the plugin description.
	Description string `json:"description"`
	// Version is the plugin version.
	Version string `json:"version"`
	// Author is the plugin author.
	Author manifestAuthor `json:"author"`
	// Skills points at the skills tree of the package.
	Skills string `json:"skills"`
	// MCPServers points at the MCP configuration, absent without one.
	MCPServers string `json:"mcpServers,omitempty"`
}

// cursorManifest is the Cursor plugin manifest.
type cursorManifest struct {
	// Name is the plugin identifier.
	Name string `json:"name"`
	// DisplayName is the human readable plugin name.
	DisplayName string `json:"displayName"`
	// Description is the plugin description.
	Description string `json:"description"`
	// Version is the plugin version.
	Version string `json:"version"`
	// Author is the plugin author.
	Author manifestAuthor `json:"author"`
	// Category is the marketplace category.
	Category string `json:"category"`
	// Logo is the plugin icon path or URL.
	Logo string `json:"logo"`
	// Skills points at the skills tree of the package.
	Skills string `json:"skills"`
	// MCPServers points at the MCP configuration, absent without one.
	MCPServers string `json:"mcpServers,omitempty"`
}

// codexManifest is the Codex plugin manifest.
type codexManifest struct {
	// Name is the plugin identifier.
	Name string `json:"name"`
	// Version is the plugin version.
	Version string `json:"version"`
	// Description is the plugin description.
	Description string `json:"description"`
	// Author is the plugin author.
	Author manifestAuthor `json:"author"`
	// Skills points at the skills tree of the package.
	Skills string `json:"skills"`
	// MCPServers points at the MCP configuration, absent without one.
	MCPServers string `json:"mcpServers,omitempty"`
	// Interface carries the listing metadata Codex shows to a user.
	Interface codexInterface `json:"interface"`
}

// codexInterface is the listing metadata of a Codex plugin.
type codexInterface struct {
	// DisplayName is the human readable plugin name.
	DisplayName string `json:"displayName"`
	// ShortDescription is the one line listing description.
	ShortDescription string `json:"shortDescription"`
	// LongDescription is the full listing description.
	LongDescription string `json:"longDescription"`
	// DeveloperName is the name of the developer.
	DeveloperName string `json:"developerName"`
	// Category is the marketplace category.
	Category string `json:"category"`
	// Capabilities are the capabilities the package offers.
	Capabilities []string `json:"capabilities"`
}

// miniMaxManifest is the MiniMax Code plugin manifest of the official
// submission path.
type miniMaxManifest struct {
	// SchemaVersion is the MiniMax manifest schema version.
	SchemaVersion int `json:"schemaVersion"`
	// Name is the plugin identifier.
	Name string `json:"name"`
	// DisplayName is the human readable plugin name.
	DisplayName string `json:"displayName"`
	// Version is the plugin version.
	Version string `json:"version"`
	// Description is the plugin description.
	Description string `json:"description"`
	// Author is the plugin author.
	Author string `json:"author"`
	// Icon is the path of the icon file inside the package.
	Icon string `json:"icon"`
	// Category is the marketplace category.
	Category string `json:"category"`
	// ExampleQueries are the example prompts of the plugin.
	ExampleQueries []string `json:"exampleQueries"`
	// Apps are the packaged applications, empty when there are none.
	Apps []string `json:"apps"`
	// MCPServers are the packaged MCP configuration files, empty when there
	// are none.
	MCPServers []string `json:"mcpServers"`
	// Skills are the packaged skill files, relative to the package root.
	Skills []string `json:"skills"`
}

// geminiManifest is the Gemini CLI extension manifest.
//
// It belongs at the absolute root of the distribution tree, because the
// Gemini gallery reads it there.
type geminiManifest struct {
	// Name is the extension identifier.
	Name string `json:"name"`
	// Version is the extension version.
	Version string `json:"version"`
	// Description is the extension description.
	Description string `json:"description"`
	// MCPServers holds the MCP servers, absent without a configuration.
	MCPServers map[string]json.RawMessage `json:"mcpServers,omitempty"`
}

// portableManifestJSON renders the portable manifest.
func portableManifestJSON(meta packageMeta) ([]byte, error) {
	manifest := portableManifest{
		Schema:      SchemaIdentifier,
		Name:        meta.name,
		Description: meta.description,
		Version:     meta.version,
		Author:      manifestAuthor{Name: meta.author},
	}
	if meta.hasMCP() {
		manifest.MCPServers = mcpPath
	}
	return marshalJSON(manifest)
}

// claudeManifestJSON renders the Claude Code plugin manifest.
func claudeManifestJSON(meta packageMeta) ([]byte, error) {
	manifest := claudeManifest{
		Name:        meta.name,
		Description: meta.description,
		Version:     meta.version,
		Author:      manifestAuthor{Name: meta.author},
		Skills:      skillsPath,
	}
	if meta.hasMCP() {
		manifest.MCPServers = mcpPath
	}
	return marshalJSON(manifest)
}

// cursorManifestJSON renders the Cursor plugin manifest.
func cursorManifestJSON(meta packageMeta) ([]byte, error) {
	manifest := cursorManifest{
		Name:        meta.name,
		DisplayName: meta.name,
		Description: meta.description,
		Version:     meta.version,
		Author:      manifestAuthor{Name: meta.author},
		Category:    meta.category,
		Logo:        meta.icon,
		Skills:      skillsPath,
	}
	if meta.hasMCP() {
		manifest.MCPServers = mcpPath
	}
	return marshalJSON(manifest)
}

// codexManifestJSON renders the Codex plugin manifest.
func codexManifestJSON(meta packageMeta) ([]byte, error) {
	capabilities := []string{"Skills"}
	if meta.hasMCP() {
		capabilities = append(capabilities, "MCP")
	}
	manifest := codexManifest{
		Name:        meta.name,
		Version:     meta.version,
		Description: meta.description,
		Author:      manifestAuthor{Name: meta.author},
		Skills:      skillsPath,
		Interface: codexInterface{
			DisplayName:      meta.name,
			ShortDescription: meta.description,
			LongDescription:  meta.description,
			DeveloperName:    meta.author,
			Category:         meta.category,
			Capabilities:     capabilities,
		},
	}
	if meta.hasMCP() {
		manifest.MCPServers = mcpPath
	}
	return marshalJSON(manifest)
}

// miniMaxManifestJSON renders the MiniMax Code plugin manifest.
//
// The manifest declares every packaged skill by the path of its `SKILL.md`,
// and every capability the package does not carry stays an empty array.
func miniMaxManifestJSON(meta packageMeta) ([]byte, error) {
	manifest := miniMaxManifest{
		SchemaVersion:  1,
		Name:           meta.name,
		DisplayName:    meta.name,
		Version:        meta.version,
		Description:    meta.description,
		Author:         meta.author,
		Icon:           miniMaxIconPath,
		Category:       miniMaxCategory(meta.category),
		ExampleQueries: miniMaxExampleQueries,
		Apps:           []string{},
		MCPServers:     []string{},
		Skills:         miniMaxSkillReferences(meta.skills),
	}
	if meta.hasMCP() {
		manifest.MCPServers = []string{MCPConfigPath}
	}
	return marshalJSON(manifest)
}

// geminiManifestJSON renders the Gemini CLI extension manifest.
func geminiManifestJSON(meta packageMeta) ([]byte, error) {
	manifest := geminiManifest{
		Name:        meta.name,
		Version:     meta.version,
		Description: meta.description,
	}
	if meta.hasMCP() {
		manifest.MCPServers = meta.mcpServers
	}
	return marshalJSON(manifest)
}

// skillReferences returns the packaged skill directories, relative to the
// package root.
func skillReferences(skills []string) []string {
	references := make([]string, 0, len(skills))
	for _, skill := range skills {
		references = append(references, path.Join(canonicalSkillsDir, skill))
	}
	return references
}

// miniMaxSkillReferences returns the packaged skill files, relative to the
// package root.
func miniMaxSkillReferences(skills []string) []string {
	references := make([]string, 0, len(skills))
	for _, skill := range skills {
		references = append(references, path.Join(canonicalSkillsDir, skill, skillFile))
	}
	return references
}

// marshalJSON renders a manifest as indented JSON with a trailing newline.
func marshalJSON(value any) ([]byte, error) {
	raw, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("pack: render the manifest: %w", err)
	}
	return append(raw, '\n'), nil
}
