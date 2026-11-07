package stewardship

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// withTempHome points the stewardship store at an isolated directory.
func withTempHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("SDS_HOME", home)
	return home
}

func stringOf(value string) *string { return &value }

// 7.1 - rule node creation with full provenance and default expiration.
func TestCreateRuleWithProvenanceAndExpiration(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	rule := store.CreateRule(CreateRuleParams{
		Domain:  "architecture",
		Content: "Use TypeScript for all new services",
		Author:  stringOf("test-author"),
	})

	if !strings.HasPrefix(rule.ID, "rule-") {
		t.Fatalf("rule id %q does not start with rule-", rule.ID)
	}
	if rule.Domain != "architecture" {
		t.Fatalf("domain = %q", rule.Domain)
	}
	if rule.Content != "Use TypeScript for all new services" {
		t.Fatalf("content = %q", rule.Content)
	}
	if rule.State.Value != LifecycleActive {
		t.Fatalf("state = %q", rule.State.Value)
	}
	if rule.Provenance.Author != "test-author" {
		t.Fatalf("author = %q", rule.Provenance.Author)
	}
	if rule.Provenance.Source != "manual" {
		t.Fatalf("source = %q", rule.Provenance.Source)
	}
	if rule.Provenance.DecisionDate == "" {
		t.Fatal("decision date is empty")
	}

	expiresAt, ok := parseTimestamp(rule.Metadata.ExpiresAt)
	if !ok {
		t.Fatalf("expiresAt %q is not a timestamp", rule.Metadata.ExpiresAt)
	}
	years := float64(expiresAt-time.Now().UnixMilli()) / (1000 * 60 * 60 * 24 * 365)
	if years <= 1.9 || years > 2.1 {
		t.Fatalf("expiration is %.3f years away", years)
	}
}

func TestCreateRuleWithFullProvenance(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	rule := store.CreateRule(CreateRuleParams{
		Domain:  "business",
		Content: "Customer data must be encrypted at rest",
		Author:  stringOf("product-owner"),
		Provenance: &Provenance{
			Source:       "extract",
			SourceFile:   stringOf("/path/to/spec.md"),
			DecisionDate: "2024-01-15T10:00:00Z",
			Author:       "product-owner",
			OriginalText: "Customer data SHALL be encrypted at rest",
		},
	})

	if rule.Provenance.Source != "extract" {
		t.Fatalf("source = %q", rule.Provenance.Source)
	}
	if rule.Provenance.SourceFile == nil || *rule.Provenance.SourceFile != "/path/to/spec.md" {
		t.Fatalf("sourceFile = %v", rule.Provenance.SourceFile)
	}
	if rule.Provenance.DecisionDate != "2024-01-15T10:00:00Z" {
		t.Fatalf("decisionDate = %q", rule.Provenance.DecisionDate)
	}
	if rule.Provenance.OriginalText != "Customer data SHALL be encrypted at rest" {
		t.Fatalf("originalText = %q", rule.Provenance.OriginalText)
	}
}

// 7.2 - supersededBy linking and deprecation on rule replacement.
func TestDeprecationLinksSupersedingRule(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	original := store.CreateRule(CreateRuleParams{Domain: "architecture", Content: "Use REST for all APIs"})
	if err := store.SaveRule(original); err != nil {
		t.Fatalf("save original: %v", err)
	}
	replacement := store.CreateRule(CreateRuleParams{Domain: "architecture", Content: "Use GraphQL for all APIs"})
	if err := store.SaveRule(replacement); err != nil {
		t.Fatalf("save replacement: %v", err)
	}

	deprecated, err := store.DeprecateRule(original.ID, stringOf(replacement.ID), "agent")
	if err != nil {
		t.Fatalf("deprecate: %v", err)
	}
	if deprecated == nil {
		t.Fatal("deprecation returned no rule")
	}
	if deprecated.SupersededBy == nil || *deprecated.SupersededBy != replacement.ID {
		t.Fatalf("supersededBy = %v", deprecated.SupersededBy)
	}
	if deprecated.State.Value != LifecycleDeprecated {
		t.Fatalf("state = %q", deprecated.State.Value)
	}
}

