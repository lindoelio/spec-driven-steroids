package bundle

import (
	"fmt"
)

// The runtime reports a malformed JSON document in its own wording, and the
// CLI shows that wording when a remote manifest or bundle cannot be read.
// The scanner below reproduces the messages the runtime produces for the
// documents the contract can meet: a truncated document, a document with an
// unexpected token, a document with a structural error and a document with
// trailing content.

// nodeJSONError returns the message the runtime reports for a document it
// cannot parse.
func nodeJSONError(text string) string {
	scanner := &jsonScanner{source: text}
	scanner.skipSpace()
	if scanner.eof() {
		return "Unexpected end of JSON input"
	}
	if message := scanner.value(); message != "" {
		return message
	}
	scanner.skipSpace()
	if !scanner.eof() {
		return scanner.at("Unexpected non-whitespace character after JSON", scanner.offset)
	}
	return ""
}

// jsonScanner walks a JSON document.
type jsonScanner struct {
	source string
	offset int
}

// eof reports whether the scanner reached the end of the document.
func (s *jsonScanner) eof() bool { return s.offset >= len(s.source) }

// peek returns the current character.
func (s *jsonScanner) peek() byte {
	if s.eof() {
		return 0
	}
	return s.source[s.offset]
}

// skipSpace skips the whitespace the document may carry between tokens.
func (s *jsonScanner) skipSpace() {
	for !s.eof() {
		switch s.source[s.offset] {
		case ' ', '\t', '\n', '\r':
			s.offset++
		default:
			return
		}
	}
}

// at returns the message the runtime reports for a position in the document.
func (s *jsonScanner) at(message string, offset int) string {
	line := 1
	column := 1
	for index := 0; index < offset && index < len(s.source); index++ {
		if s.source[index] == '\n' {
			line++
			column = 1
			continue
		}
		column++
	}
	return fmt.Sprintf("%s in JSON at position %d (line %d column %d)", message, offset, line, column)
}

// unexpectedToken returns the message the runtime reports for an unexpected
// character.
func (s *jsonScanner) unexpectedToken(offset int) string {
	character := s.source[offset]
	snippet := s.source
	suffix := ""
	if len(snippet) > 20 {
		snippet = snippet[:10]
		suffix = "..."
	}
	return fmt.Sprintf("Unexpected token '%c', \"%s\"%s is not valid JSON", character, snippet, suffix)
}

// value reads one value and returns the message of the failure, if any.
func (s *jsonScanner) value() string {
	switch character := s.peek(); {
	case character == '{':
		return s.object()
	case character == '[':
		return s.array()
	case character == '"':
		return s.text()
	case character == '-' || (character >= '0' && character <= '9'):
		return s.number()
	case character == 't':
		return s.literal("true")
	case character == 'f':
		return s.literal("false")
	case character == 'n':
		return s.literal("null")
	case character >= 'a' && character <= 'z', character >= 'A' && character <= 'Z':
		return s.identifier()
	}
	return s.unexpectedToken(s.offset)
}

// object reads an object.
func (s *jsonScanner) object() string {
	s.offset++
	s.skipSpace()
	if s.eof() {
		return s.at("Expected property name or '}'", s.offset)
	}
	if s.peek() == '}' {
		s.offset++
		return ""
	}
	if s.peek() != '"' {
		return s.at("Expected property name or '}'", s.offset)
	}

	for {
		if message := s.text(); message != "" {
			return message
		}
		s.skipSpace()
		if s.eof() {
			return s.at("Expected ':' after property name", s.offset)
		}
		if s.peek() != ':' {
			return s.at("Expected ':' after property name", s.offset)
		}
		s.offset++

		s.skipSpace()
		if message := s.value(); message != "" {
			return message
		}

		s.skipSpace()
		if s.eof() {
			return s.at("Expected ',' or '}' after property value", s.offset)
		}
		switch s.peek() {
		case '}':
			s.offset++
			return ""
		case ',':
			s.offset++
			s.skipSpace()
			if s.eof() {
				return s.at("Expected double-quoted property name", s.offset)
			}
			if s.peek() != '"' {
				return s.at("Expected double-quoted property name", s.offset)
			}
		default:
			return s.at("Expected ',' or '}' after property value", s.offset)
		}
	}
}

// array reads an array.
func (s *jsonScanner) array() string {
	s.offset++
	s.skipSpace()
	if !s.eof() && s.peek() == ']' {
		s.offset++
		return ""
	}

	for {
		if message := s.value(); message != "" {
			return message
		}

		s.skipSpace()
		if s.eof() {
			return "Unexpected end of JSON input"
		}
		switch s.peek() {
		case ']':
			s.offset++
			return ""
		case ',':
			s.offset++
			s.skipSpace()
			if s.eof() {
				return "Unexpected end of JSON input"
			}
		default:
			return s.at("Expected ',' or ']' after array element", s.offset)
		}
	}
}

// text reads a string.
func (s *jsonScanner) text() string {
	s.offset++
	for !s.eof() {
		switch s.source[s.offset] {
		case '\\':
			s.offset++
			if s.eof() {
				return s.at("Unterminated string", s.offset)
			}
			s.offset++
		case '"':
			s.offset++
			return ""
		default:
			s.offset++
		}
	}
	return s.at("Unterminated string", s.offset)
}

// number reads a number.
func (s *jsonScanner) number() string {
	start := s.offset
	if s.peek() == '-' {
		s.offset++
		if s.eof() || s.peek() < '0' || s.peek() > '9' {
			return s.at("No number after minus sign", start)
		}
	}
	if s.peek() == '0' {
		s.offset++
		if !s.eof() && s.peek() >= '0' && s.peek() <= '9' {
			return s.at("Unexpected number", s.offset)
		}
	} else {
		for !s.eof() && s.peek() >= '0' && s.peek() <= '9' {
			s.offset++
		}
	}
	if !s.eof() && s.peek() == '.' {
		s.offset++
		digits := 0
		for !s.eof() && s.peek() >= '0' && s.peek() <= '9' {
			s.offset++
			digits++
		}
		if digits == 0 {
			return s.at("Unterminated fractional number", s.offset)
		}
	}
	if !s.eof() && (s.peek() == 'e' || s.peek() == 'E') {
		s.offset++
		if !s.eof() && (s.peek() == '+' || s.peek() == '-') {
			s.offset++
		}
		digits := 0
		for !s.eof() && s.peek() >= '0' && s.peek() <= '9' {
			s.offset++
			digits++
		}
		if digits == 0 {
			return s.at("Exponent part is missing a number", s.offset)
		}
	}
	return ""
}

// literal reads one of the JSON literals.
func (s *jsonScanner) literal(word string) string {
	for index := 0; index < len(word); index++ {
		if s.offset+index >= len(s.source) {
			return "Unexpected end of JSON input"
		}
		if s.source[s.offset+index] != word[index] {
			return s.unexpectedToken(s.offset + index)
		}
	}
	s.offset += len(word)
	return ""
}

// identifier reads a word that is not a JSON literal.
func (s *jsonScanner) identifier() string {
	start := s.offset
	for !s.eof() {
		character := s.source[s.offset]
		if (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') ||
			(character >= '0' && character <= '9') || character == '_' || character == '$' {
			s.offset++
			continue
		}
		break
	}
	word := s.source[start:s.offset]

	switch word {
	case "undefined", "NaN", "Infinity":
		return fmt.Sprintf("%q is not valid JSON", word)
	}

	return s.unexpectedToken(start)
}
