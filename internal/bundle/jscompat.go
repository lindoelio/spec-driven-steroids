package bundle

import (
	"fmt"
	"math"
	"path/filepath"
	"strconv"
	"strings"
)

// The helpers in this file reproduce JavaScript behaviour the contract
// depends on. The previous release implemented the contract in TypeScript,
// so a few observable details follow the runtime rather than the language:
// the URL parser normalises the manifest bundle URL, prerelease identifiers
// are compared with the runtime collation, a number is rendered the way the
// runtime renders it and a malformed document is reported in the runtime
// wording. Keeping those behaviours identical keeps the failure messages of
// the previous release.

// jsNumber converts a string to a number the way the runtime converts it.
func jsNumber(text string) float64 {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return 0
	}
	switch trimmed {
	case "Infinity", "+Infinity":
		return math.Inf(1)
	case "-Infinity":
		return math.Inf(-1)
	}
	if len(trimmed) > 2 && trimmed[0] == '0' {
		switch trimmed[1] {
		case 'x', 'X':
			value, err := strconv.ParseUint(trimmed[2:], 16, 64)
			if err != nil {
				return math.NaN()
			}
			return float64(value)
		case 'o', 'O':
			value, err := strconv.ParseUint(trimmed[2:], 8, 64)
			if err != nil {
				return math.NaN()
			}
			return float64(value)
		case 'b', 'B':
			value, err := strconv.ParseUint(trimmed[2:], 2, 64)
			if err != nil {
				return math.NaN()
			}
			return float64(value)
		}
	}
	value, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return math.NaN()
	}
	return value
}

// jsNumberToString renders a number the way the runtime renders it.
func jsNumberToString(value float64) string {
	switch {
	case math.IsNaN(value):
		return "NaN"
	case math.IsInf(value, 1):
		return "Infinity"
	case math.IsInf(value, -1):
		return "-Infinity"
	case value == 0:
		return "0"
	}

	absolute := math.Abs(value)
	if absolute < 1e21 && value == math.Trunc(value) {
		return strconv.FormatFloat(value, 'f', -1, 64)
	}

	formatted := strconv.FormatFloat(value, 'e', -1, 64)
	mantissa, exponent, found := strings.Cut(formatted, "e")
	if !found {
		return formatted
	}
	sign := "+"
	if strings.HasPrefix(exponent, "-") {
		sign = "-"
		exponent = exponent[1:]
	}
	exponent = strings.TrimLeft(exponent, "0")
	if exponent == "" {
		exponent = "0"
	}
	return fmt.Sprintf("%se%s%s", mantissa, sign, exponent)
}

// jsCollatingOrder is the order the runtime collation gives to the
// punctuation and the symbols it compares.
const jsCollatingOrder = "_-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$"

// localeCompare compares two strings the way the runtime collation compares
// them: punctuation and symbols come first, then digits, then letters, and
// a lowercase letter comes before the uppercase letter it matches.
func localeCompare(left, right string) int {
	if result := compareWeights(jsPrimaryWeights(left), jsPrimaryWeights(right)); result != 0 {
		return result
	}
	return compareWeights(jsCaseWeights(left), jsCaseWeights(right))
}

// jsPrimaryWeights returns the primary collation weights of a string.
func jsPrimaryWeights(text string) []int {
	weights := make([]int, 0, len(text))
	for _, character := range text {
		weights = append(weights, jsPrimaryWeight(character))
	}
	return weights
}

// jsPrimaryWeight returns the primary collation weight of a character.
func jsPrimaryWeight(character rune) int {
	switch {
	case character == ' ' || character == '\t' || character == '\n' || character == '\r':
		return 0
	case character >= '0' && character <= '9':
		return 100 + int(character-'0')
	case character >= 'a' && character <= 'z':
		return 200 + int(character-'a')
	case character >= 'A' && character <= 'Z':
		return 200 + int(character-'A')
	}
	if index := strings.IndexRune(jsCollatingOrder, character); index >= 0 {
		return 10 + index
	}
	return 1000 + int(character)
}

// jsCaseWeights returns the case collation weights of a string.
func jsCaseWeights(text string) []int {
	weights := make([]int, 0, len(text))
	for _, character := range text {
		if character >= 'A' && character <= 'Z' {
			weights = append(weights, 1)
			continue
		}
		weights = append(weights, 0)
	}
	return weights
}

// compareWeights compares two collation weight sequences. A sequence that is
// a prefix of the other sorts first.
func compareWeights(left, right []int) int {
	length := len(left)
	if len(right) < length {
		length = len(right)
	}
	for index := 0; index < length; index++ {
		if left[index] != right[index] {
			if left[index] < right[index] {
				return -1
			}
			return 1
		}
	}
	switch {
	case len(left) < len(right):
		return -1
	case len(left) > len(right):
		return 1
	}
	return 0
}

// templateURL is a parsed URL, normalised the way the runtime normalises it.
type templateURL struct {
	Scheme      string
	Host        string
	Port        string
	Path        string
	Query       string
	HasQuery    bool
	Fragment    string
	HasFragment bool
	UserInfo    string
}

// String renders the URL the way the runtime serialises it.
func (u templateURL) String() string {
	var builder strings.Builder
	builder.WriteString(u.Scheme)
	builder.WriteString(":")
	if u.Host != "" || u.UserInfo != "" {
		builder.WriteString("//")
		if u.UserInfo != "" {
			builder.WriteString(u.UserInfo)
			builder.WriteString("@")
		}
		builder.WriteString(u.Host)
		if u.Port != "" {
			builder.WriteString(":")
			builder.WriteString(u.Port)
		}
	}
	builder.WriteString(u.Path)
	if u.HasQuery {
		builder.WriteString("?")
		builder.WriteString(u.Query)
	}
	if u.HasFragment {
		builder.WriteString("#")
		builder.WriteString(u.Fragment)
	}
	return builder.String()
}