// 7.3 - conflict detection for semantically similar rules.
func TestConflictDetection(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	rule := store.CreateRule(CreateRuleParams{
		Domain:  "architecture",
		Content: "PostgreSQL serves as the primary database for all transactional data storage",
	})
	if err := store.SaveRule(rule); err != nil {
		t.Fatalf("save rule: %v", err)
	}
	candidate := store.CreateRule(CreateRuleParams{
		Domain:  "architecture",
		Content: "PostgreSQL serves as the primary database for all transactional data storage needs",
	})
	conflicts, err := store.DetectConflicts(candidate, nil)
	if err != nil {
		t.Fatalf("detect conflicts: %v", err)
	}
	if len(conflicts) == 0 {
		t.Fatal("expected a conflict")
	}
	if conflicts[0].Similarity < ConflictSimilarityThreshold {
		t.Fatalf("similarity = %v", conflicts[0].Similarity)
	}
	if conflicts[0].Rule.ID != rule.ID {
		t.Fatalf("conflicting rule = %q", conflicts[0].Rule.ID)
	}

	unrelated := store.CreateRule(CreateRuleParams{
		Domain:  "workflow",
		Content: "Write unit tests for all new functions",
	})
	conflicts, err = store.DetectConflicts(unrelated, nil)
	if err != nil {
		t.Fatalf("detect conflicts: %v", err)
	}
	if len(conflicts) != 0 {
		t.Fatalf("expected no conflicts, got %d", len(conflicts))
	}
}

// 7.4 - semantic retrieval ranking by keyword, recency and confidence.
func TestSemanticRetrievalRanking(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	low := store.CreateRule(CreateRuleParams{
		Domain:   "architecture",
		Content:  "Use PostgreSQL for database",
		Author:   stringOf("agent"),
		Metadata: &Metadata{Confidence: 0.5},
	})
	high := store.CreateRule(CreateRuleParams{
		Domain:   "architecture",
		Content:  "Use PostgreSQL for all services",
		Author:   stringOf("agent"),
		Metadata: &Metadata{Confidence: 0.9},
	})
	if err := store.SaveRule(low); err != nil {
		t.Fatalf("save low: %v", err)
	}
	if err := store.SaveRule(high); err != nil {
		t.Fatalf("save high: %v", err)
	}

	engine := NewSemanticRetrievalEngine(store)
	result, err := engine.Retrieve(RetrievalQuery{Query: "PostgreSQL database"})
	if err != nil {
		t.Fatalf("retrieve: %v", err)
	}
	if len(result.Rules) == 0 {
		t.Fatal("no rules retrieved")
	}
	if !strings.Contains(result.Rules[0].Rule.Content, "PostgreSQL") {
		t.Fatalf("unexpected top rule %q", result.Rules[0].Rule.Content)
	}
}

func TestRetrievalFiltersToActiveRules(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	active := store.CreateRule(CreateRuleParams{Domain: "architecture", Content: "Active architecture rule"})
	deprecated := store.CreateRule(CreateRuleParams{Domain: "architecture", Content: "Deprecated architecture rule"})
	if err := store.SaveRule(active); err != nil {
		t.Fatalf("save active: %v", err)
	}
	if err := store.SaveRule(deprecated); err != nil {
		t.Fatalf("save deprecated: %v", err)
	}
	if _, err := store.DeprecateRule(deprecated.ID, stringOf("new-rule-id"), "agent"); err != nil {
		t.Fatalf("deprecate: %v", err)
	}

	engine := NewSemanticRetrievalEngine(store)
	result, err := engine.Retrieve(RetrievalQuery{Query: "architecture"})
	if err != nil {
		t.Fatalf("retrieve: %v", err)
	}
	for _, scored := range result.Rules {
		if scored.Rule.State.Value != LifecycleActive {
			t.Fatalf("retrieved a %s rule", scored.Rule.State.Value)
		}
	}
}

// 7.5 - cross-domain fallback when no domain matched results exist.
func TestCrossDomainFallback(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	workflow := store.CreateRule(CreateRuleParams{Domain: "workflow", Content: "Write tests before committing code"})
	if err := store.SaveRule(workflow); err != nil {
		t.Fatalf("save workflow: %v", err)
	}

	engine := NewSemanticRetrievalEngine(store)
	result, err := engine.Retrieve(RetrievalQuery{Query: "testing code quality", Domain: stringOf("architecture")})
	if err != nil {
		t.Fatalf("retrieve: %v", err)
	}
	outOfDomain := 0
	for _, scored := range result.Rules {
		if scored.IsOutOfDomain {
			outOfDomain++
			if scored.Rule.Domain != "workflow" {
				t.Fatalf("unexpected domain %q", scored.Rule.Domain)
			}
		}
	}
	if outOfDomain == 0 {
		t.Fatal("expected cross domain results")
	}
}

