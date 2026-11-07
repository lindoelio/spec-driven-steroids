// Command sds injects the Spec-Driven workflow into the AI coding tools of
// the current machine.
//
// The binary is self contained: it carries the canonical artifacts, the
// platform descriptors and the install bookkeeping, and needs no runtime
// dependency.
package main

import (
	"os"

	"github.com/lindoelio/spec-driven-steroids/internal/cli"
)

func main() {
	os.Exit(cli.Run(os.Args[1:]))
}
