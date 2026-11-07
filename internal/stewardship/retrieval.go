package stewardship

import (
	"crypto/rand"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

// SemanticRetrievalEngine ranks the rules of a store against a query.
type SemanticRetrievalEngine struct {
	store *RuleStore
}

// NewSemanticRetrievalEngine creates an engine for a store.
func NewSemanticRetrievalEngine(store *RuleStore) *SemanticRetrievalEngine {
	return &SemanticRetrievalEngine{store: store}
}

// Retrieve returns the rules of the store that match a query.
func (e *SemanticRetrievalEngine) Retrieve(query RetrievalQuery) (*RetrievalResult, error) {
	state := "active"
	if query.LifecycleState != nil {
		state = string(*query.LifecycleState)
	}
	rules, err := e.store.ListRules(&ListRulesParams{State: &state})
	if err != nil {
		return nil, err
	}

	if !query.IncludeDeprecated && query.LifecycleState == nil {
		filtered := make([]*RuleNode, 0, len(rules))
		for _, rule := range rules {
			if rule.State.Value == LifecycleActive {
				filtered = append(filtered, rule)
			}
		}
		rules = filtered
	}

	now := time.Now().UnixMilli()
	filtered := make([]*RuleNode, 0, len(rules))
	for _, rule := range rules {
		if rule.State.Value != LifecycleActive {
			filtered = append(filtered, rule)
			continue
		}
		expiresAt, ok := parseTimestamp(rule.Metadata.ExpiresAt)
		if !ok || expiresAt > now {
			filtered = append(filtered, rule)
		}
	}
	rules = filtered

	if query.ProjectScope != nil {
		filtered := make([]*RuleNode, 0, len(rules))
		for _, rule := range rules {
			scope := ""
			if rule.ProjectScope != nil {
				scope = *rule.ProjectScope
			}
			if scope == *query.ProjectScope {
				filtered = append(filtered, rule)
			}
		}
		rules = filtered
	}

	domainMatches := []ScoredRule{}
	crossDomainMatches := []ScoredRule{}

	matchMode := query.MatchMode
	if matchMode == "" {
		matchMode = "keyword"
		if query.Domain != nil && *query.Domain != "" {
			if strings.ToLower(strings.TrimSpace(query.Query)) == strings.ToLower(*query.Domain) {
				matchMode = "domain"
			}
		}
	}

	queryDomains := []Domain{}
	if query.Domain != nil {
		queryDomains = append(queryDomains, *query.Domain)
		queryDomains = append(queryDomains, SearchDomains(*query.Domain)...)
	}

	for _, rule := range rules {
		keywordScore := computeKeywordScore(query.Query, rule)
		recencyScore := computeRecencyScore(rule)
		confidenceScore := rule.Metadata.Confidence
		compositeScore := keywordScore*0.5 + recencyScore*0.3 + confidenceScore*0.2

		isDomainMatch := len(queryDomains) == 0
		for _, candidate := range queryDomains {
			if candidate == rule.Domain {
				isDomainMatch = true
				break
			}
		}
		includeByKeyword := keywordScore > 0 || strings.TrimSpace(query.Query) == "" || matchMode == "domain"

		if !includeByKeyword {
			continue
		}
		scored := ScoredRule{Rule: *rule, Score: compositeScore, IsOutOfDomain: !isDomainMatch}
		if isDomainMatch {
			domainMatches = append(domainMatches, scored)
		} else {
			crossDomainMatches = append(crossDomainMatches, scored)
		}
	}

	sortScored(domainMatches)
	sortScored(crossDomainMatches)

	final := domainMatches
	if len(queryDomains) > 0 && len(domainMatches) == 0 {
		final = make([]ScoredRule, len(crossDomainMatches))
		for i, scored := range crossDomainMatches {
			scored.IsOutOfDomain = true
			final[i] = scored
		}
	}

	limit := 20
	if query.Limit != nil {
		limit = *query.Limit
	}
	limited := final
	if limit < len(limited) {
		limited = limited[:limit]
	}

	return &RetrievalResult{Rules: limited, TotalCount: len(final), Query: query}, nil
}

// RankResults sorts rules with active rules first and higher scores first.
func (e *SemanticRetrievalEngine) RankResults(rules []ScoredRule) []ScoredRule {
	ranked := append([]ScoredRule(nil), rules...)
	sort.SliceStable(ranked, func(i, j int) bool {
		a := ranked[i]
		b := ranked[j]
		if a.Rule.State.Value != b.Rule.State.Value {
			if a.Rule.State.Value == LifecycleActive {
				return true
			}
			if b.Rule.State.Value == LifecycleActive {
				return false
			}
		}
		return b.Score-a.Score < 0
	})
	return ranked
}

// sortScored orders scored rules by descending score, keeping the order of
// equal scores.
func sortScored(rules []ScoredRule) {
	sort.SliceStable(rules, func(i, j int) bool {
		return rules[j].Score-rules[i].Score < 0
	})
}

// computeKeywordScore scores a rule by the overlap of the query words with
// the rule content.
func computeKeywordScore(query string, rule *RuleNode) float64 {
	queryWords := significantWords(query)
	contentWords := significantWords(rule.Content)
	if len(queryWords) == 0 || len(contentWords) == 0 {
		return 0
	}
	matched := 0
	for _, queryWord := range queryWords {
		for _, contentWord := range contentWords {
			if strings.Contains(contentWord, queryWord) || strings.Contains(queryWord, contentWord) {
				matched++
				break
			}
		}
	}
	return float64(matched) / float64(len(queryWords))
}

// computeRecencyScore decays the score of a rule with its age.
func computeRecencyScore(rule *RuleNode) float64 {
	decisionDate, ok := parseTimestamp(rule.Provenance.DecisionDate)
	if !ok {
		return math.NaN()
	}
	now := time.Now().UnixMilli()
	ageInDays := float64(now-decisionDate) / (1000 * 60 * 60 * 24)
	return math.Max(0, 1-ageInDays/365)
}

// computeSimilarity returns the Jaccard similarity of the significant words of
// two texts.
func computeSimilarity(a string, b string) float64 {
	wordsA := wordSet(a)
	wordsB := wordSet(b)
	if len(wordsA) == 0 || len(wordsB) == 0 {
		return 0
	}
	intersection := 0
	for word := range wordsA {
		if _, ok := wordsB[word]; ok {
			intersection++
		}
	}
	union := len(wordsA) + len(wordsB) - intersection
	return float64(intersection) / float64(union)
}

// wordSet returns the distinct significant words of a text.
func wordSet(text string) map[string]bool {
	set := map[string]bool{}
	for _, word := range significantWords(text) {
		set[word] = true
	}
	return set
}

// significantWords splits a text into the lowercase words longer than two
// characters.
func significantWords(text string) []string {
	parts := jsSplitWhitespace(strings.ToLower(text))
	words := make([]string, 0, len(parts))
	for _, part := range parts {
		if len([]rune(part)) > 2 {
			words = append(words, part)
		}
	}
	return words
}

// jsSplitWhitespace splits a text on runs of JavaScript whitespace.
func jsSplitWhitespace(text string) []string {
	parts := []string{}
	var current strings.Builder
	inSeparator := false
	for _, r := range text {
		if isJSWhitespace(r) {
			if !inSeparator {
				parts = append(parts, current.String())
				current.Reset()
				inSeparator = true
			}
			continue
		}
		inSeparator = false
		current.WriteRune(r)
	}
	parts = append(parts, current.String())
	return parts
}

// isJSWhitespace reports whether a rune is whitespace in JavaScript.
func isJSWhitespace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0x00a0, 0x1680, 0x2028, 0x2029,
		0x202f, 0x205f, 0x3000, 0xfeff:
		return true
	}
	return r >= 0x2000 && r <= 0x200a
}

