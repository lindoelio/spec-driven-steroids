package cli

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/lindoelio/spec-driven-steroids/internal/cmdr"
	"github.com/lindoelio/spec-driven-steroids/internal/config"
	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/emit"
	"github.com/lindoelio/spec-driven-steroids/internal/manifest"
	"github.com/lindoelio/spec-driven-steroids/internal/version"
)

// injectionResult is the per-platform outcome of an injection.
type injectionResult struct {
	Platform    string   `json:"platform"`
	DisplayName string   `json:"displayName"`
	Scope       string   `json:"scope"`
	Layer       string   `json:"layer"`
	Root        string   `json:"root"`
	OK          bool     `json:"ok"`
	Error       string   `json:"error"`
	Files       []string `json:"files,omitempty"`
	DryRun      bool     `json:"dryRun,omitempty"`
}

// injectionPayload is the machine readable output of the inject command.
type injectionPayload struct {
	TemplateSource templateSourcePayload `json:"templateSource"`
	Scope          string                `json:"scope"`
	Layer          string                `json:"layer"`
	ArtifactRoot   string                `json:"artifactRoot"`
	DryRun         bool                  `json:"dryRun"`
	Results        []injectionResult     `json:"results"`
}

type templateSourcePayload struct {
	Source         string   `json:"source"`
	Version        string   `json:"version"`
	RootDir        string   `json:"rootDir,omitempty"`
	FallbackReason string   `json:"fallbackReason,omitempty"`
	ErrorKind      string   `json:"errorKind,omitempty"`
	SHA256         string   `json:"sha256,omitempty"`
	Warnings       []string `json:"warnings"`
}

// NewInjectCommand builds the inject command.
func NewInjectCommand() *cmdr.Command {
	cmd := cmdr.New("inject")
	cmd.Description("Inject platform-specific Spec-Driven configs")
	cmd.Option("--platform <ids>", "Comma-separated platform IDs (skips the platform prompt)")
	cmd.Option("--scope <scope>", "Injection scope: global or project")
	cmd.Option("--templates <source>", "Template source: bundled or remote")
	cmd.Option("--dry-run", "Show planned files without writing them")
	cmd.Option("--json", "Emit a machine-readable JSON summary")
	cmd.Option("--backup", "Back up existing platform roots before writing")
	cmd.Option("--yes", "Skip prompts when --platform is provided")
	cmd.Action(func(command *cmdr.Command, args []string) error {
		return runInject(command)
	})
	return cmd
}

