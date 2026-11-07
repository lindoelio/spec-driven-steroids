package stewardship

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

// jsWhitespaceClass is the character class JavaScript uses for \s.
const jsWhitespaceClass = `[\t\n\v\f\r \x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]`

var (
	desHeadingPattern = regexp.MustCompile(`(?m)^###` + jsWhitespaceClass + `+(DES-\d+):` + jsWhitespaceClass + `+(.+)$`)
	mermaidPattern    = regexp.MustCompile("```mermaid\n(?s)(.+?)```")
	techPatterns      = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\b(PostgreSQL|MySQL|MongoDB|Redis|DynamoDB|Drizzle` + jsWhitespaceClass + `*ORM|Prisma|SQLite)\b`),
		regexp.MustCompile(`(?i)\b(Node\.?js|TypeScript|Python|Rust|Go|Svelte|React|Vue|Angular)\b`),
		regexp.MustCompile(`(?i)\b(AWS|Azure|GCP|S3|EC2|Lambda|Docker|Kubernetes)\b`),
		regexp.MustCompile(`(?i)\b(RabbitMQ|Kafka|SQS|SNS)\b`),
		regexp.MustCompile(`(?i)\b(JWT|OAuth|SAML|LDAP|Passport)\b`),
	}
	glossaryHeadingPattern = regexp.MustCompile(`(?i)##` + jsWhitespaceClass + `+Glossary\n`)
	glossaryTermPattern    = regexp.MustCompile(`(?m)^\|` + jsWhitespaceClass + `*([^|]+?)` + jsWhitespaceClass + `*\|` + jsWhitespaceClass + `*([^|]+?)` + jsWhitespaceClass + `*\|`)
	constraintPattern      = regexp.MustCompile(`(?i)\b(SHALL|MUST|REQUIRED|ESSENTIAL)\b[^\n.]*\.?`)
	requirementHeading     = regexp.MustCompile(`(?m)^###` + jsWhitespaceClass + `+(REQ-\d+):[^\n]+\n`)
	businessRulePattern    = regexp.MustCompile(`(?i)\b(BEFORE|AFTER|WHEN|IF|THEN)\b[^\n.]*\.?`)
	decisionLinePattern    = regexp.MustCompile(`^-\s*`)

	domainSecurityPattern     = regexp.MustCompile(`(?i)\b(security|auth|jwt|oauth|password|permission)\b`)
	domainPerformancePattern  = regexp.MustCompile(`(?i)\b(performance|latency|throughput|cache|optimization)\b`)
	domainLegalPattern        = regexp.MustCompile(`(?i)\b(legal|compliance|gdpr|privacy|regulatory)\b`)
	domainWorkflowPattern     = regexp.MustCompile(`(?i)\b(workflow|git|process|deployment|ci/cd)\b`)
	domainArchitecturePattern = regexp.MustCompile(`(?i)\b(architecture|design|system|module|service|api)\b`)
	domainBusinessPattern     = regexp.MustCompile(`(?i)\b(business|product|requirement|feature)\b`)
)

// defaultExtractionDomain is used when no domain can be inferred.
const defaultExtractionDomain Domain = "architecture"

// SpecDecisionExtractor extracts decision candidates from spec files.
type SpecDecisionExtractor struct {
	store *RuleStore
}

// NewSpecDecisionExtractor creates an extractor that stores candidates in the
// given store.
func NewSpecDecisionExtractor(store *RuleStore) *SpecDecisionExtractor {
	return &SpecDecisionExtractor{store: store}
}

// ExtractFromDesign extracts the decision candidates of a design document.
func (e *SpecDecisionExtractor) ExtractFromDesign(filePath string, author string) []ExtractionCandidate {
	content, ok := readSpecFile(filePath)
	if !ok {
		return []ExtractionCandidate{}
	}
	candidates := []ExtractionCandidate{}

	for _, match := range desHeadingPattern.FindAllStringSubmatch(content, -1) {
		desID := match[1]
		title := match[2]
		domain := inferDomain(title)
		if domain == "" {
			domain = defaultExtractionDomain
		}
		candidates = append(candidates, ExtractionCandidate{
			Domain:  domain,
			Content: fmt.Sprintf("%s: %s", desID, strings.TrimSpace(title)),
			Provenance: Provenance{
				Source:       "extract",
				SourceFile:   stringPointer(filePath),
				DecisionDate: nowISO(),
				Author:       author,
				OriginalText: title,
			},
			Confidence:    0.7,
			SourceElement: desID,
		})
	}

	for _, block := range mermaidPattern.FindAllStringSubmatch(content, -1) {
		diagramContent := block[1]
		for _, pattern := range techPatterns {
			for _, techMatch := range pattern.FindAllString(diagramContent, -1) {
				candidates = append(candidates, ExtractionCandidate{
					Domain:    "architecture",
					SubDomain: stringPointer("technology-choice"),
					Content:   fmt.Sprintf("Technology decision: %s", techMatch),
					Provenance: Provenance{
						Source:       "extract",
						SourceFile:   stringPointer(filePath),
						DecisionDate: nowISO(),
						Author:       author,
						OriginalText: techMatch,
					},
					Confidence:    0.6,
					SourceElement: "mermaid:technology",
				})
			}
		}
	}

	for _, block := range findDecisionsBlocks(content) {
		for _, line := range strings.Split(block, "\n") {
			if !strings.HasPrefix(strings.TrimSpace(line), "-") {
				continue
			}
			decisionText := strings.TrimSpace(decisionLinePattern.ReplaceAllString(line, ""))
			if decisionText == "" {
				continue
			}
			candidates = append(candidates, ExtractionCandidate{
				Domain:  defaultExtractionDomain,
				Content: decisionText,
				Provenance: Provenance{
					Source:       "extract",
					SourceFile:   stringPointer(filePath),
					DecisionDate: nowISO(),
					Author:       author,
					OriginalText: decisionText,
				},
				Confidence:    0.9,
				SourceElement: "_Decisions:block",
			})
		}
	}

	return dedupeCandidates(candidates)
}