func TestDomainMatchedResultsExcludeCrossDomainRules(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	architecture := store.CreateRule(CreateRuleParams{
		Domain:  "architecture",
		Content: "Testing quality belongs to the architecture validation rule",
	})
	workflow := store.CreateRule(CreateRuleParams{
		Domain:  "workflow",
		Content: "Testing quality belongs to the workflow validation rule",
	})
	if err := store.SaveRule(architecture); err != nil {
		t.Fatalf("save architecture: %v", err)
	}
	if err := store.SaveRule(workflow); err != nil {
		t.Fatalf("save workflow: %v", err)
	}

	engine := NewSemanticRetrievalEngine(store)
	result, err := engine.Retrieve(RetrievalQuery{
		Query:  "testing quality validation",
		Domain: stringOf("architecture"),
	})
	if err != nil {
		t.Fatalf("retrieve: %v", err)
	}
	if len(result.Rules) == 0 {
		t.Fatal("no rules retrieved")
	}
	for _, scored := range result.Rules {
		if scored.Rule.Domain != "architecture" {
			t.Fatalf("unexpected domain %q", scored.Rule.Domain)
		}
		if scored.IsOutOfDomain {
			t.Fatal("domain matched rule reported as out of domain")
		}
	}
}

// 7.6 - scope chain resolution priority.
func TestProjectRulesWinOverGlobalRules(t *testing.T) {
	withTempHome(t)

	globalStore, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open global store: %v", err)
	}
	projectStore, err := NewStore(ScopeProject, "test-project")
	if err != nil {
		t.Fatalf("open project store: %v", err)
	}
	globalRule := globalStore.CreateRule(CreateRuleParams{
		Domain:  "architecture",
		Content: "Global: use PostgreSQL for databases",
	})
	projectRule := projectStore.CreateRule(CreateRuleParams{
		Domain:  "architecture",
		Content: "Project: use MongoDB for the project database",
	})
	if err := globalStore.SaveRule(globalRule); err != nil {
		t.Fatalf("save global: %v", err)
	}
	if err := projectStore.SaveRule(projectRule); err != nil {
		t.Fatalf("save project: %v", err)
	}

	resolver := NewProjectScopedResolver(globalStore)
	if err := resolver.SetProjectScope("test-project"); err != nil {
		t.Fatalf("set scope: %v", err)
	}
	result, err := resolver.Resolve(RetrievalQuery{Query: "mongodb"})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if !containsString(result.ScopesResolved, "project") || !containsString(result.ScopesResolved, "global") {
		t.Fatalf("scopes resolved = %v", result.ScopesResolved)
	}
	projectRules := 0
	for _, scored := range result.Rules {
		if scored.Rule.ProjectScope != nil && *scored.Rule.ProjectScope == "test-project" {
			projectRules++
		}
	}
	if projectRules == 0 {
		t.Fatal("no project rules resolved")
	}
}

func TestProjectRuleRanksBeforeGlobalRule(t *testing.T) {
	withTempHome(t)

	globalStore, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open global store: %v", err)
	}
	projectStore, err := NewStore(ScopeProject, "priority-project")
	if err != nil {
		t.Fatalf("open project store: %v", err)
	}
	globalRule := globalStore.CreateRule(CreateRuleParams{
		Domain:  "architecture",
		Content: "Database priority regression uses GlobalDB for matching storage",
	})
	projectRule := projectStore.CreateRule(CreateRuleParams{
		Domain:  "architecture",
		Content: "Database priority regression uses ProjectDB for matching storage",
	})
	if err := globalStore.SaveRule(globalRule); err != nil {
		t.Fatalf("save global: %v", err)
	}
	if err := projectStore.SaveRule(projectRule); err != nil {
		t.Fatalf("save project: %v", err)
	}

	resolver := NewProjectScopedResolver(globalStore)
	if err := resolver.SetProjectScope("priority-project"); err != nil {
		t.Fatalf("set scope: %v", err)
	}
	result, err := resolver.Resolve(RetrievalQuery{Query: "database priority regression storage"})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(result.Rules) == 0 {
		t.Fatal("no rules resolved")
	}
	if !strings.Contains(result.Rules[0].Rule.Content, "ProjectDB") {
		t.Fatalf("top rule = %q", result.Rules[0].Rule.Content)
	}
}

