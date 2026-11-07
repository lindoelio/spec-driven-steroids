package stewardship

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"
)

// The rule graph is written with the exact byte layout produced by the
// TypeScript implementation (JSON.stringify(value, null, 2)), so the helpers
// below reproduce the JavaScript serialisation rules rather than relying on
// the Go standard library defaults.

// jsonObject is an insertion-ordered JSON object.
type jsonObject struct {
	keys []string
	vals map[string]any
}

func newJSONObject() *jsonObject {
	return &jsonObject{vals: map[string]any{}}
}

func (o *jsonObject) set(key string, value any) {
	if _, ok := o.vals[key]; !ok {
		o.keys = append(o.keys, key)
	}
	o.vals[key] = value
}

func (o *jsonObject) get(key string) (any, bool) {
	v, ok := o.vals[key]
	return v, ok
}

func (o *jsonObject) has(key string) bool {
	_, ok := o.vals[key]
	return ok
}

func (o *jsonObject) keysInOrder() []string {
	return o.keys
}

// marshalJSON renders a value the way JSON.stringify(value, null, 2) does.
func marshalJSON(value any) []byte {
	var buf bytes.Buffer
	writeJSONValue(&buf, value, "")
	return buf.Bytes()
}

func writeJSONValue(buf *bytes.Buffer, value any, indent string) {
	switch v := value.(type) {
	case nil:
		buf.WriteString("null")
	case bool:
		if v {
			buf.WriteString("true")
		} else {
			buf.WriteString("false")
		}
	case string:
		buf.WriteString(quoteJSString(v))
	case json.Number:
		buf.WriteString(v.String())
	case int:
		buf.WriteString(strconv.Itoa(v))
	case int64:
		buf.WriteString(strconv.FormatInt(v, 10))
	case float64:
		buf.WriteString(jsNumberString(v))
	case *jsonObject:
		writeJSONObject(buf, v, indent)
	case jsonObject:
		writeJSONObject(buf, &v, indent)
	case []string:
		items := make([]any, len(v))
		for i := range v {
			items[i] = v[i]
		}
		writeJSONArray(buf, items, indent)
	case []any:
		items := make([]any, len(v))
		for i := range v {
			items[i] = v[i]
		}
		writeJSONArray(buf, items, indent)
	case []RuleVersion:
		items := make([]any, len(v))
		for i := range v {
			items[i] = &v[i]
		}
		writeJSONArray(buf, items, indent)
	case *RuleVersion:
		writeJSONObject(buf, ruleVersionObject(v), indent)
	case RuleVersion:
		writeJSONObject(buf, ruleVersionObject(&v), indent)
	case *Provenance:
		writeJSONObject(buf, provenanceObject(v), indent)
	case Provenance:
		writeJSONObject(buf, provenanceObject(&v), indent)
	case *Metadata:
		writeJSONObject(buf, metadataObject(v), indent)
	case Metadata:
		writeJSONObject(buf, metadataObject(&v), indent)
	case *LifecycleState:
		writeJSONObject(buf, lifecycleStateObject(v), indent)
	case LifecycleState:
		writeJSONObject(buf, lifecycleStateObject(&v), indent)
	case *RuleNode:
		writeJSONObject(buf, ruleObject(v), indent)
	case RuleNode:
		writeJSONObject(buf, ruleObject(&v), indent)
	default:
		// Fall back to the standard library for values that never occur in the
		// rule graph; the encoder disables HTML escaping so the output stays
		// close to the JavaScript form.
		var fallback bytes.Buffer
		encoder := json.NewEncoder(&fallback)
		encoder.SetEscapeHTML(false)
		if err := encoder.Encode(value); err != nil {
			buf.WriteString("null")
			return
		}
		buf.Write(bytes.TrimRight(fallback.Bytes(), "\n"))
	}
}

func writeJSONObject(buf *bytes.Buffer, obj *jsonObject, indent string) {
	if len(obj.keys) == 0 {
		buf.WriteString("{}")
		return
	}
	inner := indent + "  "
	buf.WriteString("{")
	for i, key := range obj.keys {
		if i > 0 {
			buf.WriteString(",")
		}
		buf.WriteString("\n")
		buf.WriteString(inner)
		buf.WriteString(quoteJSString(key))
		buf.WriteString(": ")
		writeJSONValue(buf, obj.vals[key], inner)
	}
	buf.WriteString("\n")
	buf.WriteString(indent)
	buf.WriteString("}")
}

