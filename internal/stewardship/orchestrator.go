package stewardship

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Command names of the stewardship command surface.
const (
	CommandCapabilities = "capabilities"
	CommandRetrieve     = "retrieve"
	CommandStore        = "store"
	CommandExtract      = "extract"
	CommandTrace        = "trace"
	CommandInject       = "inject"
	CommandManage       = "manage"
)

// CommandResult is the outcome of a stewardship command.
type CommandResult struct {
	Success bool
	Output  string
	Data    any
}

// RetrieveArgs are the arguments of the retrieve command.
type RetrieveArgs struct {
	Query  string
	Domain *Domain
	Scope  *string
	Global bool
}

// StoreArgs are the arguments of the store command.
type StoreArgs struct {
	Domain     Domain
	Content    string
	Author     *string
	Scope      *string
	Global     bool
	OnConflict *ConflictDecision
}

// ExtractArgs are the arguments of the extract command.
type ExtractArgs struct {
	FilePath string
	Author   *string
}

// TraceArgs are the arguments of the trace command.
type TraceArgs struct {
	RuleID string
	Scope  *string
	Global bool
}

// InjectArgs are the arguments of the inject command.
type InjectArgs struct {
	Phase  string
	Scope  *string
	Global bool
}

// ManageArgs are the arguments of the manage command.
type ManageArgs struct {
	Action string
	RuleID *string
	Scope  *string
	Global bool
}

// scopeSelection is the scope a command works on.
type scopeSelection struct {
	global    bool
	projectID string
}

// Orchestrator is the facade of the stewardship subsystem.
type Orchestrator struct {
	globalStore *RuleStore
	resolver    *ProjectScopedResolver
	lifecycle   *LifecycleManager
	extractor   *SpecDecisionExtractor
	injector    *PhaseContextInjector
	router      *CapabilityRouter
}

// NewOrchestrator creates the stewardship orchestrator.
func NewOrchestrator() (*Orchestrator, error) {
	globalStore, err := NewStore(ScopeGlobal, "")
	if err != nil {
		return nil, err
	}
	resolver := NewProjectScopedResolver(globalStore)
	return &Orchestrator{
		globalStore: globalStore,
		resolver:    resolver,
		lifecycle:   NewLifecycleManager(globalStore),
		extractor:   NewSpecDecisionExtractor(globalStore),
		injector:    NewPhaseContextInjector(resolver),
		router:      NewCapabilityRouter(),
	}, nil
}

// Initialize detects the runtime capabilities of the rule graph.
func (o *Orchestrator) Initialize() error {
	_, err := o.router.Initialize()
	return err
}

// ExecuteCommand runs a stewardship command.
func (o *Orchestrator) ExecuteCommand(command string, args any) (*CommandResult, error) {
	switch command {
	case CommandCapabilities:
		return o.CommandCapabilities()
	case CommandRetrieve:
		return o.CommandRetrieve(args.(RetrieveArgs))
	case CommandStore:
		return o.CommandStore(args.(StoreArgs))
	case CommandExtract:
		return o.CommandExtract(args.(ExtractArgs))
	case CommandTrace:
		return o.CommandTrace(args.(TraceArgs))
	case CommandInject:
		return o.CommandInject(args.(InjectArgs))
	case CommandManage:
		return o.CommandManage(args.(ManageArgs))
	default:
		return &CommandResult{Success: false, Output: fmt.Sprintf("Unknown command: %s", command)}, nil
	}
}

// CommandCapabilities reports the capabilities of the rule graph.
func (o *Orchestrator) CommandCapabilities() (*CommandResult, error) {
	caps := o.router.FormatCapabilities()
	return &CommandResult{Success: true, Output: caps, Data: o.router.GetCapabilities()}, nil
}

// validateScopeOptions rejects a command that mixes the global and the
// project scope.
func validateScopeOptions(global bool, scope *string) error {
	if global && scope != nil {
		return fmt.Errorf("Use either --global or --scope, not both.")
	}
	return nil
}

// resolveProjectScope returns the project scope of a command.
func (o *Orchestrator) resolveProjectScope(scope *string) string {
	if scope != nil {
		if trimmed := strings.TrimSpace(*scope); trimmed != "" {
			return trimmed
		}
	}
	if detected := o.resolver.DetectCurrentProject(); detected != "" {
		return detected
	}
	return "default"
}

