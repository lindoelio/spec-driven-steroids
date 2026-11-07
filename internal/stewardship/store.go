package stewardship

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// ScopeLevel identifies the storage scope of a rule graph.
type ScopeLevel string

// Supported scope levels.
const (
	ScopeGlobal  ScopeLevel = "global"
	ScopeOrg     ScopeLevel = "org"
	ScopeProject ScopeLevel = "project"
)

const (
	defaultStewardshipDir = ".agents"
	scopeDirName          = "stewardship"
	writeLockName         = ".write.lock"
	versionsDirName       = ".versions"
	lockTimeout           = 5 * time.Second
	lockPollInterval      = 25 * time.Millisecond
)

// RuleStore is the JSON rule graph of one scope.
type RuleStore struct {
	scopeID           string
	scopeDir          string
	conflictThreshold float64
}

// StoreConfig configures a RuleStore.
type StoreConfig struct {
	// ConflictSimilarityThreshold overrides the default conflict threshold.
	ConflictSimilarityThreshold *float64
	// RootDir overrides the stewardship root directory.
	RootDir string
}

// CreateRuleParams describes a rule that is about to be stored.
type CreateRuleParams struct {
	Domain       Domain
	SubDomain    *string
	Content      string
	Author       *string
	Provenance   *Provenance
	Metadata     *Metadata
	ProjectScope *string
}

// DefaultBaseDir returns the stewardship root directory.
//
// SDS_HOME overrides the home directory; otherwise the store lives in
// ~/.agents/stewardship.
func DefaultBaseDir() string {
	if sdsHome := os.Getenv("SDS_HOME"); sdsHome != "" {
		return filepath.Join(sdsHome, scopeDirName)
	}
	return filepath.Join(homeDir(), defaultStewardshipDir, scopeDirName)
}

// homeDir resolves the user home directory the way Node's os.homedir does.
func homeDir() string {
	if home := os.Getenv("HOME"); home != "" {
		return home
	}
	if home, err := os.UserHomeDir(); err == nil {
		return home
	}
	return ""
}

// scopeDir returns the directory of a scope below the given root.
func scopeDir(baseDir string, scope ScopeLevel, scopeID string) (string, error) {
	switch scope {
	case ScopeGlobal:
		return filepath.Join(baseDir, "global"), nil
	case ScopeOrg:
		id, err := sanitizeScopeID(scopeID)
		if err != nil {
			return "", err
		}
		return filepath.Join(baseDir, "orgs", id), nil
	default:
		id, err := sanitizeScopeID(scopeID)
		if err != nil {
			return "", err
		}
		return filepath.Join(baseDir, "projects", id), nil
	}
}

// SanitizeScopeID normalises a scope identifier for use as a directory name.
func SanitizeScopeID(scopeID string) (string, error) {
	return sanitizeScopeID(scopeID)
}

func sanitizeScopeID(scopeID string) (string, error) {
	sanitized := strings.ToLower(strings.TrimSpace(scopeID))
	var b strings.Builder
	for _, r := range sanitized {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '.', r == '_', r == '-':
			b.WriteRune(r)
		default:
			if b.Len() == 0 || !strings.HasSuffix(b.String(), "-") {
				b.WriteRune('-')
			}
		}
	}
	sanitized = strings.Trim(b.String(), "-")
	if sanitized == "" || sanitized == "." || sanitized == ".." ||
		strings.Contains(sanitized, "/") || strings.Contains(sanitized, "\\") {
		return "", fmt.Errorf("Invalid stewardship scope id: %s", scopeID)
	}
	return sanitized, nil
}

// NewStore opens the rule graph of a scope.
func NewStore(scope ScopeLevel, scopeID string) (*RuleStore, error) {
	return NewStoreWithConfig(scope, scopeID, StoreConfig{})
}

