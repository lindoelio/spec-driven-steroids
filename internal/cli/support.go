package cli

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/lindoelio/spec-driven-steroids/internal/bundle"
	"github.com/lindoelio/spec-driven-steroids/internal/cleanup"
	"github.com/lindoelio/spec-driven-steroids/internal/config"
	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
	"github.com/lindoelio/spec-driven-steroids/internal/emit"
	"github.com/lindoelio/spec-driven-steroids/internal/manifest"
	"github.com/lindoelio/spec-driven-steroids/internal/version"
)

// reported marks a failure whose diagnostic was already printed. The entry
// point returns its code without printing anything else.
type reported struct {
	code int
}

// Error implements the error interface. The diagnostic was already printed,
// so the message is empty.
func (e reported) Error() string { return "" }

// usageError reports a usage problem and returns the error that stops the
// command.
func usageError(message string) error {
	fmt.Fprintln(os.Stderr, red(message))
	setExitCode(2)
	return reported{code: 2}
}

// isReported reports whether a failure was already reported.
func isReported(err error) bool {
	_, ok := reportedCode(err)
	return ok
}

// reportedCode returns the exit code of a failure that was already reported.
func reportedCode(err error) (int, bool) {
	var value reported
	if !errors.As(err, &value) {
		return 0, false
	}
	return value.code, true
}

// resolveTemplateSource resolves the template source and returns it together
// with the tree it carries.
//
// The remote bundle is used when it is available and compatible; otherwise
// the embedded tree takes over and the reason is reported.
func resolveTemplateSource(ctx context.Context, resolver config.Resolver, selection string) (templateSourcePayload, fs.FS) {
	source, err := bundle.Resolve(ctx, bundle.ResolveOptions{
		Source:         selection,
		CacheDir:       resolver.CacheDir(),
		CLIVersion:     version.String(),
		RequiredSkills: bundle.RequiredSkills(),
	})
	if err != nil {
		fallback := templateSourcePayload{
			Source:         "bundled",
			Version:        version.String(),
			FallbackReason: err.Error(),
			Warnings:       []string{},
		}
		if typed, ok := err.(*bundle.Error); ok {
			fallback.ErrorKind = typed.Kind
		}
		return fallback, bundle.BundledFS()
	}

	payload := templateSourcePayload{
		Source:         source.Source,
		Version:        source.Version,
		RootDir:        source.RootDir,
		FallbackReason: source.FallbackReason,
		ErrorKind:      source.ErrorKind,
		SHA256:         source.SHA256,
		Warnings:       source.Warnings,
	}
	if payload.Warnings == nil {
		payload.Warnings = []string{}
	}
	return payload, source.FS
}

// resolveBundledSource describes the embedded template source.
func resolveBundledSource() templateSourcePayload {
	payload, _ := resolveTemplateSource(context.Background(), config.Default(), "bundled")
	return payload
}

// registryVariantPath resolves a named path variant of a platform.
func registryVariantPath(desc *descriptor.Descriptor, env descriptor.Env, scope, name string) (string, bool) {
	registry, err := descriptor.Load()
	if err != nil {
		return "", false
	}
	return registry.VariantPath(env, desc, name, scope)
}

// backupInstallation copies the recorded paths of an installation.
func backupInstallation(store *manifest.Store, registry *descriptor.Registry, env descriptor.Env, scope, platform, projectRoot, destination string) ([]string, error) {
	return cleanup.Backup(store, registry, env, scope, platform, projectRoot, destination, manifest.CleanOptions{})
}

// runPostInjectAction applies one declared post-injection action.
//
// These actions are the sanctioned exception to the ownership rule: they
// touch the user's own configuration rather than an injected artifact, so
// their effects stay out of the install manifests.
func runPostInjectAction(action descriptor.PostInjectAction, desc *descriptor.Descriptor, scope string, resolver config.Resolver, env descriptor.Env, registry *descriptor.Registry) error {
	switch action.Action {
	case descriptor.ActionFlattenVSCodePrompts:
		root, ok := registry.VariantPath(env, desc, "root", scope)
		if !ok {
			return nil
		}
		return flattenPromptFiles(root)
	case descriptor.ActionRemoveCodexLegacy:
		root, ok := registry.VariantPath(env, desc, "root", scope)
		if !ok {
			return nil
		}
		directory := action.Target
		if directory == "" {
			directory = "commands"
		}
		for _, name := range []string{"spec-driven.md", "inject-guidelines.md"} {
			path := filepath.Join(root, directory, name)
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				return err
			}
		}
		return nil
	case descriptor.ActionOpenCodeConfigWrite:
		name := action.Target
		if name == "" {
			name = "opencode.json"
		}
		path := filepath.Join(resolver.WorkDir, name)
		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		var config map[string]any
		if err := json.Unmarshal(content, &config); err != nil {
			return nil
		}
		if _, ok := config["$schema"]; ok {
			return nil
		}
		config["$schema"] = "https://opencode.ai/config.json"
		updated, err := json.MarshalIndent(config, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(path, append(updated, '\n'), 0o644)
	}
	return nil
}

// flattenPromptFiles moves the prompt files of a platform root into the root
// itself, the way the VS Code prompt directory expects.
func flattenPromptFiles(root string) error {
	for _, subDir := range []string{"agents", "prompts"} {
		source := filepath.Join(root, subDir)
		entries, err := os.ReadDir(source)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			from := filepath.Join(source, entry.Name())
			to := filepath.Join(root, entry.Name())
			if err := os.Rename(from, to); err != nil {
				return err
			}
		}
		remaining, err := os.ReadDir(source)
		if err == nil && len(remaining) == 0 {
			_ = os.Remove(source)
		}
	}
	return nil
}

// resolveFlattenedPaths returns the paths the flattened prompts occupy.
func resolveFlattenedPaths(root string, written []string) []string {
	return emit.FlattenedPaths(root, written)
}
