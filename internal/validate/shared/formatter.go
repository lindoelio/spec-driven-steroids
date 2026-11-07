// Package shared holds the parsing and formatting primitives shared by the
// spec validators. It mirrors packages/cli/src/core/validate/shared of the
// TypeScript implementation that this package ports.
package shared

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Field is a single key/value pair of a JSON object. The slice order is the
// order in which the keys are emitted.
type Field struct {
	Key   string
	Value any
}

// Object is a JSON object that preserves the insertion order of its keys, the
// way a JavaScript object literal does. JSON.stringify emits the keys of a
// JavaScript object in insertion order, so the order is part of the contract.
type Object struct {
	keys   []string
	values map[string]any
}

// NewObject returns an empty ordered object.
func NewObject() *Object {
	return &Object{values: map[string]any{}}
}

// Set stores a value and appends the key when it is not present yet.
func (o *Object) Set(key string, value any) *Object {
	if o.values == nil {
		o.values = map[string]any{}
	}
	if _, ok := o.values[key]; !ok {
		o.keys = append(o.keys, key)
	}
	o.values[key] = value
	return o
}

// Get returns the value stored for a key.
func (o *Object) Get(key string) (any, bool) {
	value, ok := o.values[key]
	return value, ok
}

// Keys returns the keys in insertion order.
func (o *Object) Keys() []string {
	return append([]string(nil), o.keys...)
}

// Len returns the number of keys.
func (o *Object) Len() int {
	return len(o.keys)
}

// Issue is a single validation error or warning. It carries both the flat
// fields used by the Go API and the ordered key/value pairs that reproduce
// the JSON payload of the TypeScript implementation byte for byte.
type Issue struct {
	// Severity is "error" or "warning".
	Severity string
	// File is the source path the issue refers to.
	File string
	// Line is the 1-based line number, 0 when the issue carries no line.
	Line int
	// Message is the diagnostic text without any prefix.
	Message string

	// ErrorType, Context, SuggestedFix and SkillDocLink mirror the additional
	// machine-readable fields of the oracle payload.
	ErrorType    string
	Context      string
	SuggestedFix string
	SkillDocLink string

	fields []Field
}

// NewIssue starts an issue of the given severity.
func NewIssue(severity string) *Issue {
	return &Issue{Severity: severity}
}

// Set records a field. The call order is the JSON key order, and it mirrors
// the object literals of the TypeScript implementation. A line of 0 is
// dropped, because JSON.stringify omits undefined values.
func (i *Issue) Set(key string, value any) *Issue {
	switch key {
	case "errorType":
		i.ErrorType = asString(value)
	case "context":
		i.Context = asString(value)
	case "message":
		i.Message = asString(value)
	case "suggestedFix":
		i.SuggestedFix = asString(value)
	case "skillDocLink":
		i.SkillDocLink = asString(value)
	case "line":
		line, ok := value.(int)
		if !ok || line <= 0 {
			return i
		}
		i.Line = line
	}
	i.fields = append(i.fields, Field{Key: key, Value: value})
	return i
}

// WithContext returns a copy of the issue with a replaced context. The key
// order of the issue is preserved.
func (i Issue) WithContext(context string) Issue {
	updated := i
	updated.Context = context
	found := false
	for index := range updated.fields {
		if updated.fields[index].Key == "context" {
			updated.fields[index].Value = context
			found = true
			break
		}
	}
	if !found {
		updated.fields = append(updated.fields, Field{Key: "context", Value: context})
	}
	return updated
}

// WithMessage returns a copy of the issue with a replaced message. The key
// order of the issue is preserved.
func (i Issue) WithMessage(message string) Issue {
	updated := i
	updated.Message = message
	found := false
	for index := range updated.fields {
		if updated.fields[index].Key == "message" {
			updated.fields[index].Value = message
			found = true
			break
		}
	}
	if !found {
		updated.fields = append(updated.fields, Field{Key: "message", Value: message})
	}
	return updated
}