func runInject(command *cmdr.Command) error {
	registry, err := descriptor.Load()
	if err != nil {
		return err
	}
	resolver := config.Default()
	env := descriptor.DefaultEnv()

	platforms, err := selectPlatforms(command, registry)
	if err != nil {
		return err
	}

	scope, err := selectScope(command, registry, platforms)
	if err != nil {
		return err
	}

	templateSelection := command.OptString("templates")
	if templateSelection != "" && templateSelection != "bundled" && templateSelection != "remote" {
		return usageError("Error: --templates must be 'bundled' or 'remote'.")
	}

	dryRun := command.OptBool("dry-run")
	asJSON := command.OptBool("json")
	backup := command.OptBool("backup")
	log := func(string) {}
	if !asJSON {
		log = func(message string) { fmt.Fprintln(os.Stdout, message) }
	}

	source, tree := resolveTemplateSource(context.Background(), resolver, templateSelection)

	if source.Source == "remote" {
		log(green(fmt.Sprintf("Using remote templates (%s).", source.Version)))
	} else {
		log(yellow("Using bundled templates."))
		if source.FallbackReason != "" {
			if source.ErrorKind != "" {
				log(yellow(fmt.Sprintf("Remote template retrieval failed, so inject fell back to bundled templates: %s", source.FallbackReason)))
			} else {
				log(yellow(source.FallbackReason))
			}
		}
	}
	for _, warning := range source.Warnings {
		log(yellow("Template warning: " + warning))
	}

	store := manifest.NewStore(resolver.InstallDir())

	// The canonical manifest accumulates the claims of every platform, so
	// reading it and writing it back has to be atomic against another
	// injection running at the same time.
	release, err := store.Lock()
	if err != nil {
		return err
	}
	defer release()

	existing, err := store.List()
	if err != nil {
		return err
	}

	results := make([]injectionResult, 0, len(platforms))
	canonicalClaims := map[string][]string{}
	for _, current := range existing {
		if current.Kind != manifest.KindCanonical {
			continue
		}
		for _, file := range current.Files {
			canonicalClaims[file.Path] = append(canonicalClaims[file.Path], file.ClaimingPlatforms...)
		}
	}

	canonicalWritten := map[string]bool{}

	for _, platform := range platforms {
		desc, ok := registry.Get(platform)
		if !ok {
			continue
		}
		displayName := desc.DisplayName
		effectiveScope := desc.ResolveScope(scope)
		layer := resolver.LayerFor(config.Scope(effectiveScope))
		artifactRoot := resolver.RootFor(config.Scope(effectiveScope))

		if !asJSON && !dryRun {
			fmt.Fprintf(os.Stdout, "  %s...", displayName)
		}

		plan, err := emit.Build(desc, emit.Options{
			Registry:     registry,
			Env:          env,
			Scope:        effectiveScope,
			ArtifactRoot: artifactRoot,
			Tree:         tree,
		})
		if err != nil {
			results = append(results, injectionResult{Platform: platform, DisplayName: displayName, Scope: effectiveScope, Layer: string(layer), OK: false, Error: err.Error()})
			if !asJSON {
				fmt.Fprintln(os.Stdout)
			}
			log(red(fmt.Sprintf(" fail (%s)", effectiveScope)))
			continue
		}

		planned := []string{}
		for _, file := range plan.Canonical {
			planned = append(planned, emit.CanonicalPath(artifactRoot, file.RelPath))
		}
		for _, artifact := range plan.Platform {
			planned = append(planned, artifact.Path)
		}

		if backup && !dryRun {
			backupRoot := filepath.Join(resolver.BackupDir(), platform, effectiveScope, timestamp())
			copied, err := backupInstallation(store, registry, env, effectiveScope, platform, resolver.ProjectRoot(), backupRoot)
			if err != nil {
				return err
			}
			for _, path := range copied {
				log(gray("  backup: " + path))
			}
		}

		if !dryRun {
			if err := writeCanonicalTree(plan, artifactRoot, resolver); err != nil {
				return err
			}
			canonicalWritten[effectiveScope] = true

			for _, artifact := range plan.Platform {
				if err := writeFile(artifact.Path, artifact.Content, resolver); err != nil {
					return err
				}
			}

			for _, action := range desc.Actions(effectiveScope) {
				if err := runPostInjectAction(action, desc, effectiveScope, resolver, env, registry); err != nil {
					return err
				}
			}
		}

		canonicalPaths := []string{}
		for _, file := range plan.Canonical {
			canonicalPaths = append(canonicalPaths, emit.CanonicalPath(artifactRoot, file.RelPath))
		}
		platformPaths := []string{}
		for _, artifact := range plan.Platform {
			platformPaths = append(platformPaths, artifact.Path)
		}
		if flattensPrompts(desc, effectiveScope) {
			platformPaths = resolveFlattenedPaths(platformRootOf(registry, desc, effectiveScope, env), platformPaths)
		}
		sort.Strings(platformPaths)

		paths := append(append([]string{}, canonicalPaths...), platformPaths...)
		sort.Strings(paths)

		if !dryRun {
			if err := recordManifests(store, registry, desc, effectiveScope, artifactRoot, plan, canonicalPaths, platformPaths, canonicalClaims, resolver, source); err != nil {
				return err
			}
		}

		results = append(results, injectionResult{
			Platform:    platform,
			DisplayName: displayName,
			Scope:       effectiveScope,
			Layer:       string(layer),
			Root:        artifactRoot,
			OK:          true,
			Files:       paths,
			DryRun:      dryRun,
		})
		log(green(fmt.Sprintf(" ok (%s)", effectiveScope)))
	}

	// The layer and the root of the payload describe the scope the payload
	// reports, not the scope that was requested: a platform that does not
	// support the requested scope falls back to another one.
	summaryScope := summarizeScope(results)
	layer := resolver.LayerFor(config.Scope(summaryScope))
	artifactRoot := resolver.RootFor(config.Scope(summaryScope))

	payload := injectionPayload{
		TemplateSource: templateSourcePayload{
			Source:         source.Source,
			Version:        source.Version,
			FallbackReason: source.FallbackReason,
			ErrorKind:      source.ErrorKind,
			SHA256:         source.SHA256,
			Warnings:       source.Warnings,
		},
		Scope:        summaryScope,
		Layer:        string(layer),
		ArtifactRoot: artifactRoot,
		DryRun:       dryRun,
		Results:      results,
	}

	if asJSON {
		raw, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return err
		}
		fmt.Fprintln(os.Stdout, string(raw))
	} else {
		renderInjectionSummary(results, payload.TemplateSource, payload.Scope, dryRun)
		if dryRun {
			for _, result := range results {
				for _, file := range result.Files {
					fmt.Fprintf(os.Stdout, "  would write: %s\n", file)
				}
			}
			fmt.Fprintln(os.Stdout, yellow("\nDry run: no files were written."))
		}
	}

	for _, result := range results {
		if !result.OK {
			setExitCode(1)
		}
	}
	return nil
}

