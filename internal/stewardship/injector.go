package stewardship

import (
	"fmt"
	"strings"
)

// InjectedContext is the rule context of one domain for a spec phase.
type InjectedContext struct {
	Domain string
	Rules  []*RuleNode
	Source string
}

// PhaseContextInjector retrieves the rules that are relevant for a spec phase.
type PhaseContextInjector struct {
	resolver               *ProjectScopedResolver
	sessionInjectedContext map[string][]InjectedContext
}

// NewPhaseContextInjector creates an injector for a resolver.
func NewPhaseContextInjector(resolver *ProjectScopedResolver) *PhaseContextInjector {
	return &PhaseContextInjector{
		resolver:               resolver,
		sessionInjectedContext: map[string][]InjectedContext{},
	}
}

// RelevantDomainsForPhase returns the domains that matter for a phase.
func (i *PhaseContextInjector) RelevantDomainsForPhase(phase string) []string {
	switch phase {
	case "requirements":
		return []string{"business", "workflow", "security", "legal"}
	case "design":
		return []string{"architecture", "security", "performance", "technical-debt"}
	case "tasks":
		return []string{"workflow", "team-structure"}
	case "implementation":
		return []string{"architecture", "business", "workflow"}
	default:
		return []string{}
	}
}

// InjectContextForPhase returns the context of a phase.
func (i *PhaseContextInjector) InjectContextForPhase(phase string) ([]InjectedContext, error) {
	domains := i.RelevantDomainsForPhase(phase)
	injected := []InjectedContext{}

	for _, domain := range domains {
		limit := 5
		query := RetrievalQuery{
			Query:             "",
			Domain:            &domain,
			IncludeDeprecated: false,
			Limit:             &limit,
			MatchMode:         "domain",
		}
		result, err := i.resolver.Resolve(query)
		if err != nil {
			return nil, err
		}
		relevantRules := []ScoredRule{}
		for _, scored := range result.Rules {
			if !scored.IsOutOfDomain {
				relevantRules = append(relevantRules, scored)
			}
		}
		if len(relevantRules) == 0 {
			continue
		}
		rules := make([]*RuleNode, 0, len(relevantRules))
		fromProject := false
		for _, scored := range relevantRules {
			rules = append(rules, &scored.Rule)
			if scored.Rule.ProjectScope != nil && *scored.Rule.ProjectScope != "" {
				fromProject = true
			}
		}
		source := "global"
		if fromProject {
			source = "project"
		}
		injected = append(injected, InjectedContext{Domain: domain, Rules: rules, Source: source})
	}

	i.sessionInjectedContext[phase] = injected
	return injected, nil
}

// FormatContextForPrompt renders the phase context for a prompt.
func (i *PhaseContextInjector) FormatContextForPrompt(contexts []InjectedContext) string {
	if len(contexts) == 0 {
		return ""
	}

	lines := []string{}
	lines = append(lines, "\n--- Context from Knowledge Base ---\n")

	for _, context := range contexts {
		lines = append(lines, fmt.Sprintf("\n[%s] (%s):", strings.ToUpper(context.Domain), context.Source))
		for i, rule := range context.Rules {
			if i >= 3 {
				break
			}
			content := rule.Content
			if runes := []rune(content); len(runes) > 150 {
				content = string(runes[:150]) + "..."
			}
			source := "global"
			if rule.ProjectScope != nil && *rule.ProjectScope != "" {
				source = "project:" + *rule.ProjectScope
			}
			lines = append(lines, fmt.Sprintf("  • %s [%s, %s, confidence=%s, decided=%s, expires=%s] %s",
				rule.ID,
				rule.Domain,
				source,
				jsNumberString(rule.Metadata.Confidence),
				rule.Provenance.DecisionDate,
				rule.Metadata.ExpiresAt,
				content,
			))
		}
	}

	lines = append(lines, "\n--- End Context ---\n")
	return strings.Join(lines, "\n")
}

// GetSessionContext returns the context injected for a phase.
func (i *PhaseContextInjector) GetSessionContext(phase string) []InjectedContext {
	return i.sessionInjectedContext[phase]
}

// OfferToCapture records a decision as a rule. The placeholder of the
// TypeScript implementation is kept: the confirmation flow is owned by the
// caller of the command.
func (i *PhaseContextInjector) OfferToCapture(decision string, domain string) (*RuleNode, bool) {
	return nil, false
}

// ClearSessionContext empties the injected context cache.
func (i *PhaseContextInjector) ClearSessionContext() {
	i.sessionInjectedContext = map[string][]InjectedContext{}
}