// resolveTargetScope returns the scope a command works on.
func (o *Orchestrator) resolveTargetScope(global bool, scope *string) scopeSelection {
	if global {
		return scopeSelection{global: true}
	}
	return scopeSelection{projectID: o.resolveProjectScope(scope)}
}

// configureResolverForScope points the resolver at the scope of a command.
func (o *Orchestrator) configureResolverForScope(global bool, scope *string) (scopeSelection, error) {
	selection := o.resolveTargetScope(global, scope)
	if selection.global {
		o.resolver.ClearProjectScope()
		return selection, nil
	}
	if err := o.resolver.SetProjectScope(selection.projectID); err != nil {
		return selection, err
	}
	return selection, nil
}

// createStoreForScope returns the store of a scope.
func (o *Orchestrator) createStoreForScope(scope scopeSelection) (*RuleStore, error) {
	if scope.global {
		return o.globalStore, nil
	}
	return NewStore(ScopeProject, scope.projectID)
}

// formatScope renders a scope for the command output.
func formatScope(scope scopeSelection) string {
	if scope.global {
		return "global"
	}
	return "project:" + scope.projectID
}

// formatScopeChain renders the scope chain of a command.
func formatScopeChain(scope scopeSelection) string {
	if scope.global {
		return "global"
	}
	return "project:" + scope.projectID + " -> global"
}

// formatRuleScope renders the scope of a rule.
func formatRuleScope(rule RuleNode) string {
	if rule.ProjectScope != nil && *rule.ProjectScope != "" {
		return "project:" + *rule.ProjectScope
	}
	return "global"
}

// scopedConflict is a conflict with the scope it was found in.
type scopedConflict struct {
	rule       RuleNode
	similarity float64
	scope      string
}

// detectConflictsForScope returns the conflicts of a rule in its scope and in
// the global scope.
func (o *Orchestrator) detectConflictsForScope(rule *RuleNode, targetStore *RuleStore, scope scopeSelection) ([]scopedConflict, error) {
	conflicts := []scopedConflict{}
	targetConflicts, err := targetStore.DetectConflicts(rule, nil)
	if err != nil {
		return nil, err
	}
	for _, conflict := range targetConflicts {
		conflicts = append(conflicts, scopedConflict{rule: conflict.Rule, similarity: conflict.Similarity, scope: formatScope(scope)})
	}
	if !scope.global {
		globalConflicts, err := o.globalStore.DetectConflicts(rule, nil)
		if err != nil {
			return nil, err
		}
		for _, conflict := range globalConflicts {
			conflicts = append(conflicts, scopedConflict{rule: conflict.Rule, similarity: conflict.Similarity, scope: "global"})
		}
	}
	return conflicts, nil
}

// CommandRetrieve searches the rule graph.
func (o *Orchestrator) CommandRetrieve(args RetrieveArgs) (*CommandResult, error) {
	if err := validateScopeOptions(args.Global, args.Scope); err != nil {
		return &CommandResult{Success: false, Output: err.Error()}, nil
	}

	scope, err := o.configureResolverForScope(args.Global, args.Scope)
	if err != nil {
		return nil, err
	}

	query := RetrievalQuery{Query: args.Query, Domain: args.Domain}
	result, err := o.resolver.Resolve(query)
	if err != nil {
		return nil, err
	}

	lines := []string{fmt.Sprintf("Found %d rules (%s):", len(result.Rules), formatScopeChain(scope))}
	for i, scored := range result.Rules {
		if i >= 10 {
			break
		}
		deprecated := ""
		if scored.Rule.State.Value == LifecycleDeprecated {
			deprecated = " [DEPRECATED]"
		}
		outOfDomain := ""
		if scored.IsOutOfDomain {
			outOfDomain = " [out-of-domain]"
		}
		lines = append(lines, fmt.Sprintf("\n[%s] [%s]%s%s", scored.Rule.Domain, formatRuleScope(scored.Rule), deprecated, outOfDomain))
		lines = append(lines, fmt.Sprintf("  Score: %s", jsToFixed(scored.Score, 2)))
		content := scored.Rule.Content
		if runes := []rune(content); len(runes) > 100 {
			content = string(runes[:100]) + "..."
		}
		lines = append(lines, "  "+content)
		if scored.Rule.SupersededBy != nil && *scored.Rule.SupersededBy != "" {
			lines = append(lines, "  Superseded by: "+*scored.Rule.SupersededBy)
		}
	}

	return &CommandResult{Success: true, Output: strings.Join(lines, "\n"), Data: result}, nil
}