func writeJSONArray(buf *bytes.Buffer, items []any, indent string) {
	if len(items) == 0 {
		buf.WriteString("[]")
		return
	}
	inner := indent + "  "
	buf.WriteString("[")
	for i, item := range items {
		if i > 0 {
			buf.WriteString(",")
		}
		buf.WriteString("\n")
		buf.WriteString(inner)
		writeJSONValue(buf, item, inner)
	}
	buf.WriteString("\n")
	buf.WriteString(indent)
	buf.WriteString("]")
}

func provenanceObject(p *Provenance) *jsonObject {
	obj := newJSONObject()
	obj.set("source", p.Source)
	if p.SourceFile != nil {
		obj.set("sourceFile", *p.SourceFile)
	}
	obj.set("decisionDate", p.DecisionDate)
	obj.set("author", p.Author)
	obj.set("originalText", p.OriginalText)
	return obj
}

func metadataObject(m *Metadata) *jsonObject {
	obj := newJSONObject()
	obj.set("confidence", m.Confidence)
	obj.set("expiresAt", m.ExpiresAt)
	tags := m.Tags
	if tags == nil {
		tags = []string{}
	}
	obj.set("tags", tags)
	return obj
}

func lifecycleStateObject(s *LifecycleState) *jsonObject {
	obj := newJSONObject()
	obj.set("value", string(s.Value))
	obj.set("changedAt", s.ChangedAt)
	obj.set("changedBy", s.ChangedBy)
	return obj
}

func ruleVersionObject(v *RuleVersion) *jsonObject {
	obj := newJSONObject()
	obj.set("ruleId", v.RuleID)
	obj.set("version", v.Version)
	obj.set("timestamp", v.Timestamp)
	obj.set("changedBy", v.ChangedBy)
	obj.set("previousState", lifecycleStateObject(&v.PreviousState))
	if v.Diff != nil {
		obj.set("diff", *v.Diff)
	}
	return obj
}

// defaultRuleKeyOrder is the key order of a freshly created rule.
var defaultRuleKeyOrder = []string{
	"id",
	"domain",
	"subDomain",
	"content",
	"provenance",
	"metadata",
	"state",
	"projectScope",
	"relations",
}

// ruleObject renders a rule preserving its JSON key order.
func ruleObject(r *RuleNode) *jsonObject {
	values := map[string]any{
		"id":         r.ID,
		"domain":     r.Domain,
		"content":    r.Content,
		"provenance": provenanceObject(&r.Provenance),
		"metadata":   metadataObject(&r.Metadata),
		"state":      lifecycleStateObject(&r.State),
	}
	if r.SubDomain != nil {
		values["subDomain"] = *r.SubDomain
	}
	if r.SupersededBy != nil {
		values["supersededBy"] = *r.SupersededBy
	}
	if r.ProjectScope != nil {
		values["projectScope"] = *r.ProjectScope
	}
	if _, ok := r.omitted["relations"]; !ok {
		relations := r.Relations
		if relations == nil {
			relations = []string{}
		}
		values["relations"] = relations
	}

	order := r.keyOrder
	if len(order) == 0 {
		order = defaultRuleKeyOrder
	}

	obj := newJSONObject()
	seen := map[string]bool{}
	for _, key := range order {
		seen[key] = true
		value, ok := values[key]
		if !ok && r.extras != nil {
			value, ok = r.extras.get(key)
		}
		if !ok {
			continue
		}
		obj.set(key, value)
	}
	if r.extras != nil {
		for _, key := range r.extras.keysInOrder() {
			if seen[key] {
				continue
			}
			value, _ := r.extras.get(key)
			obj.set(key, value)
		}
	}
	return obj
}