// parseTemplateURL parses and normalises a URL the way the runtime parses
// it. It reports false when the runtime would reject the URL.
func parseTemplateURL(raw string) (templateURL, bool) {
	trimmed := strings.Trim(raw, "\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\v\f\r\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f ")
	trimmed = strings.Map(func(character rune) rune {
		if character == '\t' || character == '\n' || character == '\r' {
			return -1
		}
		return character
	}, trimmed)

	colon := strings.Index(trimmed, ":")
	if colon <= 0 {
		return templateURL{}, false
	}
	scheme := trimmed[:colon]
	if !isURLScheme(scheme) {
		return templateURL{}, false
	}
	scheme = strings.ToLower(scheme)
	rest := trimmed[colon+1:]

	special := scheme == "http" || scheme == "https" || scheme == "ws" || scheme == "wss" || scheme == "ftp" || scheme == "file"

	authority := ""
	if strings.HasPrefix(rest, "//") {
		rest = rest[2:]
		end := len(rest)
		for index, character := range rest {
			if character == '/' || character == '?' || character == '#' {
				end = index
				break
			}
		}
		authority = rest[:end]
		rest = rest[end:]
	} else if special {
		return templateURL{}, false
	}

	parsed := templateURL{Scheme: scheme}

	if authority != "" || special {
		userInfo := ""
		hostPart := authority
		if at := strings.LastIndex(authority, "@"); at >= 0 {
			userInfo = authority[:at]
			hostPart = authority[at+1:]
		}
		host := hostPart
		port := ""
		if strings.HasPrefix(hostPart, "[") {
			if end := strings.Index(hostPart, "]"); end >= 0 {
				host = hostPart[:end+1]
				if remainder := hostPart[end+1:]; strings.HasPrefix(remainder, ":") {
					port = remainder[1:]
				}
			}
		} else if colon := strings.LastIndex(hostPart, ":"); colon >= 0 {
			host = hostPart[:colon]
			port = hostPart[colon+1:]
		}
		if port != "" {
			for _, character := range port {
				if character < '0' || character > '9' {
					return templateURL{}, false
				}
			}
			if port == defaultPort(scheme) {
				port = ""
			}
		}
		if special && scheme != "file" && host == "" {
			return templateURL{}, false
		}
		if strings.ContainsAny(host, " \t\n\r") {
			return templateURL{}, false
		}
		parsed.UserInfo = userInfo
		parsed.Host = strings.ToLower(host)
		parsed.Port = port
	}

	if index := strings.Index(rest, "#"); index >= 0 {
		parsed.Fragment = rest[index+1:]
		parsed.HasFragment = true
		rest = rest[:index]
	}
	if index := strings.Index(rest, "?"); index >= 0 {
		parsed.Query = rest[index+1:]
		parsed.HasQuery = true
		rest = rest[:index]
	}
	parsed.Path = normalizeURLPath(rest, special)

	return parsed, true
}

// isURLScheme reports whether a scheme is well formed.
func isURLScheme(scheme string) bool {
	if scheme == "" {
		return false
	}
	for index, character := range scheme {
		switch {
		case character >= 'a' && character <= 'z', character >= 'A' && character <= 'Z':
		case index > 0 && (character >= '0' && character <= '9' || character == '+' || character == '-' || character == '.'):
		default:
			return false
		}
	}
	return true
}

// defaultPort returns the port the runtime drops from a URL.
func defaultPort(scheme string) string {
	switch scheme {
	case "http", "ws":
		return "80"
	case "https", "wss":
		return "443"
	case "ftp":
		return "21"
	}
	return ""
}

// normalizeURLPath removes the dot segments of a URL path.
func normalizeURLPath(path string, special bool) string {
	if path == "" {
		if special {
			return "/"
		}
		return ""
	}
	if !strings.HasPrefix(path, "/") {
		return path
	}
	segments := strings.Split(path, "/")
	resolved := make([]string, 0, len(segments))
	for _, segment := range segments {
		switch segment {
		case "", ".":
			continue
		case "..":
			if len(resolved) > 0 {
				resolved = resolved[:len(resolved)-1]
			}
		default:
			resolved = append(resolved, segment)
		}
	}
	normalized := "/" + strings.Join(resolved, "/")
	if strings.HasSuffix(path, "/") && !strings.HasSuffix(normalized, "/") {
		normalized += "/"
	}
	return normalized
}

// absolutePath resolves a path against the working directory.
func absolutePath(path string) (string, error) {
	if path == "" {
		path = "."
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return filepath.Clean(absolute), nil
}

// resolvePath resolves a path against a root, the way the runtime resolves a
// path: an absolute path ignores the root.
func resolvePath(root, relative string) string {
	if filepath.IsAbs(relative) {
		return filepath.Clean(relative)
	}
	return filepath.Clean(filepath.Join(root, relative))
}

// relativePath returns the path of a candidate relative to a root.
func relativePath(root, candidate string) (string, error) {
	return filepath.Rel(root, candidate)
}

// filepathIsAbs reports whether a path is absolute.
func filepathIsAbs(path string) bool {
	return filepath.IsAbs(path)
}
