package pack

import "strings"

// The MiniMax Code marketplace lists plugins under a fixed set of categories,
// so a category that belongs to another marketplace is mapped to the closest
// one of that set.
const miniMaxIconPath = "icon.png"

// miniMaxCategories maps the category of the package to the categories the
// MiniMax Code marketplace lists.
var miniMaxCategories = map[string]string{
	"development":   "Code",
	"code":          "Code",
	"productivity":  "Productivity",
	"design":        "Design & Sites",
	"sites":         "Design & Sites",
	"office":        "Office",
	"studio":        "Studio",
	"business":      "Business",
	"sales":         "Sales",
	"education":     "Education",
	"science":       "Science & Healthcare",
	"healthcare":    "Science & Healthcare",
	"other":         "Other",
	"uncategorized": "Other",
}

// miniMaxExampleQueries are the example prompts the marketplace shows when it
// offers the plugin.
var miniMaxExampleQueries = []string{
	"Start a spec-driven change in this project",
	"Review my work against the specification",
}

// miniMaxCategory returns the category of the MiniMax Code marketplace that
// fits the category of the package.
func miniMaxCategory(category string) string {
	if mapped, ok := miniMaxCategories[strings.ToLower(strings.TrimSpace(category))]; ok {
		return mapped
	}
	return "Other"
}
