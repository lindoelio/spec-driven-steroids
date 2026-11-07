package stewardship

// StoreInput are the inputs of the store command.
type StoreInput struct {
	// Domain is the subject area of the rule.
	Domain Domain
	// Content is the text of the rule.
	Content string
	// Author is the author recorded in the provenance of the rule.
	Author *string
	// Scope is the project scope the rule is stored in.
	Scope *string
	// Global stores the rule in the global scope.
	Global bool
	// OnConflict resolves rules that conflict with the new rule.
	OnConflict *ConflictDecision
}

// RetrieveOptions are the options of the retrieve command.
type RetrieveOptions struct {
	// Domain restricts the lookup to a domain.
	Domain *Domain
	// Scope is the project scope the lookup starts in.
	Scope *string
	// Global restricts the lookup to the global scope.
	Global bool
}

// ExtractOptions are the options of the extract command.
type ExtractOptions struct {
	// Author is the author recorded in the provenance of the candidates.
	Author *string
}

// TraceOptions are the options of the trace command.
type TraceOptions struct {
	// Scope is the project scope the lookup starts in.
	Scope *string
	// Global restricts the lookup to the global scope.
	Global bool
}

// InjectOptions are the options of the inject command.
type InjectOptions struct {
	// Scope is the project scope the lookup starts in.
	Scope *string
	// Global restricts the lookup to the global scope.
	Global bool
}

// ManageOptions are the options of the manage command.
type ManageOptions struct {
	// RuleID identifies the rule the action works on.
	RuleID *string
	// Scope is the project scope the action works in.
	Scope *string
	// Global restricts the action to the global scope.
	Global bool
}

// Capabilities reports the capabilities of the rule graph.
func Capabilities() (CapabilityReport, error) {
	orchestrator, err := NewOrchestrator()
	if err != nil {
		return CapabilityReport{}, err
	}
	if err := orchestrator.Initialize(); err != nil {
		return CapabilityReport{}, err
	}
	result, err := orchestrator.CommandCapabilities()
	if err != nil {
		return CapabilityReport{}, err
	}
	caps, ok := result.Data.(*CapabilityReport)
	if !ok || caps == nil {
		return CapabilityReport{}, nil
	}
	return *caps, nil
}

// Store persists a new rule in the rule graph.
func Store(in StoreInput) (any, error) {
	orchestrator, err := NewOrchestrator()
	if err != nil {
		return nil, err
	}
	if err := orchestrator.Initialize(); err != nil {
		return nil, err
	}
	return orchestrator.CommandStore(StoreArgs{
		Domain:     in.Domain,
		Content:    in.Content,
		Author:     in.Author,
		Scope:      in.Scope,
		Global:     in.Global,
		OnConflict: in.OnConflict,
	})
}

// Retrieve searches the rule graph.
func Retrieve(query string, opts RetrieveOptions) (any, error) {
	orchestrator, err := NewOrchestrator()
	if err != nil {
		return nil, err
	}
	if err := orchestrator.Initialize(); err != nil {
		return nil, err
	}
	return orchestrator.CommandRetrieve(RetrieveArgs{
		Query:  query,
		Domain: opts.Domain,
		Scope:  opts.Scope,
		Global: opts.Global,
	})
}

// Extract extracts the decision candidates of a spec file.
func Extract(filePath string, opts ExtractOptions) (any, error) {
	orchestrator, err := NewOrchestrator()
	if err != nil {
		return nil, err
	}
	if err := orchestrator.Initialize(); err != nil {
		return nil, err
	}
	return orchestrator.CommandExtract(ExtractArgs{FilePath: filePath, Author: opts.Author})
}

// Trace shows the provenance and the version history of a rule.
func Trace(ruleID string, opts TraceOptions) (any, error) {
	orchestrator, err := NewOrchestrator()
	if err != nil {
		return nil, err
	}
	if err := orchestrator.Initialize(); err != nil {
		return nil, err
	}
	return orchestrator.CommandTrace(TraceArgs{
		RuleID: ruleID,
		Scope:  opts.Scope,
		Global: opts.Global,
	})
}

// Inject returns the rule context of a spec phase.
func Inject(phase string, opts InjectOptions) (any, error) {
	orchestrator, err := NewOrchestrator()
	if err != nil {
		return nil, err
	}
	if err := orchestrator.Initialize(); err != nil {
		return nil, err
	}
	return orchestrator.CommandInject(InjectArgs{
		Phase:  phase,
		Scope:  opts.Scope,
		Global: opts.Global,
	})
}

// Manage lists and transitions the rules of a scope.
func Manage(action string, opts ManageOptions) (any, error) {
	orchestrator, err := NewOrchestrator()
	if err != nil {
		return nil, err
	}
	if err := orchestrator.Initialize(); err != nil {
		return nil, err
	}
	return orchestrator.CommandManage(ManageArgs{
		Action: action,
		RuleID: opts.RuleID,
		Scope:  opts.Scope,
		Global: opts.Global,
	})
}
