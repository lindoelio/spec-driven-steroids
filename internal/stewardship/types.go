// Package stewardship ports the context stewardship rule graph from the
// TypeScript implementation in packages/cli/src/context-stewardship.
//
// The on-disk format is byte-compatible with the TypeScript release so rules
// stored before the rewrite stay retrievable.
package stewardship

// LifecycleValue enumerates the rule lifecycle states.
type LifecycleValue string

// Lifecycle states persisted with every rule.
const (
	LifecycleActive     LifecycleValue = "active"
	LifecycleDeprecated LifecycleValue = "deprecated"
	LifecycleArchived   LifecycleValue = "archived"
)

// CapabilityTier is the fixed capability tier of the rule graph.
type CapabilityTier string

// CapabilityTierJSONGraph is the only tier the rule graph implements.
const CapabilityTierJSONGraph CapabilityTier = "tier2-json-graph"

// Domain identifies the subject area of a rule. Custom domains are allowed.
type Domain = string

// ConflictDecision selects how a conflicting store request is resolved.
type ConflictDecision string

// Supported conflict decisions.
const (
	ConflictOverride ConflictDecision = "override"
	ConflictMerge    ConflictDecision = "merge"
	ConflictCancel   ConflictDecision = "cancel"
)

// Provenance records where a rule came from.
type Provenance struct {
	Source       string  `json:"source"`
	SourceFile   *string `json:"sourceFile,omitempty"`
	DecisionDate string  `json:"decisionDate"`
	Author       string  `json:"author"`
	OriginalText string  `json:"originalText"`
}

// Metadata carries rule quality and expiry information.
type Metadata struct {
	Confidence float64  `json:"confidence"`
	ExpiresAt  string   `json:"expiresAt"`
	Tags       []string `json:"tags"`
}

// LifecycleState records the current state of a rule and who changed it.
type LifecycleState struct {
	Value     LifecycleValue `json:"value"`
	ChangedAt string         `json:"changedAt"`
	ChangedBy string         `json:"changedBy"`
}

// RuleNode is a single rule in the knowledge graph.
type RuleNode struct {
	ID           string
	Domain       Domain
	SubDomain    *string
	Content      string
	Provenance   Provenance
	Metadata     Metadata
	State        LifecycleState
	SupersededBy *string
	ProjectScope *string
	Relations    []string

	// keyOrder preserves the JSON key order of the rule. It is populated when a
	// rule is read from disk so a rewritten rule keeps the field order of the
	// file it came from, and it is nil for freshly created rules.
	keyOrder []string
	// omitted records keys that were absent in the source document.
	omitted map[string]bool
	// extras keeps unknown members of a source document so a rewritten rule
	// does not drop them.
	extras *jsonObject
}

// RuleVersion is one entry of a rule's version history.
type RuleVersion struct {
	RuleID        string         `json:"ruleId"`
	Version       int            `json:"version"`
	Timestamp     string         `json:"timestamp"`
	ChangedBy     string         `json:"changedBy"`
	PreviousState LifecycleState `json:"previousState"`
	Diff          *string        `json:"diff,omitempty"`
}

// RetrievalQuery describes a rule lookup.
type RetrievalQuery struct {
	Query             string
	Domain            *Domain
	ProjectScope      *string
	LifecycleState    *LifecycleValue
	IncludeDeprecated bool
	Limit             *int
	MatchMode         string
}

// ScoredRule is a rule together with its retrieval score.
type ScoredRule struct {
	Rule          RuleNode
	Score         float64
	IsOutOfDomain bool
}

// RetrievalResult is the outcome of a retrieval query.
type RetrievalResult struct {
	Rules      []ScoredRule
	TotalCount int
	Query      RetrievalQuery
}

// ConflictResult reports rules that conflict with a candidate rule.
type ConflictResult struct {
	HasConflict      bool
	ConflictingRules []Conflict
}

// Conflict is a rule that conflicts with a candidate rule.
type Conflict struct {
	Rule       RuleNode
	Similarity float64
}

// ExtractionCandidate is a decision candidate extracted from a spec file.
type ExtractionCandidate struct {
	Domain        Domain
	SubDomain     *string
	Content       string
	Provenance    Provenance
	Confidence    float64
	SourceElement string
}

// CapabilityReport reports the runtime capabilities of the rule graph.
type CapabilityReport struct {
	Tier                CapabilityTier `json:"tier"`
	FileSystemAvailable bool           `json:"fileSystemAvailable"`
	EnabledFeatures     []string       `json:"enabledFeatures"`
}

// DomainHierarchyNode describes the position of a domain in the taxonomy.
type DomainHierarchyNode struct {
	Domain   Domain
	Parent   *Domain
	Children []Domain
}

// clone returns a copy of the rule that can be mutated safely.
func (r *RuleNode) clone() *RuleNode {
	next := *r
	if r.keyOrder != nil {
		next.keyOrder = append([]string(nil), r.keyOrder...)
	}
	if r.omitted != nil {
		next.omitted = make(map[string]bool, len(r.omitted))
		for key, value := range r.omitted {
			next.omitted[key] = value
		}
	}
	if r.Relations != nil {
		next.Relations = append([]string(nil), r.Relations...)
	}
	return &next
}

// appendKey records a newly added member so the key order of the document is
// preserved when the rule is written again.
func (r *RuleNode) appendKey(key string) {
	if r.keyOrder == nil {
		r.keyOrder = append([]string(nil), defaultRuleKeyOrder...)
	}
	for _, existing := range r.keyOrder {
		if existing == key {
			return
		}
	}
	r.keyOrder = append(r.keyOrder, key)
}

// Defaults shared with the TypeScript implementation.
const (
	// DefaultExpirationYears is the validity period of a newly stored rule.
	DefaultExpirationYears = 2
	// ConflictSimilarityThreshold is the similarity above which two rules conflict.
	ConflictSimilarityThreshold = 0.85
)

// StandardDomains are the domains shipped with the CLI.
var StandardDomains = []Domain{
	"architecture",
	"business",
	"workflow",
	"security",
	"performance",
	"legal",
	"team-structure",
	"technical-debt",
}