// CommandStore persists a new rule.
func (o *Orchestrator) CommandStore(args StoreArgs) (*CommandResult, error) {
	if err := validateScopeOptions(args.Global, args.Scope); err != nil {
		return &CommandResult{Success: false, Output: err.Error()}, nil
	}

	scope := o.resolveTargetScope(args.Global, args.Scope)
	store, err := o.createStoreForScope(scope)
	if err != nil {
		return nil, err
	}
	author := "agent"
	if args.Author != nil {
		author = *args.Author
	}
	rule := store.CreateRule(CreateRuleParams{
		Domain:  args.Domain,
		Content: args.Content,
		Author:  &author,
	})

	conflicts, err := o.detectConflictsForScope(rule, store, scope)
	if err != nil {
		return nil, err
	}
	if len(conflicts) > 0 {
		if args.OnConflict == nil {
			conflictLines := []string{"Potential conflicts detected:"}
			for _, conflict := range conflicts {
				conflictLines = append(conflictLines, fmt.Sprintf("  - %s (similarity %s, %s): %s...",
					conflict.rule.ID,
					jsToFixed(conflict.similarity, 2),
					conflict.scope,
					truncateRunes(conflict.rule.Content, 60),
				))
			}
			conflictLines = append(conflictLines, "Re-run with --on-conflict cancel|override|merge to decide.")
			return &CommandResult{
				Success: false,
				Output:  strings.Join(conflictLines, "\n"),
				Data:    map[string]any{"rule": rule, "conflicts": conflicts},
			}, nil
		}

		if *args.OnConflict == ConflictCancel {
			return &CommandResult{
				Success: false,
				Output:  "Store cancelled because conflicting rules exist.",
				Data:    map[string]any{"rule": rule, "conflicts": conflicts},
			}, nil
		}

		for _, conflict := range conflicts {
			conflictStore := store
			if conflict.scope == "global" {
				conflictStore = o.globalStore
			}
			if *args.OnConflict == ConflictMerge {
				rule.Content = conflict.rule.Content + "\n---\n" + rule.Content
				rule.Provenance.OriginalText = conflict.rule.Provenance.OriginalText + "\n---\n" + rule.Provenance.OriginalText
			}
			supersededBy := rule.ID
			if _, err := conflictStore.DeprecateRule(conflict.rule.ID, &supersededBy, author); err != nil {
				return nil, err
			}
		}
	}

	if err := store.SaveRule(rule); err != nil {
		return nil, err
	}
	conflictNote := ""
	if len(conflicts) > 0 {
		conflictNote = fmt.Sprintf(" (resolved %d conflict(s) with %s)", len(conflicts), *args.OnConflict)
	}
	return &CommandResult{
		Success: true,
		Output:  fmt.Sprintf("Rule created: %s (%s)%s", rule.ID, formatScope(scope), conflictNote),
		Data:    map[string]any{"rule": rule, "conflicts": conflicts},
	}, nil
}

// CommandExtract extracts decision candidates from a spec file.
func (o *Orchestrator) CommandExtract(args ExtractArgs) (*CommandResult, error) {
	author := "agent"
	if args.Author != nil {
		author = *args.Author
	}
	candidates := o.extractor.ExtractFromDesign(args.FilePath, author)

	if len(candidates) == 0 {
		requirementCandidates := o.extractor.ExtractFromRequirements(args.FilePath, author)
		if len(requirementCandidates) == 0 {
			return &CommandResult{Success: true, Output: "No extraction candidates found.", Data: []ExtractionCandidate{}}, nil
		}
		return &CommandResult{
			Success: true,
			Output:  fmt.Sprintf("Found %d extraction candidates from requirements.", len(requirementCandidates)),
			Data:    requirementCandidates,
		}, nil
	}

	return &CommandResult{
		Success: true,
		Output:  fmt.Sprintf("Found %d extraction candidates from design.", len(candidates)),
		Data:    candidates,
	}, nil
}