func TestStoreUsesProjectScopeByDefault(t *testing.T) {
	withTempHome(t)

	projectDir := t.TempDir()
	t.Chdir(projectDir)

	orchestrator, err := NewOrchestrator()
	if err != nil {
		t.Fatalf("create orchestrator: %v", err)
	}
	if err := orchestrator.Initialize(); err != nil {
		t.Fatalf("initialize: %v", err)
	}
	content := "Project scoped memory"
	result, err := orchestrator.CommandStore(StoreArgs{Domain: "workflow", Content: content})
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	if !result.Success {
		t.Fatalf("store failed: %s", result.Output)
	}

	projectStore, err := NewStore(ScopeProject, DetectProjectID(projectDir))
	if err != nil {
		t.Fatalf("open project store: %v", err)
	}
	globalStore, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open global store: %v", err)
	}
	projectRules, err := projectStore.ListRules(nil)
	if err != nil {
		t.Fatalf("list project rules: %v", err)
	}
	globalRules, err := globalStore.ListRules(nil)
	if err != nil {
		t.Fatalf("list global rules: %v", err)
	}
	if !containsRuleContent(projectRules, content) {
		t.Fatal("rule was not stored in the project scope")
	}
	if containsRuleContent(globalRules, content) {
		t.Fatal("rule was stored in the global scope")
	}
}

func TestStoreGlobalOnlyWhenRequested(t *testing.T) {
	withTempHome(t)

	orchestrator, err := NewOrchestrator()
	if err != nil {
		t.Fatalf("create orchestrator: %v", err)
	}
	if err := orchestrator.Initialize(); err != nil {
		t.Fatalf("initialize: %v", err)
	}
	content := "Global scoped memory"
	result, err := orchestrator.CommandStore(StoreArgs{Domain: "workflow", Content: content, Global: true})
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	if !result.Success {
		t.Fatalf("store failed: %s", result.Output)
	}

	globalStore, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open global store: %v", err)
	}
	globalRules, err := globalStore.ListRules(nil)
	if err != nil {
		t.Fatalf("list global rules: %v", err)
	}
	if !containsRuleContent(globalRules, content) {
		t.Fatal("rule was not stored in the global scope")
	}
}

func TestMoveMovesGlobalRuleIntoProjectScope(t *testing.T) {
	withTempHome(t)

	globalStore, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open global store: %v", err)
	}
	globalRule := globalStore.CreateRule(CreateRuleParams{
		Domain:  "business",
		Content: "Move global memory",
	})
	if err := globalStore.SaveRule(globalRule); err != nil {
		t.Fatalf("save global: %v", err)
	}

	orchestrator, err := NewOrchestrator()
	if err != nil {
		t.Fatalf("create orchestrator: %v", err)
	}
	if err := orchestrator.Initialize(); err != nil {
		t.Fatalf("initialize: %v", err)
	}
	result, err := orchestrator.CommandManage(ManageArgs{
		Action: "move",
		RuleID: stringOf(globalRule.ID),
		Scope:  stringOf("moved-project"),
	})
	if err != nil {
		t.Fatalf("manage move: %v", err)
	}
	if !result.Success {
		t.Fatalf("move failed: %s", result.Output)
	}

	projectStore, err := NewStore(ScopeProject, "moved-project")
	if err != nil {
		t.Fatalf("open project store: %v", err)
	}
	moved, err := projectStore.ReadRule(globalRule.ID, stringOf("active"))
	if err != nil {
		t.Fatalf("read moved rule: %v", err)
	}
	if moved == nil || moved.ProjectScope == nil || *moved.ProjectScope != "moved-project" {
		t.Fatalf("moved rule = %v", moved)
	}
	archived, err := globalStore.ReadRule(globalRule.ID, stringOf("archived"))
	if err != nil {
		t.Fatalf("read archived rule: %v", err)
	}
	if archived == nil || archived.State.Value != LifecycleArchived {
		t.Fatalf("archived source = %v", archived)
	}
}

