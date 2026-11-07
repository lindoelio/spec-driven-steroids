package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/lindoelio/spec-driven-steroids/internal/cleanup"
	"github.com/lindoelio/spec-driven-steroids/internal/cmdr"
	"github.com/lindoelio/spec-driven-steroids/internal/config"
	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/manifest"
)

// NewCleanCommand builds the clean command.
func NewCleanCommand() *cmdr.Command {
	cmd := cmdr.New("clean")
	cmd.Description("Remove globally injected Spec-Driven Steroids")
	cmd.Option("--global", "Clean global steroids from all platforms (default)")
	cmd.Option("--project", "Clean project-level steroids in the current directory")
	cmd.Option("--platform <platform>", "Limit cleanup to one platform")
	cmd.Option("--force", "Remove files even if they were modified after installation")
	cmd.Option("--dry-run", "Show what would be removed without deleting anything")
	cmd.Option("--json", "Emit a machine-readable JSON summary")
	cmd.Option("-y, --yes", "Skip confirmation prompt")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		return runClean(command)
	})
	return cmd
}

// legacyCandidatePayload is one leftover the previous release wrote.
type legacyCandidatePayload struct {
	Platform string `json:"platform"`
	Scope    string `json:"scope"`
	Path     string `json:"path"`
	Kind     string `json:"kind"`
	Reason   string `json:"reason"`
}

// cleanPayload is the machine readable output of the clean command.
type cleanPayload struct {
	Scope     string                   `json:"scope"`
	Layer     string                   `json:"layer"`
	Root      string                   `json:"root"`
	DryRun    bool                     `json:"dryRun"`
	Removed   []string                 `json:"removed"`
	Skipped   []string                 `json:"skipped"`
	Retained  []string                 `json:"retained"`
	Manifests int                      `json:"manifests"`
	Legacy    []legacyCandidatePayload `json:"legacyCandidates"`
	Aborted   bool                     `json:"aborted,omitempty"`
}

func runClean(command *cmdr.Command) error {
	registry, err := descriptor.Load()
	if err != nil {
		return err
	}
	resolver := config.Default()
	env := descriptor.DefaultEnv()

	scope := "global"
	if command.OptBool("project") {
		scope = "project"
	}
	platform := command.OptString("platform")
	if platform != "" {
		if _, ok := registry.Get(platform); !ok {
			return usageError(fmt.Sprintf("Error: Unknown platform: %s", platform))
		}
	}

	dryRun := command.OptBool("dry-run")
	asJSON := command.OptBool("json")
	force := command.OptBool("force")

	if !asJSON {
		fmt.Fprintln(os.Stdout, boldCyan(fmt.Sprintf("\n🧹 Cleaning %s steroids...\n", scope)))
	}

	store := manifest.NewStore(resolver.InstallDir())
	manifests, err := store.List()
	if err != nil {
		return err
	}

	selected := filterManifests(manifests, scope, platform, resolver.WorkDir)
	planned := []string{}
	for _, current := range selected {
		for _, file := range current.Files {
			planned = append(planned, file.Path)
		}
	}
	sort.Strings(planned)

	if !asJSON {
		fmt.Fprintln(os.Stdout, boldCyan("🔍 Preview of clean:"))
		for _, path := range planned {
			fmt.Fprintf(os.Stdout, "    • %s\n", path)
		}
		fmt.Fprintln(os.Stdout)
	}

	if dryRun {
		result, err := cleanup.CleanScope(store, registry, env, scope, platform, resolver.ProjectRoot(), manifest.CleanOptions{Force: force, DryRun: true})
		if err != nil {
			return err
		}
		legacy, err := cleanup.Scan(cleanup.Options{
			Registry:     registry,
			Env:          env,
			Scope:        scope,
			Platform:     platform,
			Manifests:    manifests,
			ArtifactRoot: resolver.RootFor(config.Scope(scope)),
			DryRun:       true,
		})
		if err != nil {
			return err
		}
		payload := buildCleanPayload(scope, resolver, result, legacy, true)
		if asJSON {
			raw, err := json.MarshalIndent(payload, "", "  ")
			if err != nil {
				return err
			}
			fmt.Fprintln(os.Stdout, string(raw))
			return nil
		}
		for _, path := range result.Removed {
			fmt.Fprintf(os.Stdout, "  would remove: %s\n", path)
		}
		for _, path := range result.Skipped {
			fmt.Fprintf(os.Stdout, "%s\n", yellow(fmt.Sprintf("  would skip (modified): %s", path)))
		}
		printLegacyCandidates(legacy.Candidates)
		fmt.Fprintln(os.Stdout, yellow("\nDry run: no files were removed."))
		return nil
	}

	if !command.OptBool("yes") && !stdinIsTerminal() {
		return usageError("Error: --yes is required in a non-interactive session.")
	}
	if !command.OptBool("yes") {
		if !confirm(fmt.Sprintf("Proceed with cleaning? (y/N) ")) {
			if !asJSON {
				fmt.Fprintln(os.Stdout, yellow("Aborted."))
			}
			return nil
		}
	}

	result, err := cleanup.CleanScope(store, registry, env, scope, platform, resolver.ProjectRoot(), manifest.CleanOptions{Force: force})
	if err != nil {
		return err
	}

	legacy, err := cleanup.Scan(cleanup.Options{
		Registry:     registry,
		Env:          env,
		Scope:        scope,
		Platform:     platform,
		Manifests:    manifests,
		ArtifactRoot: resolver.RootFor(config.Scope(scope)),
	})
	if err != nil {
		return err
	}

	payload := buildCleanPayload(scope, resolver, result, legacy, false)
	if asJSON {
		raw, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintln(os.Stdout, string(raw))
		return nil
	}

	if len(result.Removed) > 0 {
		fmt.Fprintln(os.Stdout, green(fmt.Sprintf("  ✅ Removed %d manifest-tracked file(s).", len(result.Removed))))
	}
	if len(result.Skipped) > 0 {
		fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("  ⚠️ Skipped %d modified file(s). Use --force to remove them.", len(result.Skipped))))
	}
	if len(result.Retained) > 0 {
		fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("  ℹ️ Kept %d file(s) another platform still claims.", len(result.Retained))))
	}
	printLegacyCandidates(legacy.Candidates)
	if len(result.Removed) == 0 && len(result.Skipped) == 0 && len(legacy.Removed) == 0 {
		fmt.Fprintln(os.Stdout, yellow("  No install manifests or legacy files found."))
	}
	return nil
}

