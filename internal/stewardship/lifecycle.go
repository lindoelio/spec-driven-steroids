package stewardship

import (
	"time"
)

// LifecycleNotification describes a lifecycle event of a rule.
type LifecycleNotification struct {
	RuleID       string
	Type         string
	Message      string
	SupersededBy *string
}

// LifecycleManager applies lifecycle transitions to the rules of a store.
type LifecycleManager struct {
	store            *RuleStore
	notificationSink func(LifecycleNotification)
}

// NewLifecycleManager creates a lifecycle manager for a store.
func NewLifecycleManager(store *RuleStore) *LifecycleManager {
	return &LifecycleManager{store: store}
}

// SetNotificationSink registers a callback for lifecycle notifications.
func (m *LifecycleManager) SetNotificationSink(sink func(LifecycleNotification)) {
	m.notificationSink = sink
}

// TransitionState moves a rule to a new lifecycle state.
func (m *LifecycleManager) TransitionState(ruleID string, newState LifecycleValue, changedBy string, supersededBy *string) (*RuleNode, error) {
	rule, err := m.store.ReadRule(ruleID, nil)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		return nil, nil
	}

	switch newState {
	case LifecycleDeprecated:
		state := LifecycleState{Value: LifecycleDeprecated, ChangedAt: nowISO(), ChangedBy: changedBy}
		updated, err := m.store.UpdateRule(ruleID, ruleUpdates{
			supersededByPresent: true,
			supersededBy:        supersededBy,
			state:               &state,
		}, changedBy)
		if err != nil {
			return nil, err
		}
		if updated != nil && m.notificationSink != nil {
			truncated := rule.Content
			if runes := []rune(truncated); len(runes) > 50 {
				truncated = string(runes[:50])
			}
			m.notificationSink(LifecycleNotification{
				RuleID:       ruleID,
				Type:         "deprecated",
				Message:      `Rule "` + truncated + `..." has been deprecated.`,
				SupersededBy: supersededBy,
			})
		}
		return updated, nil
	case LifecycleArchived:
		state := LifecycleState{Value: LifecycleArchived, ChangedAt: nowISO(), ChangedBy: changedBy}
		updated, err := m.store.UpdateRule(ruleID, ruleUpdates{state: &state}, changedBy)
		if err != nil {
			return nil, err
		}
		if updated != nil && m.notificationSink != nil {
			truncated := rule.Content
			if runes := []rune(truncated); len(runes) > 50 {
				truncated = string(runes[:50])
			}
			m.notificationSink(LifecycleNotification{
				RuleID:  ruleID,
				Type:    "archived",
				Message: `Rule "` + truncated + `..." has been archived.`,
			})
		}
		return updated, nil
	default:
		state := LifecycleState{Value: newState, ChangedAt: nowISO(), ChangedBy: changedBy}
		return m.store.UpdateRule(ruleID, ruleUpdates{state: &state}, changedBy)
	}
}

// ScanExpiredRules deprecates the active rules whose validity has ended.
func (m *LifecycleManager) ScanExpiredRules(changedBy string) ([]*RuleNode, error) {
	state := "active"
	allRules, err := m.store.ListRules(&ListRulesParams{State: &state})
	if err != nil {
		return nil, err
	}
	expired := []*RuleNode{}
	for _, rule := range allRules {
		expiresAt, ok := parseTimestamp(rule.Metadata.ExpiresAt)
		if !ok {
			continue
		}
		if expiresAt <= time.Now().UnixMilli() {
			updated, err := m.TransitionState(rule.ID, LifecycleDeprecated, changedBy, nil)
			if err != nil {
				return nil, err
			}
			if updated != nil {
				expired = append(expired, updated)
			}
		}
	}
	return expired, nil
}

// GroupByLifecycleState groups rules by their lifecycle state.
func (m *LifecycleManager) GroupByLifecycleState(rules []*RuleNode) map[LifecycleValue][]*RuleNode {
	groups := map[LifecycleValue][]*RuleNode{
		LifecycleActive:     {},
		LifecycleDeprecated: {},
		LifecycleArchived:   {},
	}
	for _, rule := range rules {
		groups[rule.State.Value] = append(groups[rule.State.Value], rule)
	}
	return groups
}

// GetRulesByState returns the rules of one lifecycle state.
func (m *LifecycleManager) GetRulesByState(state LifecycleValue) ([]*RuleNode, error) {
	value := string(state)
	return m.store.ListRules(&ListRulesParams{State: &value})
}

// GetActiveRules returns the active rules.
func (m *LifecycleManager) GetActiveRules() ([]*RuleNode, error) {
	return m.GetRulesByState(LifecycleActive)
}

// GetDeprecatedRules returns the deprecated rules.
func (m *LifecycleManager) GetDeprecatedRules() ([]*RuleNode, error) {
	return m.GetRulesByState(LifecycleDeprecated)
}

// GetArchivedRules returns the archived rules.
func (m *LifecycleManager) GetArchivedRules() ([]*RuleNode, error) {
	return m.GetRulesByState(LifecycleArchived)
}

// GetSupersedingRuleLink returns the rule that superseded the given rule.
func (m *LifecycleManager) GetSupersedingRuleLink(rule *RuleNode) *string {
	return rule.SupersededBy
}