// ExtractFromRequirements extracts the decision candidates of a requirements
// document.
func (e *SpecDecisionExtractor) ExtractFromRequirements(filePath string, author string) []ExtractionCandidate {
	content, ok := readSpecFile(filePath)
	if !ok {
		return []ExtractionCandidate{}
	}
	candidates := []ExtractionCandidate{}

	if glossary := glossaryHeadingPattern.FindStringIndex(content); glossary != nil {
		glossaryStart := glossary[1]
		if glossaryStart < len(content) {
			// The captured group needs at least one character.
			glossaryContent := content[glossaryStart:]
			if next := strings.Index(glossaryContent[1:], "\n#"); next >= 0 {
				glossaryContent = glossaryContent[:1+next]
			}
			for _, match := range glossaryTermPattern.FindAllStringSubmatch(glossaryContent, -1) {
				term := match[1]
				definition := match[2]
				if term == "" || definition == "" {
					continue
				}
				candidates = append(candidates, ExtractionCandidate{
					Domain:    "business",
					SubDomain: stringPointer("domain-terminology"),
					Content:   fmt.Sprintf("Term: %s = %s", strings.TrimSpace(term), strings.TrimSpace(definition)),
					Provenance: Provenance{
						Source:       "extract",
						SourceFile:   stringPointer(filePath),
						DecisionDate: nowISO(),
						Author:       author,
						OriginalText: fmt.Sprintf("%s = %s", strings.TrimSpace(term), strings.TrimSpace(definition)),
					},
					Confidence:    0.8,
					SourceElement: fmt.Sprintf("glossary:%s", strings.TrimSpace(term)),
				})
			}
		}
	}

	for _, match := range constraintPattern.FindAllString(content, -1) {
		constraintText := strings.TrimSpace(match)
		if len([]rune(constraintText)) <= 10 {
			continue
		}
		candidates = append(candidates, ExtractionCandidate{
			Domain:    "business",
			SubDomain: stringPointer("constraint"),
			Content:   fmt.Sprintf("Business constraint: %s", constraintText),
			Provenance: Provenance{
				Source:       "extract",
				SourceFile:   stringPointer(filePath),
				DecisionDate: nowISO(),
				Author:       author,
				OriginalText: constraintText,
			},
			Confidence:    0.7,
			SourceElement: "requirements:constraint",
		})
	}

	for _, requirement := range findRequirementBodies(content) {
		for _, match := range businessRulePattern.FindAllString(requirement.body, -1) {
			ruleText := strings.TrimSpace(match)
			if len([]rune(ruleText)) <= 15 {
				continue
			}
			candidates = append(candidates, ExtractionCandidate{
				Domain:    "business",
				SubDomain: stringPointer("business-rule"),
				Content:   fmt.Sprintf("%s: %s", requirement.id, ruleText),
				Provenance: Provenance{
					Source:       "extract",
					SourceFile:   stringPointer(filePath),
					DecisionDate: nowISO(),
					Author:       author,
					OriginalText: ruleText,
				},
				Confidence:    0.6,
				SourceElement: requirement.id,
			})
		}
	}

	return dedupeCandidates(candidates)
}