func buildCleanPayload(scope string, resolver config.Resolver, result cleanup.ScopeResult, legacy cleanup.Result, dryRun bool) cleanPayload {
	payload := cleanPayload{
		Scope:     scope,
		Layer:     string(resolver.LayerFor(config.Scope(scope))),
		Root:      resolver.RootFor(config.Scope(scope)),
		DryRun:    dryRun,
		Removed:   result.Removed,
		Skipped:   result.Skipped,
		Retained:  result.Retained,
		Manifests: result.Manifests,
		Legacy:    []legacyCandidatePayload{},
	}
	if payload.Removed == nil {
		payload.Removed = []string{}
	}
	if payload.Skipped == nil {
		payload.Skipped = []string{}
	}
	if payload.Retained == nil {
		payload.Retained = []string{}
	}
	for _, candidate := range legacy.Candidates {
		payload.Legacy = append(payload.Legacy, legacyCandidatePayload{
			Platform: candidate.Platform,
			Scope:    candidate.Scope,
			Path:     candidate.Path,
			Kind:     candidate.Kind,
			Reason:   candidate.Reason,
		})
	}
	return payload
}

func printLegacyCandidates(candidates []cleanup.Candidate) {
	for _, candidate := range candidates {
		fmt.Fprintf(os.Stdout, "  %s\n", yellow(fmt.Sprintf("  legacy candidate: %s (%s)", candidate.Path, candidate.Reason)))
	}
}

// filterManifests selects the manifests a scope covers.
//
// The project scope is bound to the project directory, not to the artifact
// root: a platform manifest records the root of its own platform directory,
// which is a sibling of the artifact root, and it belongs to the project as
// soon as it sits inside the project directory.
func filterManifests(manifests []*manifest.Manifest, scope, platform, projectDir string) []*manifest.Manifest {
	var selected []*manifest.Manifest
	for _, current := range manifests {
		if current.Scope != scope {
			continue
		}
		if platform != "" && current.Platform != platform {
			continue
		}
		if scope == "project" {
			root, err := filepath.Abs(current.Root)
			if err != nil {
				continue
			}
			base, err := filepath.Abs(projectDir)
			if err != nil {
				continue
			}
			if root != base && !hasPathPrefix(root, base) {
				continue
			}
		}
		selected = append(selected, current)
	}
	return selected
}

func hasPathPrefix(path, prefix string) bool {
	return len(path) > len(prefix) && path[:len(prefix)] == prefix && path[len(prefix)] == filepath.Separator
}

// confirm asks a yes or no question.
func confirm(question string) bool {
	fmt.Fprint(os.Stdout, question)
	var answer string
	if _, err := fmt.Fscanln(os.Stdin, &answer); err != nil {
		return false
	}
	answer = strings.ToLower(strings.TrimSpace(answer))
	return answer == "y" || answer == "yes"
}
