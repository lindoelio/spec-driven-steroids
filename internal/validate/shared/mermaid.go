package shared

import (
	"regexp"
	"strings"
)

// MermaidError is a single Mermaid validation error.
type MermaidError struct {
	Line         int
	ErrorType    string
	Message      string
	SuggestedFix string
}

// MermaidWarning is a single Mermaid validation warning.
type MermaidWarning struct {
	Line    int
	Message string
}

// MermaidValidationResult is the outcome of validating one Mermaid block.
type MermaidValidationResult struct {
	Valid       bool
	Errors      []MermaidError
	Warnings    []MermaidWarning
	DiagramType string
}

// MermaidBlock is a fenced Mermaid code block found in a document.
type MermaidBlock struct {
	Content   string
	StartLine int
	EndLine   int
}

// SupportedDiagramTypes lists the Mermaid diagram types the validator
// understands.
var SupportedDiagramTypes = []string{
	"flowchart",
	"graph",
	"sequencediagram",
	"classdiagram",
	"erdiagram",
}

var knownUnsupportedDiagramTypes = []string{
	"gitgraph",
	"mindmap",
	"timeline",
	"quadrantchart",
	"requirementdiagram",
	"gantt",
	"pie",
	"state",
	"journey",
	"c4context",
	"c4container",
	"c4component",
}

var (
	participantPattern = regexp.MustCompile(`(?i)^(?:create\s+)?(?:participant|actor)\s+([A-Za-z][A-Za-z0-9_]*)`)
	messagePattern     = regexp.MustCompile(`(?i)^([A-Za-z][A-Za-z0-9_]*)\s*-?-?>>?\s*([A-Za-z][A-Za-z0-9_]*)`)
	activationPattern  = regexp.MustCompile(`(?i)^(?:activate|deactivate)\s+([A-Za-z][A-Za-z0-9_]*)`)
	blockKeywordPatt   = regexp.MustCompile(`(?i)^(?:loop|alt|else|opt|par|and|critical|option|break)\b`)
)

// ExtractMermaidBlocks returns the Mermaid code blocks of a document.
func ExtractMermaidBlocks(content string) []MermaidBlock {
	blocks := make([]MermaidBlock, 0, 4)
	lines := splitLines(content)

	inMermaidBlock := false
	blockStart := -1
	blockLines := make([]string, 0, 16)

	for index, line := range lines {
		trimmed := strings.TrimSpace(line)

		if trimmed == "```mermaid" {
			inMermaidBlock = true
			blockStart = index + 1
			blockLines = blockLines[:0]
			continue
		}

		if inMermaidBlock && trimmed == "```" {
			blocks = append(blocks, MermaidBlock{
				Content:   strings.Join(blockLines, "\n"),
				StartLine: blockStart,
				EndLine:   index + 1,
			})
			inMermaidBlock = false
			blockStart = -1
			blockLines = blockLines[:0]
			continue
		}

		if inMermaidBlock {
			blockLines = append(blockLines, line)
		}
	}

	if inMermaidBlock && blockStart > 0 {
		blocks = append(blocks, MermaidBlock{
			Content:   strings.Join(blockLines, "\n"),
			StartLine: blockStart,
			EndLine:   len(lines),
		})
	}

	return blocks
}

// DetectDiagramType returns the diagram type of a Mermaid block and whether
// the type is supported by the validator.
func DetectDiagramType(content string) (string, bool) {
	lines := splitLines(content)
	firstLine := ""
	if len(lines) > 0 {
		firstLine = strings.ToLower(strings.TrimSpace(lines[0]))
	}

	for _, supported := range SupportedDiagramTypes {
		if strings.HasPrefix(firstLine, supported) {
			return supported, true
		}
	}

	for _, unsupported := range knownUnsupportedDiagramTypes {
		if strings.HasPrefix(firstLine, unsupported) {
			return unsupported, false
		}
	}

	fields := regexp.MustCompile(`\s+`).Split(firstLine, -1)
	possible := ""
	if len(fields) > 0 {
		possible = fields[0]
	}
	if possible == "" {
		return "", false
	}
	return possible, false
}

// ValidateMermaidDiagram validates one Mermaid code block.
func ValidateMermaidDiagram(content string, blockStartLine int) MermaidValidationResult {
	errors := make([]MermaidError, 0, 2)
	warnings := make([]MermaidWarning, 0, 1)

	if strings.TrimSpace(content) == "" {
		return MermaidValidationResult{
			Valid: false,
			Errors: []MermaidError{{
				Line:         blockStartLine,
				ErrorType:    "EmptyBlock",
				Message:      "Mermaid code block is empty",
				SuggestedFix: "Add Mermaid diagram content or remove the empty block",
			}},
			Warnings:    warnings,
			DiagramType: "",
		}
	}

	diagramType, supported := DetectDiagramType(content)
	if diagramType == "" {
		errors = append(errors, MermaidError{
			Line:         blockStartLine,
			ErrorType:    "MissingDiagramType",
			Message:      "No diagram type specified on first line",
			SuggestedFix: "Add a diagram type: flowchart, sequenceDiagram, classDiagram, or erDiagram",
		})
		return MermaidValidationResult{Valid: false, Errors: errors, Warnings: warnings}
	}

	if !supported {
		warnings = append(warnings, MermaidWarning{
			Line:    blockStartLine,
			Message: "Diagram type '" + diagramType + "' is not supported for validation. Supported types: " + strings.Join(SupportedDiagramTypes, ", "),
		})
		return MermaidValidationResult{Valid: true, Errors: errors, Warnings: warnings, DiagramType: diagramType}
	}

	if diagramType == "sequencediagram" {
		validateSequenceDiagram(splitLines(content), blockStartLine, &errors)
	}

	return MermaidValidationResult{
		Valid:       len(errors) == 0,
		Errors:      errors,
		Warnings:    warnings,
		DiagramType: diagramType,
	}
}

func validateSequenceDiagram(lines []string, startLine int, errors *[]MermaidError) {
	knownParticipants := map[string]bool{}
	type activation struct {
		line        int
		participant string
	}
	activations := make([]activation, 0, 4)

	for index, line := range lines {
		lineNum := startLine + index
		trimmed := strings.TrimSpace(line)

		if index == 0 {
			continue
		}
		if trimmed == "" || strings.HasPrefix(trimmed, "%%") || strings.HasPrefix(trimmed, "note ") ||
			strings.HasPrefix(trimmed, "rect ") || trimmed == "end" {
			continue
		}
		if strings.HasPrefix(trimmed, "autonumber") {
			continue
		}
		if blockKeywordPatt.MatchString(trimmed) {
			continue
		}

		if match := participantPattern.FindStringSubmatch(trimmed); match != nil {
			knownParticipants[match[1]] = true
			continue
		}

		if match := messagePattern.FindStringSubmatch(trimmed); match != nil {
			// Mermaid implicitly declares both endpoints of a message.
			knownParticipants[match[1]] = true
			knownParticipants[match[2]] = true
			continue
		}

		if match := activationPattern.FindStringSubmatch(trimmed); match != nil {
			activations = append(activations, activation{line: lineNum, participant: match[1]})
		}
	}

	for _, item := range activations {
		if knownParticipants[item.participant] {
			continue
		}
		*errors = append(*errors, MermaidError{
			Line:         item.line,
			ErrorType:    "UndefinedParticipant",
			Message:      "Participant '" + item.participant + "' is not defined",
			SuggestedFix: "Add 'participant " + item.participant + "' before this line",
		})
	}
}