// CommandTrace shows the provenance and the version history of a rule.
func (o *Orchestrator) CommandTrace(args TraceArgs) (*CommandResult, error) {
	if err := validateScopeOptions(args.Global, args.Scope); err != nil {
		return &CommandResult{Success: false, Output: err.Error()}, nil
	}

	var projectStore *RuleStore
	if !args.Global {
		projectScope := o.resolveProjectScope(args.Scope)
		store, err := NewStore(ScopeProject, projectScope)
		if err != nil {
			return nil, err
		}
		projectStore = store
	}

	var rule *RuleNode
	store := o.globalStore
	if projectStore != nil {
		projectRule, err := projectStore.ReadRule(args.RuleID, nil)
		if err != nil {
			return nil, err
		}
		if projectRule != nil {
			rule = projectRule
			store = projectStore
		}
	}
	if rule == nil {
		globalRule, err := o.globalStore.ReadRule(args.RuleID, nil)
		if err != nil {
			return nil, err
		}
		rule = globalRule
	}
	if rule == nil {
		return &CommandResult{Success: false, Output: fmt.Sprintf("Rule not found: %s", args.RuleID)}, nil
	}

	history, err := store.GetRuleHistory(args.RuleID)
	if err != nil {
		return nil, err
	}

	lines := []string{
		fmt.Sprintf("Rule: %s", rule.ID),
		fmt.Sprintf("Scope: %s", formatRuleScope(*rule)),
		fmt.Sprintf("Domain: %s", rule.Domain),
		fmt.Sprintf("Content: %s", rule.Content),
		fmt.Sprintf("State: %s", rule.State.Value),
		fmt.Sprintf("Provenance: %s (%s)", rule.Provenance.Source, provenanceSourceFile(rule.Provenance)),
		fmt.Sprintf("Decision date: %s", rule.Provenance.DecisionDate),
		fmt.Sprintf("Author: %s", rule.Provenance.Author),
	}

	if rule.SupersededBy != nil && *rule.SupersededBy != "" {
		lines = append(lines, fmt.Sprintf("Superseded by: %s", *rule.SupersededBy))
	}

	if len(history) > 0 {
		lines = append(lines, fmt.Sprintf("\nVersion history (%d changes):", len(history)))
		for _, version := range history {
			lines = append(lines, fmt.Sprintf("  v%d: %s by %s (%s -> %s)",
				version.Version,
				version.Timestamp,
				version.ChangedBy,
				version.PreviousState.Value,
				rule.State.Value,
			))
		}
	}

	return &CommandResult{
		Success: true,
		Output:  strings.Join(lines, "\n"),
		Data:    map[string]any{"rule": rule, "history": history},
	}, nil
}

// provenanceSourceFile renders the source file of a provenance record.
func provenanceSourceFile(provenance Provenance) string {
	if provenance.SourceFile == nil || *provenance.SourceFile == "" {
		return "no file"
	}
	return *provenance.SourceFile
}

// CommandInject returns the rule context of a spec phase.
func (o *Orchestrator) CommandInject(args InjectArgs) (*CommandResult, error) {
	if err := validateScopeOptions(args.Global, args.Scope); err != nil {
		return &CommandResult{Success: false, Output: err.Error()}, nil
	}

	if _, err := o.configureResolverForScope(args.Global, args.Scope); err != nil {
		return nil, err
	}
	context, err := o.injector.InjectContextForPhase(args.Phase)
	if err != nil {
		return nil, err
	}
	formatted := o.injector.FormatContextForPrompt(context)
	if formatted == "" {
		formatted = "No context found for this phase."
	}
	return &CommandResult{Success: true, Output: formatted, Data: context}, nil
}

