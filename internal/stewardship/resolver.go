package stewardship

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// DefaultCacheTTL is the lifetime of the resolver session cache.
const DefaultCacheTTL = 5 * time.Minute

// ScopeConflict reports a project rule that contradicts a global rule.
type ScopeConflict struct {
	ProjectRule RuleNode
	GlobalRule  RuleNode
}

// ScopeResolutionResult is the outcome of a scoped lookup.
type ScopeResolutionResult struct {
	Rules          []ScoredRule
	ScopesResolved []string
	Conflicts      []ScopeConflict
}

// cachedResult is one entry of the resolver session cache.
type cachedResult struct {
	rules     []ScoredRule
	timestamp time.Time
}

// ProjectScopedResolver resolves rules of the current project and falls back
// to the global scope.
type ProjectScopedResolver struct {
	globalStore         *RuleStore
	projectStore        *RuleStore
	currentProjectScope string
	engine              *SemanticRetrievalEngine
	sessionCache        map[string]cachedResult
	cacheTTL            time.Duration
}

// NewProjectScopedResolver creates a resolver for the global store.
func NewProjectScopedResolver(globalStore *RuleStore) *ProjectScopedResolver {
	return &ProjectScopedResolver{
		globalStore:  globalStore,
		engine:       NewSemanticRetrievalEngine(globalStore),
		sessionCache: map[string]cachedResult{},
		cacheTTL:     DefaultCacheTTL,
	}
}

// SetCacheTTL overrides the lifetime of the session cache.
func (r *ProjectScopedResolver) SetCacheTTL(ttl time.Duration) { r.cacheTTL = ttl }

// SetProjectScope selects the project scope used for lookups.
func (r *ProjectScopedResolver) SetProjectScope(projectID string) error {
	store, err := NewStore(ScopeProject, projectID)
	if err != nil {
		return err
	}
	r.currentProjectScope = projectID
	r.projectStore = store
	r.engine = NewSemanticRetrievalEngine(store)
	r.ClearSessionCache()
	return nil
}

// ClearProjectScope drops the project scope.
func (r *ProjectScopedResolver) ClearProjectScope() {
	r.currentProjectScope = ""
	r.projectStore = nil
	r.engine = NewSemanticRetrievalEngine(r.globalStore)
	r.ClearSessionCache()
}

// DetectCurrentProject returns the project identifier of the working
// directory.
func (r *ProjectScopedResolver) DetectCurrentProject() string {
	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}
	return DetectProjectID(cwd)
}

// ClearSessionCache empties the resolver session cache.
func (r *ProjectScopedResolver) ClearSessionCache() {
	r.sessionCache = map[string]cachedResult{}
}

// GetScopesResolved returns the keys of the resolver session cache.
func (r *ProjectScopedResolver) GetScopesResolved() []string {
	keys := make([]string, 0, len(r.sessionCache))
	for key := range r.sessionCache {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// Resolve returns the rules of the project scope with the global scope as
// fallback.
func (r *ProjectScopedResolver) Resolve(query RetrievalQuery) (*ScopeResolutionResult, error) {
	scopeKey := "global"
	if r.projectStore != nil {
		scopeKey = "project:" + r.currentProjectScope
		if r.currentProjectScope == "" {
			scopeKey = "project:active"
		}
	}
	cacheKey := scopeKey + "|" + retrievalQueryKey(query)

	if cached, ok := r.sessionCache[cacheKey]; ok {
		if time.Since(cached.timestamp) < r.cacheTTL {
			return &ScopeResolutionResult{
				Rules:          cached.rules,
				ScopesResolved: []string{"session"},
				Conflicts:      []ScopeConflict{},
			}, nil
		}
		delete(r.sessionCache, cacheKey)
	}

	scopesResolved := []string{}
	allRules := []ScoredRule{}
	conflicts := []ScopeConflict{}

	globalEngine := NewSemanticRetrievalEngine(r.globalStore)
	globalResults, err := globalEngine.Retrieve(query)
	if err != nil {
		return nil, err
	}

	if r.projectStore != nil {
		projectQuery := query
		projectQuery.ProjectScope = nil
		projectResults, err := r.engine.Retrieve(projectQuery)
		if err != nil {
			return nil, err
		}
		allRules = append(allRules, projectResults.Rules...)
		scopesResolved = append(scopesResolved, "project")

		for _, projectRule := range projectResults.Rules {
			for _, globalRule := range globalResults.Rules {
				if projectRule.Rule.Domain != globalRule.Rule.Domain {
					continue
				}
				if projectRule.Rule.ID == globalRule.Rule.ID {
					continue
				}
				similarity := computeSimilarity(projectRule.Rule.Content, globalRule.Rule.Content)
				if similarity > 0.7 {
					conflicts = append(conflicts, ScopeConflict{
						ProjectRule: projectRule.Rule,
						GlobalRule:  globalRule.Rule,
					})
				}
			}
		}
	}

	allRules = append(allRules, globalResults.Rules...)
	scopesResolved = append(scopesResolved, "global")

	deduped := dedupeRules(allRules)
	ranked := r.rankScopedResults(deduped)

	r.sessionCache[cacheKey] = cachedResult{rules: ranked, timestamp: time.Now()}

	return &ScopeResolutionResult{Rules: ranked, ScopesResolved: scopesResolved, Conflicts: conflicts}, nil
}

// dedupeRules keeps the highest scoring entry of every rule.
func dedupeRules(rules []ScoredRule) []ScoredRule {
	order := []string{}
	best := map[string]ScoredRule{}
	for _, rule := range rules {
		existing, ok := best[rule.Rule.ID]
		if !ok {
			order = append(order, rule.Rule.ID)
			best[rule.Rule.ID] = rule
			continue
		}
		if rule.Score > existing.Score {
			best[rule.Rule.ID] = rule
		}
	}
	result := make([]ScoredRule, 0, len(order))
	for _, id := range order {
		result = append(result, best[id])
	}
	return result
}

// rankScopedResults sorts the rules with active and project rules first.
func (r *ProjectScopedResolver) rankScopedResults(rules []ScoredRule) []ScoredRule {
	ranked := r.engine.RankResults(rules)
	if r.currentProjectScope == "" {
		return ranked
	}
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
		aProject := ruleScope(a.Rule) == r.currentProjectScope
		bProject := ruleScope(b.Rule) == r.currentProjectScope
		if aProject != bProject {
			return aProject
		}
		return b.Score-a.Score < 0
	})
	return ranked
}