// 7.8 - extraction from design documents.
func TestExtractFromDesign(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	extractor := NewSpecDecisionExtractor(store)
	file := filepath.Join(t.TempDir(), "design.md")
	content := `# Design Document

## Architecture

### DES-1: Use PostgreSQL for Primary Database

We will use PostgreSQL as the main relational database.

### DES-2: Implement Caching Layer

Use Redis for caching frequently accessed data.

_Decisions:
- Use TypeScript for all new services
- Enable strict mode in TypeScript compiler
`
	if err := os.WriteFile(file, []byte(content), 0o644); err != nil {
		t.Fatalf("write design: %v", err)
	}

	candidates := extractor.ExtractFromDesign(file, "test-author")
	decisions := 0
	for _, candidate := range candidates {
		if strings.HasPrefix(candidate.SourceElement, "DES-") {
			decisions++
		}
	}
	if decisions != 2 {
		t.Fatalf("found %d DES candidates", decisions)
	}
	blocks := 0
	for _, candidate := range candidates {
		if candidate.SourceElement == "_Decisions:block" {
			blocks++
		}
	}
	if blocks != 2 {
		t.Fatalf("found %d decision block candidates", blocks)
	}
}

func TestExtractTechnologyMentions(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	extractor := NewSpecDecisionExtractor(store)
	file := filepath.Join(t.TempDir(), "design.md")
	content := `# Design Document

## System Architecture

` + "```mermaid" + `
graph TD
    A[PostgreSQL] --> B[Node.js API]
    B --> C[Redis Cache]
` + "```" + `
`
	if err := os.WriteFile(file, []byte(content), 0o644); err != nil {
		t.Fatalf("write design: %v", err)
	}

	candidates := extractor.ExtractFromDesign(file, "test-author")
	technologies := 0
	for _, candidate := range candidates {
		if candidate.SourceElement == "mermaid:technology" && strings.Contains(candidate.Content, "PostgreSQL") {
			technologies++
		}
	}
	if technologies == 0 {
		t.Fatal("no technology candidate found")
	}
}

// 7.9 - extraction from requirements documents.
func TestExtractGlossaryAndConstraints(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	extractor := NewSpecDecisionExtractor(store)
	file := filepath.Join(t.TempDir(), "requirements.md")
	content := `# Requirements Document

## Introduction

This document describes the system requirements.

## Glossary

| Term | Definition |
|------|------------|
| PostgreSQL | A relational database management system |
| API | Application Programming Interface |

## Requirements

### REQ-1: Data Storage

1. THE system SHALL store data in PostgreSQL. _(Ubiquitous)_
`
	if err := os.WriteFile(file, []byte(content), 0o644); err != nil {
		t.Fatalf("write requirements: %v", err)
	}

	candidates := extractor.ExtractFromRequirements(file, "test-author")
	terms := 0
	constraints := 0
	for _, candidate := range candidates {
		if strings.HasPrefix(candidate.SourceElement, "glossary:") {
			terms++
		}
		if candidate.SubDomain != nil && *candidate.SubDomain == "constraint" {
			constraints++
		}
	}
	if terms < 2 {
		t.Fatalf("found %d glossary candidates", terms)
	}
	if constraints == 0 {
		t.Fatal("no constraint candidate found")
	}
}

// 7.10 - confirmation flow before persisting extracted rules.
func TestStoreCandidate(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	extractor := NewSpecDecisionExtractor(store)
	file := filepath.Join(t.TempDir(), "requirements.md")
	content := `# Requirements

### REQ-1: Test

1. THE system SHALL do something. _(Ubiquitous)_
`
	if err := os.WriteFile(file, []byte(content), 0o644); err != nil {
		t.Fatalf("write requirements: %v", err)
	}

	candidates := extractor.ExtractFromRequirements(file, "test-author")
	if len(candidates) == 0 {
		t.Fatal("no candidates extracted")
	}
	rule, err := extractor.StoreCandidate(candidates[0], nil)
	if err != nil {
		t.Fatalf("store candidate: %v", err)
	}
	if rule.Content != candidates[0].Content {
		t.Fatalf("content = %q", rule.Content)
	}
	if rule.Domain != candidates[0].Domain {
		t.Fatalf("domain = %q", rule.Domain)
	}
	if rule.Provenance.Source != "extract" {
		t.Fatalf("source = %q", rule.Provenance.Source)
	}
}