// quoteJSString escapes a string the way JSON.stringify does.
func quoteJSString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if r < 0x20 {
				b.WriteString(fmt.Sprintf(`\u%04x`, r))
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

// jsNumberString renders a float the way JavaScript's Number#toString does.
func jsNumberString(f float64) string {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return "null"
	}
	if f == 0 {
		return "0"
	}
	negative := math.Signbit(f)
	if negative {
		f = -f
	}

	// Shortest round-trip digits and decimal exponent.
	scientific := strconv.FormatFloat(f, 'e', -1, 64)
	mantissa, exponentText, _ := strings.Cut(scientific, "e")
	exponent, err := strconv.Atoi(exponentText)
	if err != nil {
		return scientific
	}
	digits := strings.Replace(mantissa, ".", "", 1)
	digits = strings.TrimRight(digits, "0")
	if digits == "" {
		digits = "0"
	}
	k := len(digits)
	n := exponent + 1

	var out string
	switch {
	case k <= n && n <= 21:
		out = digits + strings.Repeat("0", n-k)
	case 0 < n && n <= 21:
		out = digits[:n] + "." + digits[n:]
	case -6 < n && n <= 0:
		out = "0." + strings.Repeat("0", -n) + digits
	default:
		exp := n - 1
		sign := "+"
		if exp < 0 {
			sign = "-"
			exp = -exp
		}
		if k == 1 {
			out = digits + "e" + sign + strconv.Itoa(exp)
		} else {
			out = digits[:1] + "." + digits[1:] + "e" + sign + strconv.Itoa(exp)
		}
	}
	if negative {
		out = "-" + out
	}
	return out
}

// jsToFixed renders a float with a fixed number of decimals the way
// JavaScript's Number#toFixed does, including its half-away-from-zero rule.
func jsToFixed(f float64, digits int) string {
	if math.IsNaN(f) {
		return "NaN"
	}
	if math.IsInf(f, 1) {
		return "Infinity"
	}
	if math.IsInf(f, -1) {
		return "-Infinity"
	}
	if math.Abs(f) >= 1e21 {
		return jsNumberString(f)
	}
	sign := ""
	x := f
	if x < 0 {
		sign = "-"
		x = -x
	}
	exact := new(big.Rat).SetFloat64(x)
	return sign + exact.FloatString(digits)
}

// decodeJSONDocument parses JSON while keeping object key order.
func decodeJSONDocument(data []byte) (any, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	value, err := decodeJSONValue(decoder)
	if err != nil {
		return nil, err
	}
	return value, nil
}

func decodeJSONValue(decoder *json.Decoder) (any, error) {
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	return decodeJSONFromToken(decoder, token)
}

func decodeJSONFromToken(decoder *json.Decoder, token json.Token) (any, error) {
	switch t := token.(type) {
	case json.Delim:
		switch t {
		case '{':
			obj := newJSONObject()
			for {
				next, err := decoder.Token()
				if err != nil {
					return nil, err
				}
				if delim, ok := next.(json.Delim); ok && delim == '}' {
					return obj, nil
				}
				key, ok := next.(string)
				if !ok {
					return nil, fmt.Errorf("unexpected object key %v", next)
				}
				value, err := decodeJSONValue(decoder)
				if err != nil {
					return nil, err
				}
				obj.set(key, value)
			}
		case '[':
			items := []any{}
			for {
				next, err := decoder.Token()
				if err != nil {
					return nil, err
				}
				if delim, ok := next.(json.Delim); ok && delim == ']' {
					return items, nil
				}
				value, err := decodeJSONFromToken(decoder, next)
				if err != nil {
					return nil, err
				}
				items = append(items, value)
			}
		default:
			return nil, fmt.Errorf("unexpected delimiter %v", t)
		}
	default:
		return token, nil
	}
}

// ruleFromJSON reads a stored rule, keeping the key order of the document.
func ruleFromJSON(content []byte) (*RuleNode, error) {
	document, err := decodeJSONDocument(content)
	if err != nil {
		return nil, err
	}
	object, ok := document.(*jsonObject)
	if !ok {
		return nil, fmt.Errorf("rule document is not an object")
	}

	rule := &RuleNode{Relations: []string{}, omitted: map[string]bool{}}
	rule.keyOrder = object.keysInOrder()
	extras := newJSONObject()

	for _, key := range object.keysInOrder() {
		value, _ := object.get(key)
		switch key {
		case "id":
			rule.ID = jsonString(value)
		case "domain":
			rule.Domain = jsonString(value)
		case "subDomain":
			text := jsonString(value)
			rule.SubDomain = &text
		case "content":
			rule.Content = jsonString(value)
		case "provenance":
			rule.Provenance = provenanceFromValue(value)
		case "metadata":
			rule.Metadata = metadataFromValue(value)
		case "state":
			rule.State = lifecycleStateFromValue(value)
		case "supersededBy":
			text := jsonString(value)
			rule.SupersededBy = &text
		case "projectScope":
			text := jsonString(value)
			rule.ProjectScope = &text
		case "relations":
			rule.Relations = jsonStringSlice(value)
		default:
			extras.set(key, value)
		}
	}
	if !object.has("relations") {
		rule.omitted["relations"] = true
	}
	if len(extras.keysInOrder()) > 0 {
		rule.extras = extras
	}
	return rule, nil
}