// ruleScope returns the project scope of a rule.
func ruleScope(rule RuleNode) string {
	if rule.ProjectScope == nil {
		return ""
	}
	return *rule.ProjectScope
}

// retrievalQueryKey builds the session cache key of a query.
func retrievalQueryKey(query RetrievalQuery) string {
	parts := []string{"query=" + query.Query}
	if query.Domain != nil {
		parts = append(parts, "domain="+*query.Domain)
	}
	if query.ProjectScope != nil {
		parts = append(parts, "projectScope="+*query.ProjectScope)
	}
	if query.LifecycleState != nil {
		parts = append(parts, "lifecycleState="+string(*query.LifecycleState))
	}
	if query.IncludeDeprecated {
		parts = append(parts, "includeDeprecated=true")
	}
	if query.Limit != nil {
		parts = append(parts, fmt.Sprintf("limit=%d", *query.Limit))
	}
	if query.MatchMode != "" {
		parts = append(parts, "matchMode="+query.MatchMode)
	}
	return strings.Join(parts, ",")
}

var (
	sshRemotePattern    = regexp.MustCompile(`^[^@]+@[^:]+:(.+)$`)
	httpsRemotePattern  = regexp.MustCompile(`^https?://[^/]+/`)
	sshURLPattern       = regexp.MustCompile(`^ssh://[^/]+/`)
	gitSuffixPattern    = regexp.MustCompile(`\.git$`)
	remoteUnsafePattern = regexp.MustCompile(`[^A-Za-z0-9._/-]+`)
	remoteSlashPattern  = regexp.MustCompile(`[/]+`)
	edgeDashPattern     = regexp.MustCompile(`^-+|-+$`)
	scopeUnsafePattern  = regexp.MustCompile(`[^a-z0-9._-]+`)
)

// normalizeGitRemote turns a git remote into a stable project name fragment.
func normalizeGitRemote(remote string) string {
	trimmed := strings.TrimSpace(remote)
	if trimmed == "" {
		return ""
	}
	pathPart := trimmed
	if match := sshRemotePattern.FindStringSubmatch(trimmed); match != nil {
		pathPart = match[1]
	}
	pathPart = httpsRemotePattern.ReplaceAllString(pathPart, "")
	pathPart = sshURLPattern.ReplaceAllString(pathPart, "")
	pathPart = gitSuffixPattern.ReplaceAllString(pathPart, "")
	pathPart = remoteUnsafePattern.ReplaceAllString(pathPart, "-")
	pathPart = remoteSlashPattern.ReplaceAllString(pathPart, "-")
	pathPart = edgeDashPattern.ReplaceAllString(pathPart, "")
	pathPart = strings.ToLower(pathPart)
	if len(pathPart) > 48 {
		pathPart = pathPart[:48]
	}
	return pathPart
}

// DetectProjectID returns the identifier of the project rooted at a directory.
func DetectProjectID(projectDir string) string {
	canonicalDir := projectDir
	if resolved, err := filepath.EvalSymlinks(projectDir); err == nil {
		canonicalDir = resolved
	}
	if absolute, err := filepath.Abs(canonicalDir); err == nil {
		canonicalDir = absolute
	}
	canonicalDir = filepath.Clean(canonicalDir)

	remote := ""
	command := exec.Command("git", "config", "--get", "remote.origin.url")
	command.Dir = canonicalDir
	if output, err := command.Output(); err == nil {
		remote = strings.TrimSpace(string(output))
	}

	name := normalizeGitRemote(remote)
	if name == "" {
		base := strings.ToLower(filepath.Base(canonicalDir))
		name = scopeUnsafePattern.ReplaceAllString(base, "-")
	}

	digest := sha256.Sum256([]byte(canonicalDir))
	suffix := hex.EncodeToString(digest[:])[:8]

	safeName := edgeDashPattern.ReplaceAllString(name, "")
	if len(safeName) > 48 {
		safeName = safeName[:48]
	}
	if safeName == "" {
		safeName = "project"
	}
	return safeName + "-" + suffix
}