// NewStoreWithConfig opens the rule graph of a scope with explicit settings.
func NewStoreWithConfig(scope ScopeLevel, scopeID string, config StoreConfig) (*RuleStore, error) {
	baseDir := config.RootDir
	if baseDir == "" {
		baseDir = DefaultBaseDir()
	}
	dir, err := scopeDir(baseDir, scope, scopeID)
	if err != nil {
		return nil, err
	}
	threshold := ConflictSimilarityThreshold
	if config.ConflictSimilarityThreshold != nil {
		threshold = *config.ConflictSimilarityThreshold
	}
	store := &RuleStore{
		scopeID:           scopeID,
		scopeDir:          dir,
		conflictThreshold: threshold,
	}
	if scope == ScopeProject {
		migrateLegacyProjectScope(scopeID, dir)
	}
	store.ensureDirectoryStructure()
	return store, nil
}

// ScopeDir returns the directory holding the rule graph of the scope.
func (s *RuleStore) ScopeDir() string { return s.scopeDir }

// ScopeID returns the scope identifier the store was opened with.
func (s *RuleStore) ScopeID() string { return s.scopeID }

// SetConflictThreshold overrides the conflict similarity threshold.
func (s *RuleStore) SetConflictThreshold(threshold float64) { s.conflictThreshold = threshold }

func (s *RuleStore) ensureDirectoryStructure() {
	for _, state := range []string{"active", "deprecated", "archived"} {
		ensureDir(filepath.Join(s.scopeDir, state))
	}
	ensureDir(filepath.Join(s.scopeDir, versionsDirName))
}

// migrateLegacyProjectScope copies a pre-rename project scope into the
// scope directory used today. The migration is best effort.
func migrateLegacyProjectScope(scopeID string, targetBaseDir string) {
	if scopeID == "" {
		return
	}
	if _, err := os.Stat(targetBaseDir); err == nil {
		return
	}
	cwd, err := os.Getwd()
	if err != nil {
		return
	}
	legacyID, err := sanitizeScopeID(filepath.Base(cwd))
	if err != nil {
		return
	}
	if legacyID == scopeID {
		return
	}
	legacyDir := filepath.Join(DefaultBaseDir(), "projects", legacyID)
	if _, err := os.Stat(legacyDir); err != nil {
		return
	}
	_ = copyDirectory(legacyDir, targetBaseDir)
}

func copyDirectory(source string, destination string) error {
	return filepath.Walk(source, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, relative)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		if err := ensureDir(filepath.Dir(target)); err != nil {
			return err
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.Create(target)
		if err != nil {
			return err
		}
		defer out.Close()
		_, err = io.Copy(out, in)
		return err
	})
}

func ensureDir(dir string) error {
	return os.MkdirAll(dir, 0o755)
}

// withWriteLock runs an operation while holding the scope write lock.
func (s *RuleStore) withWriteLock(operation func() error) error {
	release, err := acquireFileLock(filepath.Join(s.scopeDir, writeLockName), lockTimeout)
	if err != nil {
		return err
	}
	defer release()
	return operation()
}

// acquireFileLock creates an exclusive lock file and waits for it when it is
// held by another live process.
func acquireFileLock(lockPath string, timeout time.Duration) (func(), error) {
	if err := ensureDir(filepath.Dir(lockPath)); err != nil {
		return nil, err
	}
	startedAt := time.Now()
	for {
		file, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if err == nil {
			_, _ = file.WriteString(strconv.Itoa(os.Getpid()))
			_ = file.Close()
			return func() { _ = os.Remove(lockPath) }, nil
		}
		if !errors.Is(err, os.ErrExist) {
			return nil, err
		}

		owner, ownerErr := readLockOwner(lockPath)
		if ownerErr != nil {
			_ = os.Remove(lockPath)
			continue
		}
		if owner > 0 {
			if err := syscall.Kill(owner, 0); err != nil {
				_ = os.Remove(lockPath)
				continue
			}
		}

		if time.Since(startedAt) > timeout {
			return nil, fmt.Errorf("Timed out waiting for stewardship write lock: %s", lockPath)
		}
		time.Sleep(lockPollInterval)
	}
}