// hashString returns the base 36 hash of a string.
func hashString(text string) string {
	var hash int32
	for _, unit := range utf16.Encode([]rune(text)) {
		hash = (hash<<5 - hash) + int32(unit)
	}
	value := int64(hash)
	if value < 0 {
		value = -value
	}
	if value == 0 {
		return "0"
	}
	const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
	var digits []byte
	for value > 0 {
		digits = append([]byte{alphabet[value%36]}, digits...)
		value /= 36
	}
	return string(digits)
}

// cryptoRandom returns random bytes for temporary file names.
func cryptoRandom() []byte {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return []byte(strconv.FormatInt(time.Now().UnixNano(), 16))
	}
	return buffer
}

// parseTimestamp parses an ISO-8601 timestamp.
func parseTimestamp(value string) (int64, bool) {
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.000Z0700",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UnixMilli(), true
		}
	}
	return 0, false
}

// domainTaxonomy keeps the hierarchy of known domains in registration order.
type domainTaxonomy struct {
	order   []Domain
	nodes   map[Domain]*DomainHierarchyNode
	parents map[Domain]Domain
}

var taxonomy = newDomainTaxonomy()

func newDomainTaxonomy() *domainTaxonomy {
	t := &domainTaxonomy{
		nodes:   map[Domain]*DomainHierarchyNode{},
		parents: map[Domain]Domain{},
	}
	for _, domain := range StandardDomains {
		t.nodes[domain] = &DomainHierarchyNode{Domain: domain, Children: []Domain{}}
		t.order = append(t.order, domain)
	}
	return t
}