// StoreCandidate persists an extraction candidate as a rule.
func (e *SpecDecisionExtractor) StoreCandidate(candidate ExtractionCandidate, projectScope *string) (*RuleNode, error) {
	rule := e.store.CreateRule(CreateRuleParams{
		Domain:    candidate.Domain,
		SubDomain: candidate.SubDomain,
		Content:   candidate.Content,
		Author:    &candidate.Provenance.Author,
		Provenance: &Provenance{
			Source:       candidate.Provenance.Source,
			SourceFile:   candidate.Provenance.SourceFile,
			DecisionDate: candidate.Provenance.DecisionDate,
			Author:       candidate.Provenance.Author,
			OriginalText: candidate.Provenance.OriginalText,
		},
		Metadata: &Metadata{
			Confidence: candidate.Confidence,
			ExpiresAt:  expirationISO(),
			Tags:       []string{"extracted", candidate.SourceElement},
		},
		ProjectScope: projectScope,
	})
	if err := e.store.SaveRule(rule); err != nil {
		return nil, err
	}
	return rule, nil
}

// readSpecFile reads a spec file, reporting whether it exists.
func readSpecFile(filePath string) (string, bool) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", false
	}
	return string(content), true
}

// inferDomain derives the domain of a decision heading.
func inferDomain(title string) Domain {
	lower := strings.ToLower(title)
	switch {
	case domainSecurityPattern.MatchString(lower):
		return "security"
	case domainPerformancePattern.MatchString(lower):
		return "performance"
	case domainLegalPattern.MatchString(lower):
		return "legal"
	case domainWorkflowPattern.MatchString(lower):
		return "workflow"
	case domainArchitecturePattern.MatchString(lower):
		return "architecture"
	case domainBusinessPattern.MatchString(lower):
		return "business"
	default:
		return ""
	}
}

// dedupeCandidates removes candidates with the same domain and content.
func dedupeCandidates(candidates []ExtractionCandidate) []ExtractionCandidate {
	seen := map[string]bool{}
	result := []ExtractionCandidate{}
	for _, candidate := range candidates {
		key := fmt.Sprintf("%s:%s", candidate.Domain, hashString(candidate.Content))
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, candidate)
	}
	return result
}

// findDecisionsBlocks returns the contents of the explicit decision blocks.
func findDecisionsBlocks(content string) []string {
	blocks := []string{}
	lower := strings.ToLower(content)
	searchFrom := 0
	for searchFrom < len(content) {
		index := strings.Index(lower[searchFrom:], "_decisions:")
		if index < 0 {
			break
		}
		matchStart := searchFrom + index
		captureStart := matchStart + len("_decisions:")
		if captureStart >= len(content) {
			break
		}
		// The captured group needs at least one character, so the end of the
		// block is searched from the character after the marker.
		end := len(content)
		if next := strings.Index(content[captureStart+1:], "\n#"); next >= 0 {
			end = captureStart + 1 + next
		}
		blocks = append(blocks, content[captureStart:end])
		searchFrom = end
		if searchFrom <= matchStart {
			searchFrom = matchStart + 1
		}
	}
	return blocks
}

// requirementBody is the body of a requirement section.
type requirementBody struct {
	id   string
	body string
}

// findRequirementBodies returns the bodies of the requirement sections of a
// requirements document.
func findRequirementBodies(content string) []requirementBody {
	requirements := []requirementBody{}
	for _, match := range requirementHeading.FindAllStringSubmatchIndex(content, -1) {
		id := content[match[2]:match[3]]
		bodyStart := match[1]
		if bodyStart >= len(content) {
			// The body needs at least one character.
			continue
		}
		// The captured group needs at least one character, so the body is
		// searched from the character after the heading.
		end := bodyStart + 1
		for end <= len(content) {
			if requirementBodyEndsAt(content, end) {
				break
			}
			end++
		}
		requirements = append(requirements, requirementBody{id: id, body: content[bodyStart:end]})
	}
	return requirements
}

// requirementBodyEndsAt reports whether a requirement body ends at a position.
func requirementBodyEndsAt(content string, position int) bool {
	if position < len(content) && isLineStart(content, position) && strings.HasPrefix(content[position:], "###") {
		return true
	}
	if position < len(content) && content[position] == '\n' {
		rest := content[position+1:]
		if strings.HasPrefix(rest, "##") && len(rest) > 2 && isJSWhitespace(rune(rest[2])) {
			return true
		}
		if strings.HasPrefix(rest, "#") && len(rest) > 1 && isJSWhitespace(rune(rest[1])) {
			return true
		}
	}
	if position == len(content) {
		return true
	}
	return isLineTerminator(rune(content[position]))
}

// isLineStart reports whether a position starts a line.
func isLineStart(content string, position int) bool {
	if position == 0 {
		return true
	}
	return isLineTerminator(rune(content[position-1]))
}

// isLineTerminator reports whether a rune ends a line.
func isLineTerminator(r rune) bool {
	switch r {
	case '\n', '\r', 0x2028, 0x2029:
		return true
	}
	return false
}

// stringPointer returns a pointer to a copy of a string.
func stringPointer(value string) *string {
	return &value
}