// readLockOwner reads the process id recorded in a lock file.
func readLockOwner(lockPath string) (int, error) {
	content, err := os.ReadFile(lockPath)
	if err != nil {
		return 0, err
	}
	trimmed := strings.TrimSpace(string(content))
	if trimmed == "" {
		return 0, nil
	}
	owner, err := strconv.Atoi(trimmed)
	if err != nil {
		return 0, nil
	}
	return owner, nil
}

// atomicWriteFile writes a file through a temporary file and a rename.
func atomicWriteFile(filePath string, contents []byte) error {
	tempPath := fmt.Sprintf("%s.%d.%s.tmp", filePath, os.Getpid(), randomSuffix())
	if err := os.WriteFile(tempPath, contents, 0o644); err != nil {
		return err
	}
	if err := os.Rename(tempPath, filePath); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	return nil
}

// randomSuffix produces the short random suffix of a temporary file name.
func randomSuffix() string {
	const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
	buf := make([]byte, 6)
	source := cryptoRandom()
	for i := range buf {
		buf[i] = alphabet[int(source[i])%len(alphabet)]
	}
	return string(buf)
}

func stateDir(base string, state string) string {
	return filepath.Join(base, state)
}

func rulePath(dir string, id string) string {
	return filepath.Join(dir, id+".json")
}

// CreateRule builds a rule with full provenance and default expiration.
func (s *RuleStore) CreateRule(params CreateRuleParams) *RuleNode {
	id := generateRuleID()

	author := "agent"
	if params.Author != nil {
		author = *params.Author
	}
	now := nowISO()

	provenance := Provenance{
		Source:       "manual",
		DecisionDate: now,
		Author:       author,
		OriginalText: params.Content,
	}
	if params.Provenance != nil {
		if params.Provenance.Source != "" {
			provenance.Source = params.Provenance.Source
		}
		provenance.SourceFile = params.Provenance.SourceFile
		if params.Provenance.DecisionDate != "" {
			provenance.DecisionDate = params.Provenance.DecisionDate
		}
		if params.Provenance.Author != "" {
			provenance.Author = params.Provenance.Author
		}
		if params.Provenance.OriginalText != "" {
			provenance.OriginalText = params.Provenance.OriginalText
		}
	}

	metadata := Metadata{
		Confidence: 0.8,
		ExpiresAt:  expirationISO(),
		Tags:       []string{},
	}
	if params.Metadata != nil {
		if params.Metadata.Confidence != 0 {
			metadata.Confidence = params.Metadata.Confidence
		}
		if params.Metadata.ExpiresAt != "" {
			metadata.ExpiresAt = params.Metadata.ExpiresAt
		}
		if params.Metadata.Tags != nil {
			metadata.Tags = params.Metadata.Tags
		}
	}

	rule := &RuleNode{
		ID:         id,
		Domain:     params.Domain,
		SubDomain:  params.SubDomain,
		Content:    params.Content,
		Provenance: provenance,
		Metadata:   metadata,
		State: LifecycleState{
			Value:     LifecycleActive,
			ChangedAt: now,
			ChangedBy: author,
		},
		Relations: []string{},
	}
	if params.ProjectScope != nil {
		rule.ProjectScope = params.ProjectScope
	} else if s.scopeID != "" {
		scope := s.scopeID
		rule.ProjectScope = &scope
	}
	return rule
}

// generateRuleID creates an identifier of the form rule-<timestamp>-<random>.
func generateRuleID() string {
	return fmt.Sprintf("rule-%d-%s", time.Now().UnixMilli(), randomSuffix())
}

// expirationISO returns the default expiration timestamp of a rule.
func expirationISO() string {
	return time.Now().AddDate(DefaultExpirationYears, 0, 0).UTC().Format("2006-01-02T15:04:05.000Z")
}