// SetRawLine records a line number exactly as the oracle records it, keeping
// the negative value of a heading that was not found.
func (i *Issue) SetRawLine(line int) *Issue {
	i.fields = append(i.fields, Field{Key: "line", Value: line})
	return i
}

// Fields returns the ordered JSON fields of the issue.
func (i Issue) Fields() []Field {
	return append([]Field(nil), i.fields...)
}

// MarshalJSON renders the issue with its ordered keys.
func (i Issue) MarshalJSON() ([]byte, error) {
	object := NewObject()
	for _, field := range i.fields {
		object.Set(field.Key, field.Value)
	}
	return []byte(MarshalJSON(object)), nil
}

func asString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", typed)
	}
}

// FormatError renders an issue the way the oracle renders a validation error:
// "[Type] → context → suggested fix", followed by the skill documentation
// link on its own line.
func FormatError(issue *Issue) string {
	body := issue.Context
	if body == "" {
		body = issue.Message
	}
	formatted := "[" + issue.ErrorType + "] → " + body + " → " + issue.SuggestedFix
	if issue.SkillDocLink != "" {
		formatted += "\n   See: " + issue.SkillDocLink
	}
	return formatted
}

// FormatText renders the generic text summary of a result. The per-command
// renderers of the oracle are more specific; this helper mirrors the generic
// formatter of shared/formatter.ts.
func FormatText(valid bool, errors, warnings []*Issue) string {
	lines := make([]string, 0, 8)

	if valid && len(errors) == 0 && len(warnings) == 0 {
		return "✅ Validation passed."
	}

	if valid {
		lines = append(lines, "⚠️ Validation passed with warnings.")
	} else {
		lines = append(lines, "❌ Validation failed.")
	}

	if len(errors) > 0 {
		lines = append(lines, "", "Errors:")
		for _, issue := range errors {
			parts := make([]string, 0, 3)
			if issue.Line > 0 {
				parts = append(parts, fmt.Sprintf("Line %d", issue.Line))
			}
			parts = append(parts, "["+issue.ErrorType+"]")
			body := issue.Context
			if body == "" {
				body = issue.Message
			}
			if body == "" {
				body = "Unknown error"
			}
			parts = append(parts, body)
			lines = append(lines, "  • "+strings.Join(parts, " - "))
			if issue.SuggestedFix != "" {
				lines = append(lines, "    → "+issue.SuggestedFix)
			}
		}
	}

	if len(warnings) > 0 {
		lines = append(lines, "", "Warnings:")
		for _, warning := range warnings {
			parts := make([]string, 0, 2)
			if warning.Line > 0 {
				parts = append(parts, fmt.Sprintf("Line %d", warning.Line))
			}
			parts = append(parts, warning.Message)
			lines = append(lines, "  • "+strings.Join(parts, " - "))
		}
	}

	return strings.Join(lines, "\n")
}

// MarshalJSON renders a value the way JSON.stringify(value, null, 2) does.
func MarshalJSON(value any) string {
	var builder strings.Builder
	writeJSON(&builder, value, "")
	return builder.String()
}

