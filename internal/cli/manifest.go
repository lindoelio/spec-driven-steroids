package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/lindoelio/spec-driven-steroids/internal/cleanup"
	"github.com/lindoelio/spec-driven-steroids/internal/cmdr"
	"github.com/lindoelio/spec-driven-steroids/internal/config"
	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/emit"
	"github.com/lindoelio/spec-driven-steroids/internal/manifest"
	"github.com/lindoelio/spec-driven-steroids/internal/version"
)

// NewDoctorCommand builds the doctor command.
func NewDoctorCommand() *cmdr.Command {
	cmd := cmdr.New("doctor")
	cmd.Description("Check installed SDS files for missing or modified artifacts")
	cmd.OptionWithDefault("--format <text|json>", "Output format (text or json)", "text")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		return runDoctor(command)
	})
	return cmd
}

// installHealth reports the state of one installation.
type installHealth struct {
	Platform string   `json:"platform"`
	Scope    string   `json:"scope"`
	Root     string   `json:"root"`
	Missing  []string `json:"missing"`
	Modified []string `json:"modified"`
	OK       int      `json:"ok"`
}

// doctorPayload is the machine readable output of the doctor command.
type doctorPayload struct {
	Healthy         bool            `json:"healthy"`
	Installs        []installHealth `json:"installs"`
	Superseded      []string        `json:"supersededGuidance"`
	LegacyRuleGraph string          `json:"legacyRuleGraph,omitempty"`
	Root            string          `json:"root"`
	Layer           string          `json:"layer"`
}

func runDoctor(command *cmdr.Command) error {
	resolver := config.Default()
	store := manifest.NewStore(resolver.InstallDir())
	manifests, err := store.List()
	if err != nil {
		return err
	}

	report := []installHealth{}
	for _, current := range manifests {
		entry := installHealth{
			Platform: current.Platform,
			Scope:    current.Scope,
			Root:     current.Root,
			Missing:  []string{},
			Modified: []string{},
		}
		for _, file := range current.Files {
			if _, err := os.Stat(file.Path); err != nil {
				entry.Missing = append(entry.Missing, file.Path)
				continue
			}
			digest, err := manifest.HashFile(file.Path)
			if err != nil {
				entry.Missing = append(entry.Missing, file.Path)
				continue
			}
			if digest != file.SHA256 {
				entry.Modified = append(entry.Modified, file.Path)
				continue
			}
			entry.OK++
		}
		report = append(report, entry)
	}

	healthy := true
	for _, entry := range report {
		if len(entry.Missing) > 0 || len(entry.Modified) > 0 {
			healthy = false
		}
	}

	superseded := supersededGuidance(resolver.WorkDir)
	if superseded == nil {
		superseded = []string{}
	}
	legacyRuleGraph := legacyRuleGraphDir(resolver)
	payload := doctorPayload{
		Healthy:         healthy,
		Installs:        report,
		Superseded:      superseded,
		LegacyRuleGraph: legacyRuleGraph,
		// The layer describes the root the payload names. Every install
		// carries the scope it belongs to.
		Root:  resolver.ProjectRoot(),
		Layer: string(resolver.LayerFor(config.ScopeProject)),
	}

	if command.OptString("format") == "json" {
		raw, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintln(os.Stdout, string(raw))
	} else if len(report) == 0 {
		fmt.Fprintln(os.Stdout, yellow("No SDS install manifests found."))
	} else {
		for _, entry := range report {
			status := green("OK")
			if len(entry.Missing) > 0 || len(entry.Modified) > 0 {
				status = yellow("DRIFT")
			}
			fmt.Fprintf(os.Stdout, "%s %s (%s) %s\n", status, entry.Platform, entry.Scope, entry.Root)
			if len(entry.Missing) > 0 {
				fmt.Fprintln(os.Stdout, red(fmt.Sprintf("  missing: %d", len(entry.Missing))))
				for i, file := range entry.Missing {
					if i >= 5 {
						break
					}
					fmt.Fprintf(os.Stdout, "    - %s\n", file)
				}
			}
			if len(entry.Modified) > 0 {
				fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("  modified: %d", len(entry.Modified))))
				for i, file := range entry.Modified {
					if i >= 5 {
						break
					}
					fmt.Fprintf(os.Stdout, "    - %s\n", file)
				}
			}
		}
	}

	for _, path := range superseded {
		if command.OptString("format") != "json" {
			fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("  superseded: %s (CONVENTIONS.md is present)", path)))
		}
	}

	if legacyRuleGraph != "" && command.OptString("format") != "json" {
		fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("  legacy rule graph: %s (no longer read or written; remove it manually after backing it up)", legacyRuleGraph)))
	}

	if !healthy {
		setExitCode(1)
	}
	return nil
}

// supersededGuidance returns the guidance documents the consolidated
// document replaced.
func supersededGuidance(workDir string) []string {
	if _, err := os.Stat(filepath.Join(workDir, "CONVENTIONS.md")); err != nil {
		return []string{}
	}
	var superseded []string
	for _, name := range []string{"CONTRIBUTING.md", "STYLEGUIDE.md"} {
		if _, err := os.Stat(filepath.Join(workDir, name)); err == nil {
			superseded = append(superseded, name)
		}
	}
	return superseded
}