// CommandManage lists and transitions the rules of a scope.
func (o *Orchestrator) CommandManage(args ManageArgs) (*CommandResult, error) {
	if args.Action != "move" {
		if err := validateScopeOptions(args.Global, args.Scope); err != nil {
			return &CommandResult{Success: false, Output: err.Error()}, nil
		}
	}

	switch args.Action {
	case "list":
		scope := o.resolveTargetScope(args.Global, args.Scope)
		store, err := o.createStoreForScope(scope)
		if err != nil {
			return nil, err
		}
		rules, err := store.ListRules(nil)
		if err != nil {
			return nil, err
		}
		grouped := o.lifecycle.GroupByLifecycleState(rules)
		lines := []string{fmt.Sprintf("Scope: %s", formatScope(scope))}
		for _, state := range []LifecycleValue{LifecycleActive, LifecycleDeprecated, LifecycleArchived} {
			stateRules := grouped[state]
			lines = append(lines, fmt.Sprintf("\n%s (%d):", strings.ToUpper(string(state)), len(stateRules)))
			for i, rule := range stateRules {
				if i >= 5 {
					break
				}
				lines = append(lines, fmt.Sprintf("  - %s: %s...", rule.ID, truncateRunes(rule.Content, 60)))
			}
		}
		return &CommandResult{Success: true, Output: strings.Join(lines, "\n"), Data: grouped}, nil
	case "deprecate":
		if args.RuleID == nil {
			return &CommandResult{Success: false, Output: "ruleId required for deprecate action"}, nil
		}
		scope := o.resolveTargetScope(args.Global, args.Scope)
		store, err := o.createStoreForScope(scope)
		if err != nil {
			return nil, err
		}
		lifecycle := o.lifecycle
		if !scope.global {
			lifecycle = NewLifecycleManager(store)
		}
		updated, err := lifecycle.TransitionState(*args.RuleID, LifecycleDeprecated, "agent", nil)
		if err != nil {
			return nil, err
		}
		if updated == nil && !scope.global && (args.Scope == nil || *args.Scope == "") {
			updated, err = o.lifecycle.TransitionState(*args.RuleID, LifecycleDeprecated, "agent", nil)
			if err != nil {
				return nil, err
			}
		}
		if updated != nil {
			return &CommandResult{Success: true, Output: fmt.Sprintf("Deprecated: %s", updated.ID)}, nil
		}
		return &CommandResult{Success: true, Output: "Rule not found"}, nil
	case "archive":
		if args.RuleID == nil {
			return &CommandResult{Success: false, Output: "ruleId required for archive action"}, nil
		}
		scope := o.resolveTargetScope(args.Global, args.Scope)
		store, err := o.createStoreForScope(scope)
		if err != nil {
			return nil, err
		}
		lifecycle := o.lifecycle
		if !scope.global {
			lifecycle = NewLifecycleManager(store)
		}
		updated, err := lifecycle.TransitionState(*args.RuleID, LifecycleArchived, "agent", nil)
		if err != nil {
			return nil, err
		}
		if updated == nil && !scope.global && (args.Scope == nil || *args.Scope == "") {
			updated, err = o.lifecycle.TransitionState(*args.RuleID, LifecycleArchived, "agent", nil)
			if err != nil {
				return nil, err
			}
		}
		if updated != nil {
			return &CommandResult{Success: true, Output: fmt.Sprintf("Archived: %s", updated.ID)}, nil
		}
		return &CommandResult{Success: true, Output: "Rule not found"}, nil
	case "move":
		if args.RuleID == nil {
			return &CommandResult{Success: false, Output: "ruleId required for move action"}, nil
		}
		if args.Global {
			return &CommandResult{Success: false, Output: "move action cannot be combined with global scope"}, nil
		}
		if args.Scope == nil {
			return &CommandResult{Success: false, Output: "scope required for move action"}, nil
		}

		active := "active"
		sourceRule, err := o.globalStore.ReadRule(*args.RuleID, &active)
		if err != nil {
			return nil, err
		}
		if sourceRule == nil {
			return &CommandResult{Success: false, Output: fmt.Sprintf("Active global rule not found: %s", *args.RuleID)}, nil
		}

		targetScope := scopeSelection{projectID: *args.Scope}
		targetStore, err := o.createStoreForScope(targetScope)
		if err != nil {
			return nil, err
		}
		movedRule := sourceRule.clone()
		movedRule.ProjectScope = stringPointer(*args.Scope)
		movedRule.appendKey("projectScope")
		movedRule.State = LifecycleState{
			Value:     sourceRule.State.Value,
			ChangedAt: nowISO(),
			ChangedBy: "agent",
		}

		conflicts, err := targetStore.DetectConflicts(movedRule, nil)
		if err != nil {
			return nil, err
		}
		if len(conflicts) > 0 {
			conflictLines := []string{"Potential project conflicts detected:"}
			for _, conflict := range conflicts {
				conflictLines = append(conflictLines, fmt.Sprintf("  - Similarity %s: %s...",
					jsToFixed(conflict.Similarity, 2),
					truncateRunes(conflict.Rule.Content, 60),
				))
			}
			return &CommandResult{
				Success: false,
				Output:  strings.Join(conflictLines, "\n"),
				Data:    map[string]any{"rule": movedRule, "conflicts": conflicts},
			}, nil
		}

		if err := targetStore.SaveRule(movedRule); err != nil {
			return nil, err
		}
		if _, err := o.lifecycle.TransitionState(sourceRule.ID, LifecycleArchived, "agent", nil); err != nil {
			return nil, err
		}
		return &CommandResult{
			Success: true,
			Output:  fmt.Sprintf("Moved: %s global -> %s", sourceRule.ID, formatScope(targetScope)),
			Data:    map[string]any{"rule": movedRule},
		}, nil
	default:
		return &CommandResult{Success: false, Output: fmt.Sprintf("Unknown manage action: %s", args.Action)}, nil
	}
}

