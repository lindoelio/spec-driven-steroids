package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/lindoelio/spec-driven-steroids/internal/cmdr"
	"github.com/lindoelio/spec-driven-steroids/internal/pack"
	"github.com/lindoelio/spec-driven-steroids/internal/version"
)

// NewPackageCommand builds the package command.
//
// The package command renders the portable Agent Plugin package, the vendor
// manifests and the marketplace catalogs. The distribution tree is generated
// outside the repository working tree, because the repository ignores some of
// the paths a catalog needs.
func NewPackageCommand() *cmdr.Command {
	cmd := cmdr.New("package")
	cmd.Description("Render the portable Agent Plugin package and the marketplace catalogs")
	cmd.Option("--out <dir>", "Directory the distribution tree is written to")
	cmd.Option("--owner <owner>", "Marketplace owner name")
	cmd.Option("--name <name>", "Portable package name")
	cmd.Option("--description <text>", "Package description")
	cmd.Option("--author <author>", "Package author")
	cmd.Option("--icon <icon>", "Package icon path")
	cmd.Option("--category <category>", "Marketplace category")
	cmd.Option("--mcp <path>", "Optional MCP configuration file")
	cmd.Option("--dry-run", "Compute the tree without writing it")
	cmd.Option("--json", "Emit a machine-readable JSON summary")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		return runPackage(command)
	})
	return cmd
}

func runPackage(command *cmdr.Command) error {
	outDir := command.OptString("out")
	if outDir == "" {
		outDir = filepath.Join(os.TempDir(), "sds-distribution")
	}

	mcp := []byte(nil)
	if path := command.OptString("mcp"); path != "" {
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		mcp = content
	}

	options := pack.Options{
		OutDir:      outDir,
		Version:     version.String(),
		Owner:       command.OptString("owner"),
		PackageName: command.OptString("name"),
		Description: command.OptString("description"),
		Author:      command.OptString("author"),
		Icon:        command.OptString("icon"),
		Category:    command.OptString("category"),
		MCPConfig:   mcp,
		DryRun:      command.OptBool("dry-run"),
	}
	if options.Owner == "" {
		options.Owner = "lindoelio"
	}
	if options.PackageName == "" {
		options.PackageName = "spec-driven-steroids"
	}
	if options.Description == "" {
		options.Description = "Inject Spec-Driven workflow into your favorite AI Agents. Rigorous. Simple. Frictionless."
	}
	if options.Author == "" {
		options.Author = "Lindoélio Lázaro"
	}

	result, err := pack.Render(options)
	if err != nil {
		return err
	}

	violations, err := pack.Validate(result.OutDir)
	if err != nil {
		return err
	}
	if len(violations) > 0 {
		for _, violation := range violations {
			fmt.Fprintln(os.Stderr, red("Error: "+violation))
		}
		setExitCode(1)
		return nil
	}

	if command.OptBool("json") {
		raw, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintln(os.Stdout, string(raw))
		return nil
	}

	fmt.Fprintf(os.Stdout, "Distribution tree: %s\n", result.OutDir)
	fmt.Fprintf(os.Stdout, "Files: %d\n", len(result.Files))
	for _, publication := range result.Publication {
		fmt.Fprintf(os.Stdout, "  %-14s %s", publication.Marketplace, publication.Mode)
		if publication.Reason != "" {
			fmt.Fprintf(os.Stdout, " — %s", publication.Reason)
		}
		fmt.Fprintln(os.Stdout)
	}
	return nil
}