// legacyRuleGraphDir returns the path of a rule graph left by a previous
// release, or an empty string when there is none.
//
// The native CLI no longer reads or writes the rule graph. The directory is
// user data, so the CLI only reports it; removal stays manual.
func legacyRuleGraphDir(resolver config.Resolver) string {
	candidates := []string{filepath.Join(resolver.UserRoot(), "stewardship")}
	if home := os.Getenv("SDS_HOME"); home != "" {
		candidates = append(candidates, filepath.Join(home, "stewardship"))
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}
	return ""
}

// NewUninstallCommand builds the uninstall command.
func NewUninstallCommand() *cmdr.Command {
	cmd := cmdr.New("uninstall")
	cmd.Description("Remove manifest-tracked SDS files for a platform and scope")
	cmd.Option("--platform <platform>", "Limit to one platform")
	cmd.OptionWithDefault("--scope <scope>", "Scope: global or project", "global")
	cmd.Option("--project", "Shortcut for --scope project")
	cmd.Option("--force", "Remove files even if modified")
	cmd.Option("--dry-run", "Show what would be removed")
	cmd.Option("--json", "Emit JSON")
	cmd.Option("-y, --yes", "Skip confirmation prompt")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		return runUninstall(command)
	})
	return cmd
}

func runUninstall(command *cmdr.Command) error {
	registry, err := descriptor.Load()
	if err != nil {
		return err
	}
	resolver := config.Default()
	env := descriptor.DefaultEnv()

	scope := "global"
	if command.OptBool("project") || command.OptString("scope") == "project" {
		scope = "project"
	}
	// The uninstall command does not reject an unknown platform: it filters
	// the manifests and reports that there is nothing to remove, which is
	// what the previous release does.
	platform := command.OptString("platform")

	store := manifest.NewStore(resolver.InstallDir())
	manifests, err := store.List()
	if err != nil {
		return err
	}
	selected := filterManifests(manifests, scope, platform, resolver.WorkDir)

	if len(selected) == 0 {
		if command.OptBool("json") {
			raw, err := json.MarshalIndent(map[string]any{"scope": scope, "removed": []string{}, "skipped": []string{}, "manifests": 0}, "", "  ")
			if err != nil {
				return err
			}
			fmt.Fprintln(os.Stdout, string(raw))
			return nil
		}
		fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("No %s install manifests found.", scope)))
		return nil
	}

	dryRun := command.OptBool("dry-run")
	if !command.OptBool("yes") && !dryRun {
		if !stdinIsTerminal() {
			return usageError("Error: --yes is required in a non-interactive session.")
		}
		if !confirm(fmt.Sprintf("Remove %d install(s)? (y/N) ", len(selected))) {
			fmt.Fprintln(os.Stdout, yellow("Aborted."))
			return nil
		}
	}

	result, err := cleanup.CleanScope(store, registry, env, scope, platform, resolver.ProjectRoot(), manifest.CleanOptions{
		Force:  command.OptBool("force"),
		DryRun: dryRun,
	})
	if err != nil {
		return err
	}

	if command.OptBool("json") {
		raw, err := json.MarshalIndent(map[string]any{
			"scope":     scope,
			"manifests": len(selected),
			"removed":   result.Removed,
			"skipped":   result.Skipped,
			"dryRun":    dryRun,
		}, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintln(os.Stdout, string(raw))
	} else {
		fmt.Fprintln(os.Stdout, green(fmt.Sprintf("Removed %d file(s) from %d install(s).", len(result.Removed), len(selected))))
		if len(result.Skipped) > 0 {
			fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("Skipped %d modified file(s). Use --force to remove them.", len(result.Skipped))))
		}
	}

	if len(result.Skipped) > 0 {
		setExitCode(1)
	}
	return nil
}

// NewRepairCommand builds the repair command.
func NewRepairCommand() *cmdr.Command {
	cmd := cmdr.New("repair")
	cmd.Description("Re-inject missing files for manifest-tracked installs")
	cmd.Option("--platform <platform>", "Limit to one platform")
	cmd.OptionWithDefault("--scope <scope>", "Scope: global or project", "global")
	cmd.Option("--project", "Shortcut for --scope project")
	cmd.Option("--dry-run", "Show what would be written")
	cmd.Option("--json", "Emit JSON")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		return runRepair(command)
	})
	return cmd
}

// repairEntry is the outcome of repairing one installation.
type repairEntry struct {
	Platform string `json:"platform"`
	Scope    string `json:"scope"`
	Files    int    `json:"files"`
	OK       bool   `json:"ok"`
	Error    string `json:"error,omitempty"`
}

