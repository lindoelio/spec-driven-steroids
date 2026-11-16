// Package assets embeds the canonical artifact tree and the pre-change legacy
// baseline that the Go binary ships with.
//
// The canonical tree is the live content the CLI injects. The legacy baseline
// is a frozen snapshot of the same tree as it stood before the rewrite, so a
// file written by a previous release can be recognised by content match
// against the body it was actually generated from.
package assets

import (
	"embed"
	"io/fs"
)

// Canonical holds the live canonical artifact tree: thirteen skill
// directories, one agent and two commands.
//
//go:embed canonical
var canonical embed.FS

// Legacy holds the frozen pre-change canonical tree.
//
//go:embed legacy
var legacy embed.FS

// CanonicalFS returns the canonical artifact tree rooted at the tree itself,
// so that "skills/spec-driven-planner/SKILL.md" resolves directly.
func CanonicalFS() fs.FS { return mustSub(canonical, "canonical") }

// LegacyFS returns the pre-change canonical tree rooted at the tree itself.
func LegacyFS() fs.FS { return mustSub(legacy, "legacy") }

// CanonicalRoot is the path prefix of the canonical tree inside the embedded
// filesystem, matching the layout a remote bundle uses.
const CanonicalRoot = "canonical"

func mustSub(f embed.FS, dir string) fs.FS {
	sub, err := fs.Sub(f, dir)
	if err != nil {
		panic("assets: " + err.Error())
	}
	return sub
}
