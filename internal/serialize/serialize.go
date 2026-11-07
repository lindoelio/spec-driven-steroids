// Package serialize derives a platform-side artifact from a canonical body.
//
// A serialization is a named profile with a fixed shape. The descriptor
// declares which profile applies and which substitutions the profile applies
// to the body, so the derivation is stated rather than implied.
package serialize

import (
	"fmt"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// Serialization profile names.
const (
	// ProfileMarkdown writes YAML frontmatter followed by the body.
	ProfileMarkdown = "markdown"
	// ProfileToml writes a TOML agent with a multi-line instruction string.
	ProfileToml = "toml"
	// ProfileTomlCommand writes a TOML custom command with a prompt string.
	ProfileTomlCommand = "toml-command"
	// ProfileCommandSkill writes a command as a loadable skill.
	ProfileCommandSkill = "command-skill"
	// ProfileCanonicalTree copies the canonical bytes unchanged.
	ProfileCanonicalTree = "canonical-tree"
)

// Output kinds.
const (
	KindAgent               = "agent"
	KindSpecDrivenCommand   = "spec-driven-command"
	KindInjectGuidelinesCmd = "inject-guidelines-command"
)

// Substitution is one body rewrite.
type Substitution struct {
	// From is the literal text to replace.
	From string
	// To is the replacement.
	To string
}

// Rule describes one derived artifact.
type Rule struct {
	// Serialization names the profile.
	Serialization string
	// OutputKind is the artifact kind, which selects the frontmatter rules.
	OutputKind string
	// Name is the effective frontmatter name.
	Name string
	// Description is the fallback frontmatter description.
	Description string
	// AdditionalFields are the platform-specific frontmatter fields.
	AdditionalFields map[string]string
	// CommandAgent is the agent a command delegates to.
	CommandAgent string
	// Substitutions are the body rewrites the profile applies.
	Substitutions []Substitution
	// BodyWrapper names the registered body wrapper.
	BodyWrapper string
}

// WrapperSkillPreamble names the wrapper the command-as-skill profile
// applies: the headings and the workflow section that surround the body.
const WrapperSkillPreamble = "skill-preamble"

// Source is a canonical artifact read from the canonical tree.
type Source struct {
	// Body is the content without the frontmatter.
	Body string
	// Frontmatter holds the parsed frontmatter fields, in source order.
	Frontmatter map[string]string
	// FrontmatterOrder holds the source order of the frontmatter keys.
	FrontmatterOrder []string
}

// Result is a derived artifact.
type Result struct {
	// Content is the derived file content.
	Content string
	// BodyPreserved reports whether the body survives the derivation.
	BodyPreserved bool
}

// Apply derives the platform-side artifact from a canonical body.
func Apply(rule Rule, source Source) (Result, error) {
	switch rule.Serialization {
	case ProfileMarkdown:
		content := toMarkdown(rule, source)
		return Result{Content: content, BodyPreserved: verifyBodyPreserved(source.Body, content, ProfileMarkdown)}, nil
	case ProfileToml:
		content := toToml(rule, source)
		return Result{Content: content, BodyPreserved: verifyBodyPreserved(source.Body, content, ProfileToml)}, nil
	case ProfileTomlCommand:
		description := sourceDescription(rule, source)
		content := toTomlCommand(source.Body, description)
		return Result{Content: content, BodyPreserved: verifyBodyPreserved(source.Body, content, ProfileTomlCommand)}, nil
	case ProfileCommandSkill:
		if rule.BodyWrapper != "" && rule.BodyWrapper != WrapperSkillPreamble {
			return Result{}, fmt.Errorf("unknown body wrapper %q", rule.BodyWrapper)
		}
		description := sourceDescription(rule, source)
		content := toCommandSkill(rule, source.Body, rule.Name, description)
		return Result{Content: content, BodyPreserved: verifyBodyPreserved(source.Body, content, ProfileCommandSkill)}, nil
	case ProfileCanonicalTree:
		return Result{Content: source.Body, BodyPreserved: true}, nil
	default:
		return Result{}, fmt.Errorf("unknown serialization %q", rule.Serialization)
	}
}

// ParseSource splits a canonical artifact into its body and its frontmatter.
//
// The frontmatter fields keep the order of the source document, so that the
// artifacts derived from a source are reproducible.
//
// An invalid frontmatter is ignored; the body is still transformed.
func ParseSource(content string) Source {
	source := Source{Frontmatter: map[string]string{}}
	match := frontmatterPattern.FindStringSubmatchIndex(content)
	if match == nil {
		source.Body = strings.TrimSpace(content)
		return source
	}
	source.Body = strings.TrimSpace(content[match[1]:])

	var document yaml.Node
	if err := yaml.Unmarshal([]byte(content[match[2]:match[3]]), &document); err != nil {
		return source
	}
	mapping := &document
	if document.Kind == yaml.DocumentNode {
		if len(document.Content) == 0 {
			return source
		}
		mapping = document.Content[0]
	}
	if mapping.Kind != yaml.MappingNode {
		return source
	}

	for index := 0; index+1 < len(mapping.Content); index += 2 {
		key := mapping.Content[index].Value
		value, ok := frontmatterValue(mapping.Content[index+1])
		if !ok {
			continue
		}
		source.Frontmatter[key] = value
		source.FrontmatterOrder = append(source.FrontmatterOrder, key)
	}
	return source
}

// frontmatterValue renders a frontmatter value as the string the previous
// implementation produced.
//
// A null value is skipped, a sequence is joined with a comma and a space, and
// a nested object is rendered the way a string conversion renders it.
func frontmatterValue(node *yaml.Node) (string, bool) {
	switch node.Kind {
	case yaml.ScalarNode:
		if node.Tag == "!!null" {
			return "", false
		}
		return node.Value, true
	case yaml.SequenceNode:
		parts := make([]string, 0, len(node.Content))
		for _, item := range node.Content {
			parts = append(parts, scalarString(item))
		}
		return strings.Join(parts, ", "), true
	case yaml.MappingNode:
		return "[object Object]", true
	default:
		return node.Value, true
	}
}

// scalarString renders a value the way a string conversion renders it.
func scalarString(node *yaml.Node) string {
	switch node.Kind {
	case yaml.ScalarNode:
		if node.Tag == "!!null" {
			return "null"
		}
		return node.Value
	case yaml.SequenceNode:
		parts := make([]string, 0, len(node.Content))
		for _, item := range node.Content {
			parts = append(parts, scalarString(item))
		}
		return strings.Join(parts, ",")
	case yaml.MappingNode:
		return "[object Object]"
	default:
		return node.Value
	}
}

var frontmatterPattern = regexp.MustCompile(`(?s)^---\r?\n(.*?)\r?\n---\r?\n?`)

func sourceDescription(rule Rule, source Source) string {
	if value, ok := source.Frontmatter["description"]; ok && value != "" {
		return value
	}
	return rule.Description
}

func effectiveName(rule Rule, source Source) string {
	switch rule.OutputKind {
	case KindInjectGuidelinesCmd:
		return "inject-guidelines"
	}
	return rule.Name
}

func effectiveDescription(rule Rule, source Source) string {
	switch rule.OutputKind {
	case KindInjectGuidelinesCmd, KindSpecDrivenCommand, KindAgent:
		return sourceDescription(rule, source)
	}
	return rule.Description
}

func toMarkdown(rule Rule, source Source) string {
	lines := []string{"---"}

	name := effectiveName(rule, source)
	description := effectiveDescription(rule, source)

	if name != "" {
		lines = append(lines, "name: "+EscapeYAMLString(name))
	}
	if description != "" {
		lines = append(lines, "description: "+EscapeYAMLString(description))
	}

	for _, key := range source.FrontmatterOrder {
		if key == "name" || key == "description" || key == "agent" {
			continue
		}
		if _, overridden := rule.AdditionalFields[key]; overridden {
			continue
		}
		lines = append(lines, key+": "+EscapeYAMLString(source.Frontmatter[key]))
	}

	for _, key := range sortedKeys(rule.AdditionalFields) {
		lines = append(lines, key+": "+EscapeYAMLString(rule.AdditionalFields[key]))
	}

	if rule.OutputKind != "" && rule.OutputKind != KindAgent && rule.CommandAgent != "" {
		lines = append(lines, "agent: "+EscapeYAMLString(rule.CommandAgent))
	}

	lines = append(lines, "---")
	return strings.Join(lines, "\n") + "\n\n" + source.Body
}

func toToml(rule Rule, source Source) string {
	name := effectiveName(rule, source)
	if name == "" {
		name = "spec-driven"
	}
	description := effectiveDescription(rule, source)

	lines := []string{}
	lines = append(lines, fmt.Sprintf("name = %q", escapeTOMLString(name)))
	lines = append(lines, fmt.Sprintf("description = %q", escapeTOMLString(description)))
	if rule.OutputKind != "" && rule.OutputKind != KindAgent && rule.CommandAgent != "" {
		lines = append(lines, fmt.Sprintf("agent = %q", escapeTOMLString(rule.CommandAgent)))
	}
	lines = append(lines, "developer_instructions = \"\"\"")
	lines = append(lines, escapeTOMLMultilineBody(source.Body))
	lines = append(lines, "\"\"\"")
	lines = append(lines, "sandbox_mode = \"workspace-write\"")
	return strings.Join(lines, "\n")
}

func toTomlCommand(body, description string) string {
	lines := []string{}
	lines = append(lines, fmt.Sprintf("description = %q", escapeTOMLString(description)))
	lines = append(lines, "prompt = \"\"\"")
	lines = append(lines, escapeTOMLMultilineBody(body))
	lines = append(lines, "\"\"\"")
	return strings.Join(lines, "\n")
}

func toCommandSkill(rule Rule, body, name, description string) string {
	normalized := body
	for _, substitution := range rule.Substitutions {
		normalized = strings.ReplaceAll(normalized, substitution.From, substitution.To)
	}
	normalized = strings.TrimSpace(normalized)

	return strings.Join([]string{
		"---",
		"name: " + EscapeYAMLString(name),
		"description: " + EscapeYAMLString(description),
		"---",
		"",
		"# " + name,
		"",
		"Use this skill when the user asks to run the " + name + " workflow.",
		"",
		"## Workflow",
		"",
		normalized,
	}, "\n")
}

// EscapeYAMLString renders a value as YAML frontmatter, quoting it when the
// plain form would be ambiguous.
func EscapeYAMLString(value string) string {
	if value != "" && value == strings.TrimSpace(value) && plainSafePattern.MatchString(value) && !reservedPattern.MatchString(value) {
		return value
	}
	return quoteJSON(value)
}

var plainSafePattern = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9 _./()'@-]*$`)

// reservedPattern lists the plain scalars a YAML reader would resolve to a
// boolean or a null instead of a string. The comparison ignores the case, as
// a YAML reader resolves the capitalised forms the same way.
var reservedPattern = regexp.MustCompile(`(?i)^(?:true|false|null|yes|no|on|off|~|-?\d+(?:\.\d+)?)$`)

// quoteJSON renders a string the way JSON.stringify does.
func quoteJSON(value string) string {
	var builder strings.Builder
	builder.WriteByte('"')
	for _, r := range value {
		switch r {
		case '"':
			builder.WriteString(`\"`)
		case '\\':
			builder.WriteString(`\\`)
		case '\n':
			builder.WriteString(`\n`)
		case '\r':
			builder.WriteString(`\r`)
		case '\t':
			builder.WriteString(`\t`)
		case '\b':
			builder.WriteString(`\b`)
		case '\f':
			builder.WriteString(`\f`)
		default:
			if r < 0x20 {
				builder.WriteString(fmt.Sprintf(`\u%04x`, r))
			} else {
				builder.WriteRune(r)
			}
		}
	}
	builder.WriteByte('"')
	return builder.String()
}

func escapeTOMLString(value string) string {
	replacer := strings.NewReplacer(
		`\`, `\\`,
		`"`, `\"`,
		"\n", `\n`,
		"\r", `\r`,
		"\t", `\t`,
	)
	return replacer.Replace(value)
}

func escapeTOMLMultilineBody(value string) string {
	return strings.ReplaceAll(value, `"""`, `\"\"\"`)
}

// VerifyBodyPreserved reports whether the body survives a derivation.
func verifyBodyPreserved(originalBody, transformedContent, profile string) bool {
	switch profile {
	case ProfileMarkdown:
		end := strings.Index(transformedContent[1:], "---\n")
		if end == -1 {
			return false
		}
		frontmatterEnd := end + 1
		bodyStart := strings.Index(transformedContent[frontmatterEnd+4:], "\n")
		if bodyStart == -1 {
			return false
		}
		extracted := transformedContent[frontmatterEnd+4+bodyStart+1:]
		return strings.TrimSpace(extracted) == strings.TrimSpace(originalBody)
	case ProfileToml:
		match := tomlBodyPattern.FindStringSubmatch(transformedContent)
		if match == nil {
			return false
		}
		return strings.TrimSpace(match[1]) == strings.TrimSpace(originalBody)
	case ProfileTomlCommand:
		match := tomlPromptPattern.FindStringSubmatch(transformedContent)
		if match == nil {
			return false
		}
		return strings.TrimSpace(match[1]) == strings.TrimSpace(originalBody)
	case ProfileCommandSkill:
		marker := "## Workflow\n\n"
		index := strings.Index(transformedContent, marker)
		if index == -1 {
			return false
		}
		extracted := transformedContent[index+len(marker):]
		return strings.TrimSpace(extracted) == strings.TrimSpace(originalBody)
	}
	return false
}

var tomlBodyPattern = regexp.MustCompile(`(?s)developer_instructions\s*=\s*"""\n(.*?)\n"""`)
var tomlPromptPattern = regexp.MustCompile(`(?s)prompt\s*=\s*"""\n(.*?)\n"""`)

func sortedKeys(values map[string]string) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	for i := 1; i < len(keys); i++ {
		for j := i; j > 0 && keys[j] < keys[j-1]; j-- {
			keys[j], keys[j-1] = keys[j-1], keys[j]
		}
	}
	return keys
}