// 7.11 - lifecycle state transitions.
func TestLifecycleTransitions(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	rule := store.CreateRule(CreateRuleParams{Domain: "architecture", Content: "Test rule for lifecycle"})
	if err := store.SaveRule(rule); err != nil {
		t.Fatalf("save rule: %v", err)
	}

	lifecycle := NewLifecycleManager(store)
	deprecated, err := lifecycle.TransitionState(rule.ID, LifecycleDeprecated, "agent", stringOf("new-rule-id"))
	if err != nil {
		t.Fatalf("deprecate: %v", err)
	}
	if deprecated == nil || deprecated.State.Value != LifecycleDeprecated {
		t.Fatalf("deprecated = %v", deprecated)
	}
	if deprecated.SupersededBy == nil || *deprecated.SupersededBy != "new-rule-id" {
		t.Fatalf("supersededBy = %v", deprecated.SupersededBy)
	}

	deprecatedRules, err := lifecycle.GetDeprecatedRules()
	if err != nil {
		t.Fatalf("list deprecated: %v", err)
	}
	if len(deprecatedRules) != 1 {
		t.Fatalf("deprecated rules = %d", len(deprecatedRules))
	}
	if deprecatedRules[0].SupersededBy == nil || *deprecatedRules[0].SupersededBy != "new-rule-id" {
		t.Fatalf("supersededBy = %v", deprecatedRules[0].SupersededBy)
	}

	archived, err := lifecycle.TransitionState(rule.ID, LifecycleArchived, "agent", nil)
	if err != nil {
		t.Fatalf("archive: %v", err)
	}
	if archived == nil || archived.State.Value != LifecycleArchived {
		t.Fatalf("archived = %v", archived)
	}

	archivedRules, err := lifecycle.GetArchivedRules()
	if err != nil {
		t.Fatalf("list archived: %v", err)
	}
	if len(archivedRules) != 1 {
		t.Fatalf("archived rules = %d", len(archivedRules))
	}
}