// selectPlatforms resolves the platforms to inject into.
func selectPlatforms(command *cmdr.Command, registry *descriptor.Registry) ([]string, error) {
	if raw := command.OptString("platform"); raw != "" {
		var platforms []string
		var unknown []string
		for _, value := range strings.Split(raw, ",") {
			trimmed := strings.TrimSpace(value)
			if trimmed == "" {
				continue
			}
			if _, ok := registry.Get(trimmed); !ok {
				unknown = append(unknown, trimmed)
				continue
			}
			platforms = append(platforms, trimmed)
		}
		if len(unknown) > 0 {
			return nil, usageError(fmt.Sprintf("Error: Unknown platform(s): %s", strings.Join(unknown, ", ")))
		}
		return platforms, nil
	}

	if command.OptBool("yes") {
		return nil, usageError("Error: --yes requires --platform.")
	}

	selected, err := promptPlatforms(registry)
	if err != nil {
		return nil, err
	}
	return selected, nil
}

// promptPlatforms asks which platforms to configure.
func promptPlatforms(registry *descriptor.Registry) ([]string, error) {
	if !stdinIsTerminal() {
		return nil, usageError("Error: --platform is required in a non-interactive session.")
	}
	all := registry.All()
	fmt.Fprintln(os.Stdout, "Select platforms to support:")
	for i, desc := range all {
		fmt.Fprintf(os.Stdout, "  %d) %s\n", i+1, desc.DisplayName)
	}
	fmt.Fprint(os.Stdout, "Enter the numbers, separated by commas: ")

	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil && line == "" {
		if errors.Is(err, io.EOF) {
			// A closed input is a cancellation, not an internal failure.
			fmt.Fprintln(os.Stdout, yellow("Aborted."))
			return nil, nil
		}
		return nil, err
	}
	var selected []string
	for _, value := range strings.Split(strings.TrimSpace(line), ",") {
		index, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil || index < 1 || index > len(all) {
			continue
		}
		selected = append(selected, all[index-1].ID)
	}
	if len(selected) == 0 {
		return nil, usageError("Error: Select at least one platform.")
	}
	return selected, nil
}

// selectScope resolves the injection scope.
func selectScope(command *cmdr.Command, registry *descriptor.Registry, platforms []string) (string, error) {
	raw := command.OptString("scope")
	if raw != "" {
		if raw != "global" && raw != "project" {
			return "", usageError("Error: --scope must be 'global' or 'project'.")
		}
		return raw, nil
	}

	capable := false
	for _, platform := range platforms {
		if desc, ok := registry.Get(platform); ok && desc.SupportsScope("global") {
			capable = true
			break
		}
	}
	if !capable || command.OptBool("yes") {
		return "global", nil
	}
	if !stdinIsTerminal() {
		return "global", nil
	}

	names := make([]string, 0, len(platforms))
	for _, platform := range platforms {
		if desc, ok := registry.Get(platform); ok {
			names = append(names, desc.DisplayName)
		}
	}
	fmt.Fprintf(os.Stdout, "Injection scope for %s:\n", strings.Join(names, ", "))
	fmt.Fprintln(os.Stdout, "  1) Global (recommended - available across all projects)")
	fmt.Fprintln(os.Stdout, "  2) Project-level (isolated to this project)")
	fmt.Fprint(os.Stdout, "Enter the number: ")

	reader := bufio.NewReader(os.Stdin)
	line, err := reader.ReadString('\n')
	if err != nil && line == "" {
		return "global", nil
	}
	if strings.TrimSpace(line) == "2" {
		return "project", nil
	}
	return "global", nil
}