// truncateRunes shortens a text to the given number of characters.
func truncateRunes(text string, limit int) string {
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	return string(runes[:limit])
}

// CapabilityDetector reports whether the rule graph can use the file system.
type CapabilityDetector interface {
	DetectFileSystem() bool
}

// DefaultCapabilityDetector detects the file system capability.
type DefaultCapabilityDetector struct{}

// DetectFileSystem reports whether a writable stewardship directory exists.
func (d *DefaultCapabilityDetector) DetectFileSystem() bool {
	candidates := []string{}
	if sdsHome := os.Getenv("SDS_HOME"); sdsHome != "" {
		candidates = append(candidates, sdsHome)
	}
	candidates = append(candidates, filepath.Join(homeDir(), defaultStewardshipDir))
	candidates = append(candidates, os.TempDir())

	for _, candidate := range candidates {
		if err := os.MkdirAll(candidate, 0o755); err != nil {
			continue
		}
		if directoryIsWritable(candidate) {
			return true
		}
	}
	return false
}

// directoryIsWritable reports whether a file can be created in a directory.
func directoryIsWritable(dir string) bool {
	file, err := os.CreateTemp(dir, ".sds-capability-*")
	if err != nil {
		return false
	}
	name := file.Name()
	_ = file.Close()
	_ = os.Remove(name)
	return true
}

// CapabilityRouter detects and caches the capabilities of the rule graph.
type CapabilityRouter struct {
	detector CapabilityDetector
	cached   *CapabilityReport
	tier     CapabilityTier
}

// NewCapabilityRouter creates a capability router.
func NewCapabilityRouter() *CapabilityRouter {
	return &CapabilityRouter{detector: &DefaultCapabilityDetector{}}
}

// Initialize detects the capabilities of the rule graph.
func (r *CapabilityRouter) Initialize() (*CapabilityReport, error) {
	if r.cached != nil {
		return r.cached, nil
	}
	fileSystem := r.detector.DetectFileSystem()
	r.tier = CapabilityTierJSONGraph

	enabledFeatures := []string{}
	if fileSystem {
		enabledFeatures = append(enabledFeatures, "json-graph", "semantic-retrieval", "versioning", "conflict-detection")
	}

	r.cached = &CapabilityReport{
		Tier:                r.tier,
		FileSystemAvailable: fileSystem,
		EnabledFeatures:     enabledFeatures,
	}
	return r.cached, nil
}

// GetTier returns the capability tier of the rule graph.
func (r *CapabilityRouter) GetTier() CapabilityTier {
	return r.tier
}

// GetCapabilities returns the detected capabilities.
func (r *CapabilityRouter) GetCapabilities() *CapabilityReport {
	return r.cached
}

// SupportsVectorSearch reports whether vector search is available.
func (r *CapabilityRouter) SupportsVectorSearch() bool {
	return false
}

// SupportsJSONGraph reports whether the JSON graph tier is active.
func (r *CapabilityRouter) SupportsJSONGraph() bool {
	return r.tier == CapabilityTierJSONGraph
}

// FormatCapabilities renders the capabilities of the rule graph.
func (r *CapabilityRouter) FormatCapabilities() string {
	caps := r.cached
	if caps == nil {
		return "Capabilities not yet detected. Call initialize() first."
	}
	features := "none"
	if len(caps.EnabledFeatures) > 0 {
		features = strings.Join(caps.EnabledFeatures, ", ")
	}
	fileSystem := "unavailable"
	if caps.FileSystemAvailable {
		fileSystem = "available"
	}
	return strings.Join([]string{
		fmt.Sprintf("Tier: %s", caps.Tier),
		fmt.Sprintf("File System: %s", fileSystem),
		fmt.Sprintf("Enabled Features: %s", features),
	}, "\n")
}
