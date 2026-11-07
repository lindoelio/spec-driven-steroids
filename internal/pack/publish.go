package pack

// The supported marketplaces.
const (
	// MarketplaceClaudeCode is the Claude Code plugin marketplace.
	MarketplaceClaudeCode = "claude-code"
	// MarketplaceCodex is the Codex plugin marketplace.
	MarketplaceCodex = "codex"
	// MarketplaceCursor is the Cursor plugin marketplace.
	MarketplaceCursor = "cursor"
	// MarketplaceGemini is the Gemini CLI extension gallery.
	MarketplaceGemini = "gemini-cli"
	// MarketplaceMiniMax is the MiniMax Code plugin marketplace.
	MarketplaceMiniMax = "minimax-code"
)

// The publication modes.
const (
	// ModeAutomated marks a publication step that only needs a git push.
	ModeAutomated = "automated"
	// ModeManual marks a publication step that needs a vendor account, a
	// submission form or a human review.
	ModeManual = "manual"
)

// MiniMaxRegistryPath is the package subtree the MiniMax community registry
// takes. The owner and the package name fill the placeholders.
const MiniMaxRegistryPath = "plugins/{owner}/{name}/"

// Publication reports how one marketplace is published.
type Publication struct {
	// Marketplace is the marketplace name.
	Marketplace string
	// Mode is "automated" or "manual".
	Mode string
	// Reason explains a manual step.
	Reason string
	// Catalog is the catalog path relative to the distribution tree.
	Catalog string
}

// PublicationReport reports the publication mode of every marketplace.
//
// The automatic steps are the ones that only need a git push of the
// distribution tree. The vendor review and the vendor submission stay manual,
// and the Gemini topic registration is a one-time manual action.
func PublicationReport() []Publication {
	return []Publication{
		{
			Marketplace: MarketplaceClaudeCode,
			Mode:        ModeAutomated,
			Reason:      "The distribution tree is published by pushing it to the marketplace repository, which a user adds as a marketplace.",
			Catalog:     ClaudeCatalogPath,
		},
		{
			Marketplace: MarketplaceCodex,
			Mode:        ModeAutomated,
			Reason:      "The Codex catalog travels in the same push of the distribution tree.",
			Catalog:     CodexCatalogPath,
		},
		{
			Marketplace: MarketplaceCursor,
			Mode:        ModeManual,
			Reason:      "The Cursor marketplace reviews every submission, so publishing needs a submission and a vendor approval.",
			Catalog:     CursorCatalogPath,
		},
		{
			Marketplace: MarketplaceGemini,
			Mode:        ModeManual,
			Reason:      "The Gemini gallery discovers extensions through the gemini-cli-extension repository topic, and registering that topic is a one-time manual action.",
			Catalog:     GeminiManifestPath,
		},
		{
			Marketplace: MarketplaceMiniMax,
			Mode:        ModeManual,
			Reason:      "The MiniMax community registry takes the package subtree through a pull request to the registry repository, which a vendor reviews.",
			Catalog:     MiniMaxRegistryPath,
		},
	}
}