// writeCanonicalTree writes the canonical artifacts into the artifact root.
func writeCanonicalTree(plan *emit.Plan, artifactRoot string, resolver config.Resolver) error {
	for _, file := range plan.Canonical {
		if err := writeFile(emit.CanonicalPath(artifactRoot, file.RelPath), file.Content, resolver); err != nil {
			return err
		}
	}
	return nil
}

// writeFile writes a file, creating the directories it needs.
//
// A destination that is a symbolic link, or that sits below one inside the
// project or the home tree, is refused: following it would write outside the
// roots the CLI owns. Links above those trees (the OS mounts) are not ours
// to judge.
func writeFile(path string, content []byte, resolver config.Resolver) error {
	if err := refuseSymlink(path, resolver); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, content, 0o644)
}

// refuseSymlink reports a destination that would write through a symbolic
// link inside a managed tree.
//
// The walk is lexical on purpose: a platform root that is itself a symlink to
// a directory outside the project still has to be refused, and resolving the
// path first would hide that link.
func refuseSymlink(path string, resolver config.Resolver) error {
	if info, err := os.Lstat(path); err == nil && info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("refuse to write through the symbolic link %s", path)
	}
	for _, root := range []string{resolver.WorkDir, resolver.Home()} {
		if root == "" {
			continue
		}
		rel, err := filepath.Rel(root, path)
		if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			continue
		}
		parts := strings.Split(rel, string(os.PathSeparator))
		current := root
		for _, part := range parts[:len(parts)-1] {
			current = filepath.Join(current, part)
			if info, err := os.Lstat(current); err == nil && info.Mode()&os.ModeSymlink != 0 {
				return fmt.Errorf("refuse to write through the symbolic link %s", current)
			}
		}
	}
	return nil
}

// recordManifests writes the canonical and the platform manifests.
//
// The canonical manifest records the artifacts of the artifact root, with the
// platforms that claim them. The platform manifest records the platform-side
// artifacts of one platform.
func recordManifests(store *manifest.Store, registry *descriptor.Registry, desc *descriptor.Descriptor, scope, artifactRoot string, plan *emit.Plan, canonicalPaths, platformPaths []string, canonicalClaims map[string][]string, resolver config.Resolver, source templateSourcePayload) error {
	now := time.Now().UTC().Format(time.RFC3339)

	canonicalFiles, err := manifest.BuildInstalledFiles(canonicalPaths)
	if err != nil {
		return err
	}
	for i := range canonicalFiles {
		claims := append([]string{}, canonicalClaims[canonicalFiles[i].Path]...)
		claims = appendUnique(claims, desc.ID)
		sort.Strings(claims)
		canonicalFiles[i].ClaimingPlatforms = claims
		// The claim is recorded, so that a platform injected later in the
		// same run claims the path as well.
		canonicalClaims[canonicalFiles[i].Path] = claims
	}

	canonicalManifest := &manifest.Manifest{
		Version:         manifest.FormatVersion,
		Platform:        "canonical",
		Scope:           scope,
		Root:            artifactRoot,
		SkillsRoot:      filepath.Join(artifactRoot, config.KindSkills),
		CLIVersion:      version.String(),
		TemplateVersion: source.Version,
		InstalledAt:     now,
		Files:           canonicalFiles,
		Kind:            manifest.KindCanonical,
	}
	if _, err := store.Write(canonicalManifest); err != nil {
		return err
	}

	platformFiles, err := manifest.BuildInstalledFiles(platformPaths)
	if err != nil {
		return err
	}
	for i := range platformFiles {
		platformFiles[i].ClaimingPlatforms = []string{desc.ID}
	}

	env := descriptor.DefaultEnv()
	platformRoot := platformRootOf(registry, desc, scope, env)
	skillsRoot := ""
	if path, ok := registry.VariantPath(env, desc, "skills", scope); ok {
		skillsRoot = path
	}

	platformManifest := &manifest.Manifest{
		Version:         manifest.FormatVersion,
		Platform:        desc.ID,
		Scope:           scope,
		Root:            platformRoot,
		SkillsRoot:      skillsRoot,
		CLIVersion:      version.String(),
		TemplateVersion: source.Version,
		InstalledAt:     now,
		Files:           platformFiles,
		Kind:            manifest.KindPlatform,
	}
	if _, err := store.Write(platformManifest); err != nil {
		return err
	}
	return nil
}

