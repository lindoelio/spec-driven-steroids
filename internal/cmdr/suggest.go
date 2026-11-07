package cmdr

import (
	"fmt"
	"sort"
	"strings"
)

// maxSuggestionDistance is the largest edit distance a suggestion may have.
const maxSuggestionDistance = 3

// minSuggestionSimilarity is the smallest similarity a candidate may have to
// be suggested.
const minSuggestionSimilarity = 0.4

// suggestSimilar returns the suggestion commander appends to the message of
// an unknown command or an unknown option.
//
// A candidate qualifies when it is close enough to what was typed, and the
// closest candidate wins. The suggestion names one candidate, or the list of
// the equally close ones.
func suggestSimilar(word string, candidates []string) string {
	if len(candidates) == 0 {
		return ""
	}

	unique := []string{}
	seen := map[string]bool{}
	for _, candidate := range candidates {
		if candidate == "" || seen[candidate] {
			continue
		}
		seen[candidate] = true
		unique = append(unique, candidate)
	}

	searchingOptions := strings.HasPrefix(word, "--")
	needle := word
	if searchingOptions {
		needle = strings.TrimPrefix(word, "--")
		unique = trimPrefixes(unique, "--")
	}

	similar := []string{}
	bestDistance := maxSuggestionDistance
	for _, candidate := range unique {
		if len(candidate) <= 1 {
			continue
		}
		distance := editDistance(needle, candidate)
		length := max(len(needle), len(candidate))
		if length == 0 {
			continue
		}
		similarity := float64(length-distance) / float64(length)
		if similarity <= minSuggestionSimilarity {
			continue
		}
		switch {
		case distance < bestDistance:
			bestDistance = distance
			similar = []string{candidate}
		case distance == bestDistance:
			similar = append(similar, candidate)
		}
	}

	if len(similar) == 0 {
		return ""
	}
	sort.Strings(similar)
	if searchingOptions {
		for index, candidate := range similar {
			similar[index] = "--" + candidate
		}
	}

	if len(similar) > 1 {
		return fmt.Sprintf("\n(Did you mean one of %s?)", strings.Join(similar, ", "))
	}
	return fmt.Sprintf("\n(Did you mean %s?)", similar[0])
}

// trimPrefixes removes the option prefix from every candidate.
func trimPrefixes(candidates []string, prefix string) []string {
	trimmed := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		trimmed = append(trimmed, strings.TrimPrefix(candidate, prefix))
	}
	return trimmed
}

// editDistance returns the Damerau-Levenshtein distance of two words.
//
// The transposition counts as one change, the way the distance commander
// computes it.
func editDistance(a, b string) int {
	if abs(len(a)-len(b)) > maxSuggestionDistance {
		return max(len(a), len(b))
	}

	table := make([][]int, len(a)+1)
	for i := range table {
		table[i] = make([]int, len(b)+1)
		table[i][0] = i
	}
	for j := 0; j <= len(b); j++ {
		table[0][j] = j
	}

	for j := 1; j <= len(b); j++ {
		for i := 1; i <= len(a); i++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			table[i][j] = min(table[i-1][j]+1, table[i][j-1]+1, table[i-1][j-1]+cost)
			if i > 1 && j > 1 && a[i-1] == b[j-2] && a[i-2] == b[j-1] {
				table[i][j] = min(table[i][j], table[i-2][j-2]+1)
			}
		}
	}
	return table[len(a)][len(b)]
}

func abs(value int) int {
	if value < 0 {
		return -value
	}
	return value
}

func max(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func min(values ...int) int {
	smallest := values[0]
	for _, value := range values[1:] {
		if value < smallest {
			smallest = value
		}
	}
	return smallest
}