// 7.12 - version archive on rule update.
func TestVersionHistory(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	rule := store.CreateRule(CreateRuleParams{Domain: "architecture", Content: "Original content"})
	if err := store.SaveRule(rule); err != nil {
		t.Fatalf("save rule: %v", err)
	}
	content := "Updated content"
	if _, err := store.UpdateRule(rule.ID, ruleUpdates{content: &content}, "agent"); err != nil {
		t.Fatalf("update rule: %v", err)
	}

	history, err := store.GetRuleHistory(rule.ID)
	if err != nil {
		t.Fatalf("read history: %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("history entries = %d", len(history))
	}
	if history[0].RuleID != rule.ID || history[0].Version != 1 || history[0].ChangedBy != "agent" {
		t.Fatalf("history entry = %+v", history[0])
	}
}

// 7.13 and 7.14 - capability detection and tier routing.
func TestCapabilityDetection(t *testing.T) {
	withTempHome(t)

	router := NewCapabilityRouter()
	caps, err := router.Initialize()
	if err != nil {
		t.Fatalf("initialize: %v", err)
	}
	if !caps.FileSystemAvailable {
		t.Fatal("file system reported as unavailable")
	}
	if caps.Tier != CapabilityTierJSONGraph {
		t.Fatalf("tier = %q", caps.Tier)
	}
	if router.GetTier() != CapabilityTierJSONGraph {
		t.Fatalf("tier = %q", router.GetTier())
	}
	output := router.FormatCapabilities()
	for _, needle := range []string{"Tier:", "File System:", "Enabled Features:"} {
		if !strings.Contains(output, needle) {
			t.Fatalf("capabilities output %q misses %q", output, needle)
		}
	}
}

// 7.15 - phase context injection and conflict resolution.
func TestPhaseInjection(t *testing.T) {
	withTempHome(t)

	orchestrator, err := NewOrchestrator()
	if err != nil {
		t.Fatalf("create orchestrator: %v", err)
	}
	if err := orchestrator.Initialize(); err != nil {
		t.Fatalf("initialize: %v", err)
	}
	stored, err := orchestrator.CommandStore(StoreArgs{
		Domain:  "architecture",
		Content: "Use PostgreSQL as the primary database",
	})
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	if !stored.Success {
		t.Fatalf("store failed: %s", stored.Output)
	}

	injected, err := orchestrator.CommandInject(InjectArgs{Phase: "design"})
	if err != nil {
		t.Fatalf("inject: %v", err)
	}
	if !strings.Contains(injected.Output, "Use PostgreSQL as the primary database") {
		t.Fatalf("injected output = %q", injected.Output)
	}
	contexts, ok := injected.Data.([]InjectedContext)
	if !ok {
		t.Fatalf("injected data = %T", injected.Data)
	}
	if len(contexts) != 1 || contexts[0].Domain != "architecture" {
		t.Fatalf("injected contexts = %+v", contexts)
	}
}

func TestOverrideDeprecatesThePreviousRule(t *testing.T) {
	withTempHome(t)

	orchestrator, err := NewOrchestrator()
	if err != nil {
		t.Fatalf("create orchestrator: %v", err)
	}
	if err := orchestrator.Initialize(); err != nil {
		t.Fatalf("initialize: %v", err)
	}
	content := "Use PostgreSQL as the primary database"
	if _, err := orchestrator.CommandStore(StoreArgs{
		Domain:  "architecture",
		Content: content,
		Global:  true,
	}); err != nil {
		t.Fatalf("store: %v", err)
	}
	override := ConflictOverride
	if _, err := orchestrator.CommandStore(StoreArgs{
		Domain:     "architecture",
		Content:    content,
		Global:     true,
		OnConflict: &override,
	}); err != nil {
		t.Fatalf("store with override: %v", err)
	}

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	active, err := store.ListRules(&ListRulesParams{State: stringOf("active")})
	if err != nil {
		t.Fatalf("list active: %v", err)
	}
	deprecated, err := store.ListRules(&ListRulesParams{State: stringOf("deprecated")})
	if err != nil {
		t.Fatalf("list deprecated: %v", err)
	}
	if len(active) != 1 || len(deprecated) != 1 {
		t.Fatalf("active = %d, deprecated = %d", len(active), len(deprecated))
	}
	if deprecated[0].SupersededBy == nil || *deprecated[0].SupersededBy != active[0].ID {
		t.Fatalf("supersededBy = %v", deprecated[0].SupersededBy)
	}
}

func TestMergeReportsResolvedConflicts(t *testing.T) {
	withTempHome(t)

	orchestrator, err := NewOrchestrator()
	if err != nil {
		t.Fatalf("create orchestrator: %v", err)
	}
	if err := orchestrator.Initialize(); err != nil {
		t.Fatalf("initialize: %v", err)
	}
	content := "Use PostgreSQL as the primary database"
	if _, err := orchestrator.CommandStore(StoreArgs{
		Domain:  "architecture",
		Content: content,
		Global:  true,
	}); err != nil {
		t.Fatalf("store: %v", err)
	}
	merge := ConflictMerge
	merged, err := orchestrator.CommandStore(StoreArgs{
		Domain:     "architecture",
		Content:    content,
		Global:     true,
		OnConflict: &merge,
	})
	if err != nil {
		t.Fatalf("store with merge: %v", err)
	}
	if !strings.Contains(merged.Output, "resolved 1 conflict") {
		t.Fatalf("merged output = %q", merged.Output)
	}
}

// The on-disk format of the rule graph stays compatible with the release
// that stored the rules before the rewrite.
func TestStoredRuleFormatIsStable(t *testing.T) {
	withTempHome(t)

	store, err := NewStore(ScopeGlobal, "")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	rule := store.CreateRule(CreateRuleParams{
		Domain:  "architecture",
		Content: "Use PostgreSQL as the primary database",
		Author:  stringOf("alice"),
	})
	rule.ID = "rule-fixed-id"
	if err := store.SaveRule(rule); err != nil {
		t.Fatalf("save rule: %v", err)
	}

	path := filepath.Join(store.ScopeDir(), "active", "rule-fixed-id.json")
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read rule: %v", err)
	}
	expected := `{
  "id": "rule-fixed-id",
  "domain": "architecture",
  "content": "Use PostgreSQL as the primary database",
  "provenance": {
    "source": "manual",
    "decisionDate": "` + rule.Provenance.DecisionDate + `",
    "author": "alice",
    "originalText": "Use PostgreSQL as the primary database"
  },
  "metadata": {
    "confidence": 0.8,
    "expiresAt": "` + rule.Metadata.ExpiresAt + `",
    "tags": []
  },
  "state": {
    "value": "active",
    "changedAt": "` + rule.State.ChangedAt + `",
    "changedBy": "alice"
  },
  "relations": []
}`
	if string(content) != expected {
		t.Fatalf("stored rule =\n%s\nwant\n%s", content, expected)
	}
}

// containsRuleContent reports whether one of the rules has the given content.
func containsRuleContent(rules []*RuleNode, content string) bool {
	for _, rule := range rules {
		if rule.Content == content {
			return true
		}
	}
	return false
}
