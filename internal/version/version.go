// Package version exposes the single declared version of the product.
//
// The version is declared once, in the VERSION file at the repository root,
// and stamped into the binary at build time. The release tooling derives the
// npm package version, the Homebrew formula reference, the template bundle
// version and the marketplace package version from it.
package version

import (
	_ "embed"
	"strings"
)

//go:embed VERSION
var declared string

// Version is the stamped version. The build sets it with
// -ldflags "-X github.com/lindoelio/spec-driven-steroids/internal/version.Version=<version>".
var Version = "0.0.0-dev"

// String returns the declared version.
func String() string {
	if Version != "" && Version != "0.0.0-dev" {
		return Version
	}
	if trimmed := strings.TrimSpace(declared); trimmed != "" {
		return trimmed
	}
	return "0.0.0"
}

// Declared returns the version as declared in the repository.
func Declared() string {
	return strings.TrimSpace(declared)
}
