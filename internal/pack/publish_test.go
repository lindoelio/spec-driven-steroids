package pack

import (
	"strings"
	"testing"
)

func TestPublicationReportCoversEveryMarketplace(t *testing.T) {
	report := PublicationReport()

	expected := map[string]string{
		MarketplaceClaudeCode: ModeAutomated,
		MarketplaceCodex:      ModeAutomated,
		MarketplaceCursor:     ModeManual,
		MarketplaceGemini:     ModeManual,
		MarketplaceMiniMax:    ModeManual,
	}

	if len(report) != len(expected) {
		t.Fatalf("the report holds %d marketplaces, expected %d", len(report), len(expected))
	}

	seen := map[string]bool{}
	for _, publication := range report {
		mode, known := expected[publication.Marketplace]
		if !known {
			t.Errorf("the report names the unknown marketplace %q", publication.Marketplace)
			continue
		}
		seen[publication.Marketplace] = true

		if publication.Mode != mode {
			t.Errorf("the marketplace %s is %q, expected %q", publication.Marketplace, publication.Mode, mode)
		}
		if strings.TrimSpace(publication.Reason) == "" {
			t.Errorf("the marketplace %s declares no reason", publication.Marketplace)
		}
		if strings.TrimSpace(publication.Catalog) == "" {
			t.Errorf("the marketplace %s declares no catalog", publication.Marketplace)
		}
	}

	for marketplace := range expected {
		if !seen[marketplace] {
			t.Errorf("the report does not name the marketplace %s", marketplace)
		}
	}
}

func TestPublicationReportExplainsTheManualSteps(t *testing.T) {
	report := PublicationReport()

	reasons := map[string]string{}
	for _, publication := range report {
		reasons[publication.Marketplace] = publication.Reason
	}

	if !strings.Contains(reasons[MarketplaceCursor], "review") {
		t.Errorf("the Cursor reason %q does not name the vendor review", reasons[MarketplaceCursor])
	}
	if !strings.Contains(reasons[MarketplaceMiniMax], "pull request") {
		t.Errorf("the MiniMax reason %q does not name the submission", reasons[MarketplaceMiniMax])
	}
	if !strings.Contains(reasons[MarketplaceGemini], "one-time") {
		t.Errorf("the Gemini reason %q does not name the one-time registration", reasons[MarketplaceGemini])
	}
}

func TestPublicationReportNamesTheCatalogOfEveryMarketplace(t *testing.T) {
	report := PublicationReport()

	catalogs := map[string]string{}
	for _, publication := range report {
		catalogs[publication.Marketplace] = publication.Catalog
	}

	if catalogs[MarketplaceClaudeCode] != ClaudeCatalogPath {
		t.Errorf("the Claude Code catalog is %q, expected %q", catalogs[MarketplaceClaudeCode], ClaudeCatalogPath)
	}
	if catalogs[MarketplaceCodex] != CodexCatalogPath {
		t.Errorf("the Codex catalog is %q, expected %q", catalogs[MarketplaceCodex], CodexCatalogPath)
	}
	if catalogs[MarketplaceCursor] != CursorCatalogPath {
		t.Errorf("the Cursor catalog is %q, expected %q", catalogs[MarketplaceCursor], CursorCatalogPath)
	}
	if catalogs[MarketplaceMiniMax] != MiniMaxRegistryPath {
		t.Errorf("the MiniMax registry path is %q, expected %q", catalogs[MarketplaceMiniMax], MiniMaxRegistryPath)
	}
	if catalogs[MarketplaceGemini] != GeminiManifestPath {
		t.Errorf("the Gemini manifest is %q, expected %q", catalogs[MarketplaceGemini], GeminiManifestPath)
	}
}