// platformRootOf resolves the platform root of a scope.
//
// An empty path means the platform declares no root for the scope.
func platformRootOf(registry *descriptor.Registry, desc *descriptor.Descriptor, scope string, env descriptor.Env) string {
	path, ok := registry.VariantPath(env, desc, "root", scope)
	if !ok {
		return ""
	}
	return path
}

// flattensPrompts reports whether the platform flattens its prompt files.
func flattensPrompts(desc *descriptor.Descriptor, scope string) bool {
	for _, action := range desc.Actions(scope) {
		if action.Action == descriptor.ActionFlattenVSCodePrompts {
			return true
		}
	}
	return false
}

func appendUnique(values []string, value string) []string {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}

// summarizeScope reports the scope of a run, or "mixed".
func summarizeScope(results []injectionResult) string {
	scopes := map[string]bool{}
	for _, result := range results {
		scopes[result.Scope] = true
	}
	if len(scopes) == 1 {
		for scope := range scopes {
			return scope
		}
	}
	return "mixed"
}

// renderInjectionSummary prints the human readable outcome.
func renderInjectionSummary(results []injectionResult, source templateSourcePayload, scopeLabel string, dryRun bool) {
	ok := 0
	for _, result := range results {
		if result.OK {
			ok++
		}
	}
	total := len(results)

	if source.Source == "remote" && source.Version != "" {
		fmt.Fprintln(os.Stdout, bold(fmt.Sprintf("Templates: remote (%s)", source.Version)))
	} else if source.FallbackReason != "" {
		fmt.Fprintln(os.Stdout, yellow(fmt.Sprintf("Templates: bundled (fallback: %s)", source.FallbackReason)))
	} else {
		fmt.Fprintln(os.Stdout, yellow("Templates: bundled"))
	}
	fmt.Fprintln(os.Stdout)

	for _, result := range results {
		status := green("OK")
		if !result.OK {
			status = red("FAIL")
		}
		padding := 24 - len(result.DisplayName)
		if padding < 1 {
			padding = 1
		}
		fmt.Fprintf(os.Stdout, "  %s%s%s   %s\n", result.DisplayName, strings.Repeat(" ", padding), result.Scope, status)
		if !result.OK {
			fmt.Fprintf(os.Stdout, "    %s\n", red(result.Error))
		}
	}

	fmt.Fprintln(os.Stdout)
	if ok == total {
		label := "platforms"
		if total == 1 {
			label = "platform"
		}
		if dryRun {
			fmt.Fprintln(os.Stdout, bold(fmt.Sprintf("Would configure %d %s (%s)", total, label, scopeLabel)))
		} else {
			fmt.Fprintln(os.Stdout, bold(fmt.Sprintf("%d %s configured (%s)", total, label, scopeLabel)))
		}
	} else if dryRun {
		fmt.Fprintln(os.Stdout, bold(fmt.Sprintf("Would configure %d/%d platforms (%s)", ok, total, scopeLabel)))
	} else {
		fmt.Fprintln(os.Stdout, bold(fmt.Sprintf("%d/%d platforms configured (%s)", ok, total, scopeLabel)))
	}
}

func timestamp() string {
	return time.Now().UTC().Format("2006-01-02T15-04-05.000Z")
}

func stdinIsTerminal() bool {
	return cmdr.IsTerminal(os.Stdin)
}