func runRepair(command *cmdr.Command) error {
	registry, err := descriptor.Load()
	if err != nil {
		return err
	}
	resolver := config.Default()
	env := descriptor.DefaultEnv()

	scope := "global"
	if command.OptBool("project") || command.OptString("scope") == "project" {
		scope = "project"
	}
	platform := command.OptString("platform")

	store := manifest.NewStore(resolver.InstallDir())
	manifests, err := store.List()
	if err != nil {
		return err
	}
	selected := filterManifests(manifests, scope, platform, resolver.WorkDir)

	if len(selected) == 0 {
		if command.OptBool("json") {
			raw, err := json.MarshalIndent(map[string]any{"scope": scope, "repaired": []repairEntry{}, "manifests": 0}, "", "  ")
			if err != nil {
				return err
			}
			fmt.Fprintln(os.Stdout, string(raw))
			return nil
		}
		fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("No %s install manifests found.", scope)))
		return nil
	}

	dryRun := command.OptBool("dry-run")
	repaired := []repairEntry{}
	_, tree := resolveTemplateSource(context.Background(), resolver, command.OptString("templates"))

	for _, current := range selected {
		desc, ok := registry.Get(current.Platform)
		if !ok || current.Kind == manifest.KindCanonical {
			continue
		}
		plan, err := emit.Build(desc, emit.Options{
			Registry:     registry,
			Env:          env,
			Scope:        current.Scope,
			ArtifactRoot: resolver.RootFor(config.Scope(current.Scope)),
			Tree:         tree,
		})
		if err != nil {
			repaired = append(repaired, repairEntry{Platform: current.Platform, Scope: current.Scope, Files: 0, OK: false, Error: err.Error()})
			continue
		}
		if !dryRun {
			for _, artifact := range plan.Platform {
				if err := writeFile(artifact.Path, artifact.Content); err != nil {
					repaired = append(repaired, repairEntry{Platform: current.Platform, Scope: current.Scope, Files: 0, OK: false, Error: err.Error()})
					continue
				}
			}
		}
		repaired = append(repaired, repairEntry{Platform: current.Platform, Scope: current.Scope, Files: len(plan.Platform), OK: true})
	}

	healthy := true
	for _, entry := range repaired {
		if !entry.OK {
			healthy = false
		}
	}

	if command.OptBool("json") {
		raw, err := json.MarshalIndent(map[string]any{"scope": scope, "dryRun": dryRun, "repaired": repaired}, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintln(os.Stdout, string(raw))
	} else {
		for _, entry := range repaired {
			status := green("OK")
			if !entry.OK {
				status = red("FAIL")
			}
			fmt.Fprintf(os.Stdout, "%s %s (%s) %d file(s)\n", status, entry.Platform, entry.Scope, entry.Files)
			if entry.Error != "" {
				fmt.Fprintln(os.Stdout, red("  "+entry.Error))
			}
		}
	}

	if !healthy {
		setExitCode(1)
	}
	return nil
}

// NewTemplatesCommand builds the templates command.
func NewTemplatesCommand() *cmdr.Command {
	cmd := cmdr.New("templates")
	cmd.Description("Inspect the resolved template source")
	cmd.Argument("<action>", "Action: info")
	cmd.Option("--source <source>", "Template source: bundled or remote")
	cmd.Option("--json", "Emit JSON")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		action := command.Arg(0)
		if action != "info" {
			return usageError(fmt.Sprintf("Error: Unknown templates action '%s'. Use 'info'.", action))
		}
		source, _ := resolveTemplateSource(context.Background(), config.Default(), command.OptString("source"))
		payload := templatesPayload{
			Source:         source.Source,
			Version:        source.Version,
			RootDir:        source.RootDir,
			SHA256:         source.SHA256,
			FallbackReason: source.FallbackReason,
			Warnings:       source.Warnings,
		}
		if command.OptBool("json") {
			raw, err := json.MarshalIndent(payload, "", "  ")
			if err != nil {
				return err
			}
			fmt.Fprintln(os.Stdout, string(raw))
			return nil
		}
		fmt.Fprintf(os.Stdout, "Source: %s\n", payload.Source)
		fmt.Fprintf(os.Stdout, "Version: %s\n", payload.Version)
		fmt.Fprintf(os.Stdout, "Root: %s\n", payload.RootDir)
		if payload.SHA256 != "" {
			fmt.Fprintf(os.Stdout, "SHA-256: %s\n", payload.SHA256)
		}
		if payload.FallbackReason != "" {
			fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("Fallback: %s", payload.FallbackReason)))
		}
		for _, warning := range source.Warnings {
			fmt.Fprintln(os.Stdout, yellow("Warning: "+warning))
		}
		return nil
	})
	return cmd
}

// templatesPayload is the machine readable output of the templates command.
//
// The field order matches the payload of the previous release.
type templatesPayload struct {
	Source         string   `json:"source"`
	Version        string   `json:"version"`
	RootDir        string   `json:"rootDir"`
	SHA256         string   `json:"sha256"`
	FallbackReason string   `json:"fallbackReason,omitempty"`
	Warnings       []string `json:"warnings"`
}

// versionString returns the declared version.
func versionString() string { return version.String() }