func writeJSON(builder *strings.Builder, value any, indent string) {
	switch typed := value.(type) {
	case nil:
		builder.WriteString("null")
	case bool:
		if typed {
			builder.WriteString("true")
		} else {
			builder.WriteString("false")
		}
	case string:
		builder.WriteString(quoteJSON(typed))
	case int:
		builder.WriteString(strconv.Itoa(typed))
	case int64:
		builder.WriteString(strconv.FormatInt(typed, 10))
	case float64:
		builder.WriteString(formatNumber(typed))
	case []string:
		items := make([]any, 0, len(typed))
		for _, item := range typed {
			items = append(items, item)
		}
		writeJSONArray(builder, items, indent)
	case []any:
		writeJSONArray(builder, typed, indent)
	case []Field:
		writeJSONFields(builder, typed, indent)
	case []Issue:
		items := make([]any, 0, len(typed))
		for index := range typed {
			items = append(items, typed[index])
		}
		writeJSONArray(builder, items, indent)
	case []*Issue:
		items := make([]any, 0, len(typed))
		for _, item := range typed {
			items = append(items, item)
		}
		writeJSONArray(builder, items, indent)
	case []*Object:
		items := make([]any, 0, len(typed))
		for _, item := range typed {
			items = append(items, item)
		}
		writeJSONArray(builder, items, indent)
	case *Object:
		writeJSONObject(builder, typed, indent)
	case Object:
		writeJSONObject(builder, &typed, indent)
	case Issue:
		writeJSONObject(builder, typed.object(), indent)
	case *Issue:
		if typed == nil {
			builder.WriteString("null")
			return
		}
		writeJSONObject(builder, typed.object(), indent)
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		fields := make([]Field, 0, len(keys))
		for _, key := range keys {
			fields = append(fields, Field{Key: key, Value: typed[key]})
		}
		writeJSONFields(builder, fields, indent)
	default:
		builder.WriteString("null")
	}
}

// object returns the ordered object of the issue.
func (i Issue) object() *Object {
	object := NewObject()
	for _, field := range i.fields {
		object.Set(field.Key, field.Value)
	}
	return object
}

func writeJSONObject(builder *strings.Builder, object *Object, indent string) {
	if object == nil || object.Len() == 0 {
		builder.WriteString("{}")
		return
	}
	inner := indent + "  "
	builder.WriteString("{\n")
	for index, key := range object.keys {
		if index > 0 {
			builder.WriteString(",\n")
		}
		builder.WriteString(inner)
		builder.WriteString(quoteJSON(key))
		builder.WriteString(": ")
		writeJSON(builder, object.values[key], inner)
	}
	builder.WriteString("\n")
	builder.WriteString(indent)
	builder.WriteString("}")
}

func writeJSONFields(builder *strings.Builder, fields []Field, indent string) {
	if len(fields) == 0 {
		builder.WriteString("{}")
		return
	}
	inner := indent + "  "
	builder.WriteString("{\n")
	for index, field := range fields {
		if index > 0 {
			builder.WriteString(",\n")
		}
		builder.WriteString(inner)
		builder.WriteString(quoteJSON(field.Key))
		builder.WriteString(": ")
		writeJSON(builder, field.Value, inner)
	}
	builder.WriteString("\n")
	builder.WriteString(indent)
	builder.WriteString("}")
}

func writeJSONArray(builder *strings.Builder, items []any, indent string) {
	if len(items) == 0 {
		builder.WriteString("[]")
		return
	}
	inner := indent + "  "
	builder.WriteString("[\n")
	for index, item := range items {
		if index > 0 {
			builder.WriteString(",\n")
		}
		builder.WriteString(inner)
		writeJSON(builder, item, inner)
	}
	builder.WriteString("\n")
	builder.WriteString(indent)
	builder.WriteString("]")
}

func formatNumber(value float64) string {
	if value == float64(int64(value)) {
		return strconv.FormatInt(int64(value), 10)
	}
	return strconv.FormatFloat(value, 'g', -1, 64)
}

// quoteJSON escapes a string the way JSON.stringify does: only the quote, the
// backslash and the control characters are escaped, every other code point is
// emitted literally.
func quoteJSON(value string) string {
	var builder strings.Builder
	builder.WriteByte('"')
	for _, r := range value {
		switch r {
		case '"':
			builder.WriteString(`\"`)
		case '\\':
			builder.WriteString(`\\`)
		case '\b':
			builder.WriteString(`\b`)
		case '\f':
			builder.WriteString(`\f`)
		case '\n':
			builder.WriteString(`\n`)
		case '\r':
			builder.WriteString(`\r`)
		case '\t':
			builder.WriteString(`\t`)
		default:
			if r < 0x20 {
				builder.WriteString(fmt.Sprintf(`\u%04x`, r))
				continue
			}
			builder.WriteRune(r)
		}
	}
	builder.WriteByte('"')
	return builder.String()
}