// nowISO returns the current time in the format used by the rule graph.
func nowISO() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

// SaveRule persists a rule in the directory of its lifecycle state.
func (s *RuleStore) SaveRule(rule *RuleNode) error {
	return s.withWriteLock(func() error {
		dir := stateDir(s.scopeDir, string(rule.State.Value))
		path := rulePath(dir, rule.ID)
		if err := atomicWriteFile(path, marshalJSON(ruleObject(rule))); err != nil {
			return fmt.Errorf("Failed to save rule %s: %v", rule.ID, err)
		}
		return nil
	})
}

// ReadRule returns a rule from the scope, optionally restricted to one state.
func (s *RuleStore) ReadRule(ruleID string, state *string) (*RuleNode, error) {
	states := []string{"active", "deprecated", "archived"}
	if state != nil {
		states = []string{*state}
	}
	for _, candidate := range states {
		path := rulePath(stateDir(s.scopeDir, candidate), ruleID)
		content, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		rule, err := ruleFromJSON(content)
		if err != nil {
			// Corrupted file - the rule is treated as missing.
			return nil, nil
		}
		return rule, nil
	}
	return nil, nil
}

// ruleUpdates carries the fields of a rule update. A field that is present is
// applied, a field that is absent keeps the stored value.
type ruleUpdates struct {
	content             *string
	supersededByPresent bool
	supersededBy        *string
	state               *LifecycleState
	provenance          *Provenance
}