// IsStandardDomain reports whether a domain ships with the CLI.
func IsStandardDomain(domain string) bool {
	for _, standard := range StandardDomains {
		if standard == domain {
			return true
		}
	}
	return false
}

// IsKnownDomain reports whether a domain is part of the taxonomy.
func IsKnownDomain(domain string) bool {
	if IsStandardDomain(domain) {
		return true
	}
	_, ok := taxonomy.nodes[domain]
	return ok
}

// RegisterDomain adds a domain to the taxonomy.
func RegisterDomain(domain Domain, parent *Domain) *DomainHierarchyNode {
	if node, ok := taxonomy.nodes[domain]; ok {
		return node
	}
	node := &DomainHierarchyNode{Domain: domain, Children: []Domain{}}
	if parent != nil {
		node.Parent = parent
		taxonomy.parents[domain] = *parent
	}
	taxonomy.nodes[domain] = node
	taxonomy.order = append(taxonomy.order, domain)
	if parent != nil {
		if _, ok := taxonomy.nodes[*parent]; !ok {
			taxonomy.nodes[*parent] = &DomainHierarchyNode{Domain: *parent, Children: []Domain{}}
			taxonomy.order = append(taxonomy.order, *parent)
		}
		parentNode := taxonomy.nodes[*parent]
		found := false
		for _, child := range parentNode.Children {
			if child == domain {
				found = true
				break
			}
		}
		if !found {
			parentNode.Children = append(parentNode.Children, domain)
		}
	}
	return node
}

// GetDomainNode returns the taxonomy node of a domain.
func GetDomainNode(domain Domain) *DomainHierarchyNode {
	return taxonomy.nodes[domain]
}

// GetChildDomains returns the descendants of a domain.
func GetChildDomains(parent Domain) []Domain {
	node := taxonomy.nodes[parent]
	if node == nil {
		return []Domain{}
	}
	children := append([]Domain(nil), node.Children...)
	for _, child := range node.Children {
		children = append(children, GetChildDomains(child)...)
	}
	return children
}

// GetParentDomains returns the ancestors of a domain.
func GetParentDomains(domain Domain) []Domain {
	node := taxonomy.nodes[domain]
	if node == nil || node.Parent == nil {
		return []Domain{}
	}
	parents := []Domain{*node.Parent}
	parents = append(parents, GetParentDomains(*node.Parent)...)
	return parents
}

// SearchDomains returns the domains that match a query.
func SearchDomains(query string) []Domain {
	normalized := strings.ToLower(query)
	results := []Domain{}
	for _, domain := range taxonomy.order {
		if strings.Contains(strings.ToLower(domain), normalized) {
			results = append(results, domain)
		}
	}
	for _, domain := range GetChildDomains(query) {
		found := false
		for _, existing := range results {
			if existing == domain {
				found = true
				break
			}
		}
		if !found {
			results = append(results, domain)
		}
	}
	return results
}

// ValidateDomain checks a domain name and suggests a known domain.
func ValidateDomain(domain string) (bool, *Domain) {
	if IsKnownDomain(domain) {
		return true, nil
	}
	searchResults := SearchDomains(domain)
	if len(searchResults) == 1 {
		suggestion := searchResults[0]
		return false, &suggestion
	}
	return false, nil
}