// versionsFromJSON reads a stored version history.
func versionsFromJSON(content []byte) ([]RuleVersion, error) {
	document, err := decodeJSONDocument(content)
	if err != nil {
		return nil, err
	}
	items, ok := document.([]any)
	if !ok {
		return nil, fmt.Errorf("version document is not an array")
	}
	versions := make([]RuleVersion, 0, len(items))
	for _, item := range items {
		object, ok := item.(*jsonObject)
		if !ok {
			continue
		}
		version := RuleVersion{}
		if value, ok := object.get("ruleId"); ok {
			version.RuleID = jsonString(value)
		}
		if value, ok := object.get("version"); ok {
			version.Version = jsonInt(value)
		}
		if value, ok := object.get("timestamp"); ok {
			version.Timestamp = jsonString(value)
		}
		if value, ok := object.get("changedBy"); ok {
			version.ChangedBy = jsonString(value)
		}
		if value, ok := object.get("previousState"); ok {
			version.PreviousState = lifecycleStateFromValue(value)
		}
		if value, ok := object.get("diff"); ok {
			text := jsonString(value)
			version.Diff = &text
		}
		versions = append(versions, version)
	}
	return versions, nil
}

func jsonString(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case json.Number:
		return v.String()
	case bool:
		if v {
			return "true"
		}
		return "false"
	default:
		return ""
	}
}

func jsonInt(value any) int {
	switch v := value.(type) {
	case json.Number:
		number, err := v.Int64()
		if err != nil {
			return 0
		}
		return int(number)
	case float64:
		return int(v)
	default:
		return 0
	}
}

func jsonStringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return []string{}
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		result = append(result, jsonString(item))
	}
	return result
}

func provenanceFromValue(value any) Provenance {
	provenance := Provenance{}
	object, ok := value.(*jsonObject)
	if !ok {
		return provenance
	}
	if entry, ok := object.get("source"); ok {
		provenance.Source = jsonString(entry)
	}
	if entry, ok := object.get("sourceFile"); ok {
		text := jsonString(entry)
		provenance.SourceFile = &text
	}
	if entry, ok := object.get("decisionDate"); ok {
		provenance.DecisionDate = jsonString(entry)
	}
	if entry, ok := object.get("author"); ok {
		provenance.Author = jsonString(entry)
	}
	if entry, ok := object.get("originalText"); ok {
		provenance.OriginalText = jsonString(entry)
	}
	return provenance
}

func metadataFromValue(value any) Metadata {
	metadata := Metadata{Tags: []string{}}
	object, ok := value.(*jsonObject)
	if !ok {
		return metadata
	}
	if entry, ok := object.get("confidence"); ok {
		metadata.Confidence = jsonFloat(entry)
	}
	if entry, ok := object.get("expiresAt"); ok {
		metadata.ExpiresAt = jsonString(entry)
	}
	if entry, ok := object.get("tags"); ok {
		metadata.Tags = jsonStringSlice(entry)
	}
	return metadata
}

func lifecycleStateFromValue(value any) LifecycleState {
	state := LifecycleState{}
	object, ok := value.(*jsonObject)
	if !ok {
		return state
	}
	if entry, ok := object.get("value"); ok {
		state.Value = LifecycleValue(jsonString(entry))
	}
	if entry, ok := object.get("changedAt"); ok {
		state.ChangedAt = jsonString(entry)
	}
	if entry, ok := object.get("changedBy"); ok {
		state.ChangedBy = jsonString(entry)
	}
	return state
}

func jsonFloat(value any) float64 {
	switch v := value.(type) {
	case json.Number:
		number, err := v.Float64()
		if err != nil {
			return 0
		}
		return number
	case float64:
		return v
	default:
		return 0
	}
}