// UpdateRule applies an update to a stored rule and archives its previous
// version.
func (s *RuleStore) UpdateRule(ruleID string, updates ruleUpdates, changedBy string) (*RuleNode, error) {
	var updated *RuleNode
	err := s.withWriteLock(func() error {
		rule, err := s.ReadRule(ruleID, nil)
		if err != nil {
			return err
		}
		if rule == nil {
			return nil
		}

		if err := s.archiveVersion(rule, changedBy); err != nil {
			return err
		}

		next := rule.clone()
		if updates.content != nil {
			next.Content = *updates.content
		}
		if updates.supersededByPresent {
			next.SupersededBy = updates.supersededBy
			next.appendKey("supersededBy")
		}
		if updates.provenance != nil {
			next.Provenance = *updates.provenance
		}
		state := next.State
		if updates.state != nil {
			state = *updates.state
		}
		next.State = LifecycleState{
			Value:     state.Value,
			ChangedAt: nowISO(),
			ChangedBy: changedBy,
		}

		if rule.State.Value != next.State.Value {
			newDir := stateDir(s.scopeDir, string(next.State.Value))
			oldPath := rulePath(stateDir(s.scopeDir, string(rule.State.Value)), ruleID)
			if err := ensureDir(newDir); err != nil {
				return err
			}
			if err := atomicWriteFile(rulePath(newDir, ruleID), marshalJSON(ruleObject(next))); err != nil {
				return err
			}
			if _, err := os.Stat(oldPath); err == nil {
				_ = os.Remove(oldPath)
			}
		} else {
			dir := stateDir(s.scopeDir, string(rule.State.Value))
			if err := atomicWriteFile(rulePath(dir, next.ID), marshalJSON(ruleObject(next))); err != nil {
				return err
			}
		}

		updated = next
		return nil
	})
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// ListRulesParams filters a rule listing.
type ListRulesParams struct {
	Domain       *Domain
	State        *string
	ProjectScope *string
}

// ListRules returns the rules of the scope in directory order.
func (s *RuleStore) ListRules(params *ListRulesParams) ([]*RuleNode, error) {
	states := []string{"active", "deprecated", "archived"}
	if params != nil && params.State != nil {
		states = []string{*params.State}
	}
	rules := []*RuleNode{}
	for _, state := range states {
		dir := stateDir(s.scopeDir, state)
		entries, err := readDirEntries(dir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if !strings.HasSuffix(entry, ".json") {
				continue
			}
			content, err := os.ReadFile(filepath.Join(dir, entry))
			if err != nil {
				continue
			}
			rule, err := ruleFromJSON(content)
			if err != nil || rule == nil {
				// Corrupted file - skip silently.
				continue
			}
			if params != nil {
				if params.Domain != nil && rule.Domain != *params.Domain {
					continue
				}
				if params.ProjectScope != nil {
					scope := ""
					if rule.ProjectScope != nil {
						scope = *rule.ProjectScope
					}
					if scope != *params.ProjectScope {
						continue
					}
				}
			}
			rules = append(rules, rule)
		}
	}
	return rules, nil
}

// readDirEntries lists the entries of a directory in alphabetical order.
//
// The TypeScript implementation reads directories through Node's fs.readdirSync,
// which sorts the entries with alphasort. The rule graph relies on that order
// when it lists rules.
func readDirEntries(dir string) ([]string, error) {
	file, err := os.Open(dir)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	entries, err := file.ReadDir(-1)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	sort.Strings(names)
	return names, nil
}

// DeprecateRule marks a rule as superseded by another rule.
func (s *RuleStore) DeprecateRule(ruleID string, supersededBy *string, changedBy string) (*RuleNode, error) {
	state := LifecycleState{Value: LifecycleDeprecated, ChangedAt: nowISO(), ChangedBy: changedBy}
	return s.UpdateRule(ruleID, ruleUpdates{
		supersededByPresent: true,
		supersededBy:        supersededBy,
		state:               &state,
	}, changedBy)
}

// ArchiveRule marks a rule as archived.
func (s *RuleStore) ArchiveRule(ruleID string, changedBy string) (*RuleNode, error) {
	state := LifecycleState{Value: LifecycleArchived, ChangedAt: nowISO(), ChangedBy: changedBy}
	return s.UpdateRule(ruleID, ruleUpdates{state: &state}, changedBy)
}

// archiveVersion appends the current state of a rule to its version history.
func (s *RuleStore) archiveVersion(rule *RuleNode, changedBy string) error {
	versionsDir := filepath.Join(s.scopeDir, versionsDirName)
	if err := ensureDir(versionsDir); err != nil {
		return err
	}
	path := rulePath(versionsDir, rule.ID)

	versions := []RuleVersion{}
	if content, err := os.ReadFile(path); err == nil {
		parsed, err := versionsFromJSON(content)
		if err != nil {
			return err
		}
		versions = parsed
	}

	versions = append(versions, RuleVersion{
		RuleID:        rule.ID,
		Version:       len(versions) + 1,
		Timestamp:     nowISO(),
		ChangedBy:     changedBy,
		PreviousState: rule.State,
	})
	return atomicWriteFile(path, marshalJSON(versions))
}

// GetRuleHistory returns the version history of a rule.
func (s *RuleStore) GetRuleHistory(ruleID string) ([]RuleVersion, error) {
	path := rulePath(filepath.Join(s.scopeDir, versionsDirName), ruleID)
	content, err := os.ReadFile(path)
	if err != nil {
		return []RuleVersion{}, nil
	}
	return versionsFromJSON(content)
}

// DetectConflicts returns the active rules of the same domain that are
// similar enough to the given rule.
func (s *RuleStore) DetectConflicts(newRule *RuleNode, threshold *float64) ([]Conflict, error) {
	effective := s.conflictThreshold
	if threshold != nil {
		effective = *threshold
	}
	domain := newRule.Domain
	state := "active"
	existing, err := s.ListRules(&ListRulesParams{Domain: &domain, State: &state})
	if err != nil {
		return nil, err
	}
	conflicts := []Conflict{}
	for _, rule := range existing {
		if rule.ID == newRule.ID {
			continue
		}
		similarity := computeSimilarity(newRule.Content, rule.Content)
		if similarity >= effective {
			conflicts = append(conflicts, Conflict{Rule: *rule, Similarity: similarity})
		}
	}
	return conflicts, nil
}
