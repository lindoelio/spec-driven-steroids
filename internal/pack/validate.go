package pack

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// The marketplace names the violations are reported under.
const (
	portableMarketplace = "portable"
	treeMarketplace     = "tree"
	catalogMarketplace  = "catalogs"
)

// nativeBinaryExtensions are the extensions a native binary carries.
var nativeBinaryExtensions = []string{".exe", ".dll", ".so", ".dylib", ".node"}

// The patterns the vendor schemas require.
var (
	// miniMaxNamePattern is the plugin name pattern of the MiniMax manifest.
	miniMaxNamePattern = regexp.MustCompile(`^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`)
	// cursorNamePattern is the plugin name pattern of the Cursor manifest.
	cursorNamePattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$`)
	// semverPattern is the version pattern of the vendor manifests.
	semverPattern = regexp.MustCompile(`^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$`)
)

// Validate checks the rendered tree against every marketplace layout and
// reports each violation.
//
// Every violation names the marketplace and the rule it breaks. The returned
// error is set only when the tree itself could not be read.
func Validate(outDir string) ([]string, error) {
	if strings.TrimSpace(outDir) == "" {
		return nil, fmt.Errorf("pack: the distribution tree directory is required")
	}

	info, err := os.Stat(outDir)
	if err != nil {
		return nil, fmt.Errorf("pack: read the distribution tree: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("pack: %s is not a directory", outDir)
	}

	var violations []string
	violations = append(violations, validateTreeContent(outDir)...)
	violations = append(violations, validatePortable(outDir)...)
	violations = append(violations, validateClaudeCode(outDir)...)
	violations = append(violations, validateCodex(outDir)...)
	violations = append(violations, validateCursor(outDir)...)
	violations = append(violations, validateMiniMax(outDir)...)
	violations = append(violations, validateGemini(outDir)...)
	violations = append(violations, validateCatalogs(outDir)...)

	return violations, nil
}

// violation formats one rule violation.
func violation(marketplace, format string, args ...any) string {
	return marketplace + ": " + fmt.Sprintf(format, args...)
}

// validateTreeContent rejects a tree that holds a symbolic link or a native
// binary, and a file that is not a regular file.
func validateTreeContent(outDir string) []string {
	var violations []string

	err := filepath.WalkDir(outDir, func(current string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if current == outDir {
			return nil
		}

		relative, relErr := filepath.Rel(outDir, current)
		if relErr != nil {
			relative = current
		}
		relative = filepath.ToSlash(relative)

		if entry.Type()&fs.ModeSymlink != 0 {
			violations = append(violations, violation(treeMarketplace, "%s is a symbolic link", relative))
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		if !entry.Type().IsRegular() {
			violations = append(violations, violation(treeMarketplace, "%s is not a regular file", relative))
			return nil
		}

		native, readErr := isNativeBinary(current)
		if readErr != nil {
			violations = append(violations, violation(treeMarketplace, "%s could not be read: %v", relative, readErr))
			return nil
		}
		if native {
			violations = append(violations, violation(treeMarketplace, "%s is a native binary", relative))
		}
		return nil
	})
	if err != nil {
		violations = append(violations, violation(treeMarketplace, "the tree could not be read: %v", err))
	}

	return violations
}

// isNativeBinary reports whether a file is a native binary.
//
// A file is a native binary when it carries the extension of one or when its
// content is not text.
func isNativeBinary(path string) (bool, error) {
	extension := strings.ToLower(filepath.Ext(path))
	for _, candidate := range nativeBinaryExtensions {
		if extension == candidate {
			return true, nil
		}
	}

	file, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer file.Close()

	buffer := make([]byte, 512)
	read, err := file.Read(buffer)
	if err != nil && read == 0 {
		return false, nil
	}
	contentType := http.DetectContentType(buffer[:read])
	if strings.HasPrefix(contentType, "text/") || contentType == "application/json" {
		return false, nil
	}
	return true, nil
}

// validatePortable checks the portable package: the manifest, the skills tree
// and the reference of every packaged skill.
func validatePortable(outDir string) []string {
	var violations []string

	object, err := readObject(filepath.Join(outDir, filepath.FromSlash(PortableManifestPath)))
	if err != nil {
		if os.IsNotExist(err) {
			return append(violations, violation(portableMarketplace, "%s is missing", PortableManifestPath))
		}
		return append(violations, violation(portableMarketplace, "%s is not a readable JSON object: %v", PortableManifestPath, err))
	}

	if schema := stringField(object, "$schema"); schema != SchemaIdentifier {
		violations = append(violations, violation(portableMarketplace,
			"%s declares the schema %q, expected %q", PortableManifestPath, schema, SchemaIdentifier))
	}
	if strings.TrimSpace(stringField(object, "name")) == "" {
		violations = append(violations, violation(portableMarketplace, "%s declares no name", PortableManifestPath))
	}
	if strings.TrimSpace(stringField(object, "description")) == "" {
		violations = append(violations, violation(portableMarketplace, "%s declares no description", PortableManifestPath))
	}
	if strings.TrimSpace(stringField(object, "version")) == "" {
		violations = append(violations, violation(portableMarketplace, "%s declares no version", PortableManifestPath))
	}

	packaged := packagedSkills(outDir)
	if len(packaged) == 0 {
		violations = append(violations, violation(portableMarketplace,
			"the package holds no skill directory below %s/", canonicalSkillsDir))
	}

	references, ok := arrayField(object, "skills")
	if !ok {
		return append(violations, violation(portableMarketplace, "%s declares no skills array", PortableManifestPath))
	}

	referenced := map[string]bool{}
	for _, reference := range references {
		text, isText := reference.(string)
		if !isText || strings.TrimSpace(text) == "" {
			violations = append(violations, violation(portableMarketplace,
				"%s declares a skill that is not a path", PortableManifestPath))
			continue
		}
		cleaned := path.Clean(text)
		referenced[cleaned] = true
		if !existsInside(outDir, cleaned) {
			violations = append(violations, violation(portableMarketplace,
				"%s references the skill %q, which the package does not hold", PortableManifestPath, text))
		}
	}

	for _, skill := range packaged {
		if !referenced[path.Join(canonicalSkillsDir, skill)] {
			violations = append(violations, violation(portableMarketplace,
				"%s does not reference the packaged skill %q", PortableManifestPath, skill))
		}
	}

	return violations
}

// packagedSkills returns the skill directory names the tree holds.
func packagedSkills(outDir string) []string {
	entries, err := os.ReadDir(filepath.Join(outDir, filepath.FromSlash(canonicalSkillsDir)))
	if err != nil {
		return nil
	}

	var skills []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		skill := filepath.Join(outDir, filepath.FromSlash(canonicalSkillsDir), entry.Name(), skillFile)
		if info, err := os.Stat(skill); err != nil || info.IsDir() {
			continue
		}
		skills = append(skills, entry.Name())
	}
	sort.Strings(skills)
	return skills
}

// manifestRules holds the requirements of one vendor plugin manifest.
type manifestRules struct {
	// requireDescription demands a description.
	requireDescription bool
	// requireInterface demands an interface object with a display name.
	requireInterface bool
	// namePattern demands a name of a specific shape.
	namePattern *regexp.Regexp
}

// validateClaudeCode checks the Claude Code manifest and catalog.
func validateClaudeCode(outDir string) []string {
	violations := validatePluginManifest(outDir, MarketplaceClaudeCode, ClaudeManifestPath, manifestRules{
		requireDescription: true,
	})
	violations = append(violations, validateCatalog(outDir, MarketplaceClaudeCode, ClaudeCatalogPath)...)
	return violations
}

// validateCodex checks the Codex manifest and the catalog it reads.
func validateCodex(outDir string) []string {
	violations := validatePluginManifest(outDir, MarketplaceCodex, CodexManifestPath, manifestRules{
		requireDescription: true,
		requireInterface:   true,
	})
	violations = append(violations, validateCatalog(outDir, MarketplaceCodex, CodexCatalogPath)...)

	claude, err := os.ReadFile(filepath.Join(outDir, filepath.FromSlash(ClaudeCatalogPath)))
	if err != nil {
		return append(violations, violation(MarketplaceCodex,
			"the shared catalog %s could not be read: %v", ClaudeCatalogPath, err))
	}
	codex, err := os.ReadFile(filepath.Join(outDir, filepath.FromSlash(CodexCatalogPath)))
	if err != nil {
		return append(violations, violation(MarketplaceCodex,
			"the shared catalog %s could not be read: %v", CodexCatalogPath, err))
	}
	if string(claude) != string(codex) {
		violations = append(violations, violation(MarketplaceCodex,
			"the catalog %s does not carry the same content as the shared catalog %s", CodexCatalogPath, ClaudeCatalogPath))
	}
	return violations
}

// validateCursor checks the Cursor manifest and catalog.
func validateCursor(outDir string) []string {
	violations := validatePluginManifest(outDir, MarketplaceCursor, CursorManifestPath, manifestRules{
		requireDescription: true,
		namePattern:        cursorNamePattern,
	})
	violations = append(violations, validateCatalog(outDir, MarketplaceCursor, CursorCatalogPath)...)
	return violations
}

// validatePluginManifest checks a vendor plugin manifest.
func validatePluginManifest(outDir, marketplace, manifestPath string, rules manifestRules) []string {
	var violations []string

	object, err := readObject(filepath.Join(outDir, filepath.FromSlash(manifestPath)))
	if err != nil {
		if os.IsNotExist(err) {
			return append(violations, violation(marketplace, "%s is missing", manifestPath))
		}
		return append(violations, violation(marketplace, "%s is not a readable JSON object: %v", manifestPath, err))
	}

	name := stringField(object, "name")
	if strings.TrimSpace(name) == "" {
		violations = append(violations, violation(marketplace, "%s declares no name", manifestPath))
	} else if rules.namePattern != nil && !rules.namePattern.MatchString(name) {
		violations = append(violations, violation(marketplace, "%s declares the name %q, which the schema does not allow", manifestPath, name))
	}

	if rules.requireDescription && strings.TrimSpace(stringField(object, "description")) == "" {
		violations = append(violations, violation(marketplace, "%s declares no description", manifestPath))
	}
	if strings.TrimSpace(stringField(object, "version")) == "" {
		violations = append(violations, violation(marketplace, "%s declares no version", manifestPath))
	}

	if skills := strings.TrimSpace(stringField(object, "skills")); skills != "" && !existsInside(outDir, path.Clean(skills)) {
		violations = append(violations, violation(marketplace,
			"%s declares the skills path %q, which the package does not hold", manifestPath, skills))
	}
	if servers := strings.TrimSpace(stringField(object, "mcpServers")); servers != "" && !existsInside(outDir, path.Clean(servers)) {
		violations = append(violations, violation(marketplace,
			"%s declares the MCP path %q, which the package does not hold", manifestPath, servers))
	}

	if rules.requireInterface {
		interfaceObject, ok := object["interface"].(map[string]any)
		if !ok {
			violations = append(violations, violation(marketplace, "%s declares no interface object", manifestPath))
		} else if strings.TrimSpace(stringField(interfaceObject, "displayName")) == "" {
			violations = append(violations, violation(marketplace, "%s declares no interface display name", manifestPath))
		}
	}

	return violations
}

// validateMiniMax checks the MiniMax Code manifest and the package subtree
// the community registry takes.
func validateMiniMax(outDir string) []string {
	var violations []string

	object, err := readObject(filepath.Join(outDir, filepath.FromSlash(MiniMaxManifestPath)))
	if err != nil {
		if os.IsNotExist(err) {
			violations = append(violations, violation(MarketplaceMiniMax, "%s is missing", MiniMaxManifestPath))
		} else {
			violations = append(violations, violation(MarketplaceMiniMax,
				"%s is not a readable JSON object: %v", MiniMaxManifestPath, err))
		}
	} else {
		violations = append(violations, validateMiniMaxManifest(outDir, object)...)
	}

	violations = append(violations, validateMiniMaxSubtree(outDir)...)
	return violations
}

// validateMiniMaxManifest checks the fields the MiniMax submission requires.
func validateMiniMaxManifest(outDir string, object map[string]any) []string {
	var violations []string

	version, ok := object["schemaVersion"].(float64)
	if !ok || version != 1 {
		violations = append(violations, violation(MarketplaceMiniMax,
			"%s declares the schema version %v, expected 1", MiniMaxManifestPath, object["schemaVersion"]))
	}

	name := strings.TrimSpace(stringField(object, "name"))
	if name == "" {
		violations = append(violations, violation(MarketplaceMiniMax, "%s declares no name", MiniMaxManifestPath))
	} else if !miniMaxNamePattern.MatchString(name) {
		violations = append(violations, violation(MarketplaceMiniMax,
			"%s declares the name %q, which the schema does not allow", MiniMaxManifestPath, name))
	}

	if strings.TrimSpace(stringField(object, "displayName")) == "" {
		violations = append(violations, violation(MarketplaceMiniMax, "%s declares no display name", MiniMaxManifestPath))
	}

	pluginVersion := strings.TrimSpace(stringField(object, "version"))
	if pluginVersion == "" {
		violations = append(violations, violation(MarketplaceMiniMax, "%s declares no version", MiniMaxManifestPath))
	} else if !semverPattern.MatchString(pluginVersion) {
		violations = append(violations, violation(MarketplaceMiniMax,
			"%s declares the version %q, which is not a semantic version", MiniMaxManifestPath, pluginVersion))
	}

	for _, field := range []string{"description", "author", "icon", "category"} {
		if strings.TrimSpace(stringField(object, field)) == "" {
			violations = append(violations, violation(MarketplaceMiniMax,
				"%s declares no %s", MiniMaxManifestPath, field))
		}
	}

	for _, field := range []string{"apps", "mcpServers", "skills"} {
		values, ok := arrayField(object, field)
		if !ok {
			violations = append(violations, violation(MarketplaceMiniMax,
				"%s declares no %s array", MiniMaxManifestPath, field))
			continue
		}
		for _, value := range values {
			reference, isText := value.(string)
			if !isText || strings.TrimSpace(reference) == "" {
				violations = append(violations, violation(MarketplaceMiniMax,
					"%s declares a %s entry that is not a path", MiniMaxManifestPath, field))
				continue
			}
			if !existsInside(outDir, path.Clean(reference)) {
				violations = append(violations, violation(MarketplaceMiniMax,
					"%s references the %s file %q, which the package does not hold", MiniMaxManifestPath, field, reference))
			}
		}
	}

	return violations
}

// validateMiniMaxSubtree checks the package subtree of the MiniMax community
// registry.
func validateMiniMaxSubtree(outDir string) []string {
	var violations []string

	owners, err := os.ReadDir(filepath.Join(outDir, filepath.FromSlash(pluginsDir)))
	if err != nil {
		return append(violations, violation(MarketplaceMiniMax,
			"the package subtree %s is missing", MiniMaxRegistryPath))
	}

	var subtrees []string
	for _, owner := range owners {
		if !owner.IsDir() {
			continue
		}
		packages, err := os.ReadDir(filepath.Join(outDir, filepath.FromSlash(pluginsDir), owner.Name()))
		if err != nil {
			continue
		}
		for _, candidate := range packages {
			if candidate.IsDir() {
				subtrees = append(subtrees, path.Join(pluginsDir, owner.Name(), candidate.Name()))
			}
		}
	}

	if len(subtrees) == 0 {
		return append(violations, violation(MarketplaceMiniMax,
			"the package subtree %s is missing", MiniMaxRegistryPath))
	}
	if len(subtrees) > 1 {
		sort.Strings(subtrees)
		return append(violations, violation(MarketplaceMiniMax,
			"the tree holds %d package subtrees, expected one", len(subtrees)))
	}

	subtree := subtrees[0]
	object, err := readObject(filepath.Join(outDir, filepath.FromSlash(path.Join(subtree, PortableManifestPath))))
	if err != nil {
		return append(violations, violation(MarketplaceMiniMax,
			"the package subtree %s holds no readable %s", subtree, PortableManifestPath))
	}
	if schema := stringField(object, "$schema"); schema != SchemaIdentifier {
		violations = append(violations, violation(MarketplaceMiniMax,
			"the package subtree %s holds a manifest that declares the schema %q, expected %q", subtree, schema, SchemaIdentifier))
	}
	if strings.TrimSpace(stringField(object, "name")) == "" {
		violations = append(violations, violation(MarketplaceMiniMax,
			"the package subtree %s holds a manifest that declares no name", subtree))
	}
	if !existsInside(outDir, path.Join(subtree, canonicalSkillsDir)) {
		violations = append(violations, violation(MarketplaceMiniMax,
			"the package subtree %s holds no %s directory", subtree, canonicalSkillsDir))
	}

	return violations
}

// validateGemini checks the Gemini CLI extension manifest, which belongs at
// the absolute root of the distribution tree.
func validateGemini(outDir string) []string {
	var violations []string

	object, err := readObject(filepath.Join(outDir, filepath.FromSlash(GeminiManifestPath)))
	if err != nil {
		if os.IsNotExist(err) {
			return append(violations, violation(MarketplaceGemini,
				"%s is missing at the root of the distribution tree", GeminiManifestPath))
		}
		return append(violations, violation(MarketplaceGemini,
			"%s is not a readable JSON object: %v", GeminiManifestPath, err))
	}

	if strings.TrimSpace(stringField(object, "name")) == "" {
		violations = append(violations, violation(MarketplaceGemini, "%s declares no name", GeminiManifestPath))
	}
	if strings.TrimSpace(stringField(object, "version")) == "" {
		violations = append(violations, violation(MarketplaceGemini, "%s declares no version", GeminiManifestPath))
	}
	if strings.TrimSpace(stringField(object, "description")) == "" {
		violations = append(violations, violation(MarketplaceGemini, "%s declares no description", GeminiManifestPath))
	}

	return violations
}

// catalogFacts holds what the catalogs have to agree on.
type catalogFacts struct {
	// source is the package directory the catalog references.
	source string
	// version is the package version the catalog references.
	version string
}

// validateCatalog checks one marketplace catalog.
func validateCatalog(outDir, marketplace, catalogPath string) []string {
	var violations []string

	object, err := readObject(filepath.Join(outDir, filepath.FromSlash(catalogPath)))
	if err != nil {
		if os.IsNotExist(err) {
			return append(violations, violation(marketplace, "the catalog %s is missing", catalogPath))
		}
		return append(violations, violation(marketplace, "the catalog %s is not a readable JSON object: %v", catalogPath, err))
	}

	if strings.TrimSpace(stringField(object, "name")) == "" {
		violations = append(violations, violation(marketplace, "the catalog %s declares no name", catalogPath))
	}

	owner, ok := object["owner"].(map[string]any)
	if !ok {
		violations = append(violations, violation(marketplace, "the catalog %s declares no owner object", catalogPath))
	} else if strings.TrimSpace(stringField(owner, "name")) == "" {
		violations = append(violations, violation(marketplace, "the catalog %s declares an owner without a name", catalogPath))
	}

	plugins, ok := arrayField(object, "plugins")
	if !ok || len(plugins) == 0 {
		return append(violations, violation(marketplace, "the catalog %s declares no plugin", catalogPath))
	}

	for _, entry := range plugins {
		plugin, isObject := entry.(map[string]any)
		if !isObject {
			violations = append(violations, violation(marketplace,
				"the catalog %s declares a plugin that is not an object", catalogPath))
			continue
		}
		if strings.TrimSpace(stringField(plugin, "name")) == "" {
			violations = append(violations, violation(marketplace,
				"the catalog %s declares a plugin without a name", catalogPath))
		}
		source := strings.TrimSpace(stringField(plugin, "source"))
		if source == "" {
			violations = append(violations, violation(marketplace,
				"the catalog %s declares a plugin without a source", catalogPath))
			continue
		}
		if !existsInside(outDir, path.Clean(source)) {
			violations = append(violations, violation(marketplace,
				"the catalog %s references the package directory %q, which the tree does not hold", catalogPath, source))
		}
	}

	return violations
}

// validateCatalogs checks that every catalog references the same package
// directory and the same package version.
func validateCatalogs(outDir string) []string {
	var violations []string

	type catalogEntry struct {
		path  string
		facts catalogFacts
	}

	var entries []catalogEntry
	for _, catalogPath := range catalogPaths() {
		object, err := readObject(filepath.Join(outDir, filepath.FromSlash(catalogPath)))
		if err != nil {
			continue
		}
		plugins, ok := arrayField(object, "plugins")
		if !ok || len(plugins) == 0 {
			continue
		}
		plugin, isObject := plugins[0].(map[string]any)
		if !isObject {
			continue
		}
		entries = append(entries, catalogEntry{
			path: catalogPath,
			facts: catalogFacts{
				source:  stringField(plugin, "source"),
				version: stringField(plugin, "version"),
			},
		})
	}

	if len(entries) < 2 {
		return violations
	}

	reference := entries[0]
	for _, entry := range entries[1:] {
		if entry.facts.source != reference.facts.source {
			violations = append(violations, violation(catalogMarketplace,
				"the catalog %s references the package directory %q, while %s references %q",
				entry.path, entry.facts.source, reference.path, reference.facts.source))
		}
		if entry.facts.version != reference.facts.version {
			violations = append(violations, violation(catalogMarketplace,
				"the catalog %s references the package version %q, while %s references %q",
				entry.path, entry.facts.version, reference.path, reference.facts.version))
		}
	}

	return violations
}

// readObject reads a JSON object from a path.
func readObject(path string) (map[string]any, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err != nil {
		return nil, err
	}
	if object == nil {
		return nil, fmt.Errorf("the document is not a JSON object")
	}
	return object, nil
}

// stringField returns a string field of a JSON object.
func stringField(object map[string]any, key string) string {
	value, _ := object[key].(string)
	return value
}

// arrayField returns an array field of a JSON object.
func arrayField(object map[string]any, key string) ([]any, bool) {
	value, ok := object[key].([]any)
	return value, ok
}

// existsInside reports whether the tree holds a path.
//
// A path that leaves the tree, or a remote source, never resolves.
func existsInside(outDir, reference string) bool {
	cleaned := path.Clean(strings.TrimPrefix(strings.TrimSpace(reference), "./"))
	if cleaned == "." {
		return true
	}
	if path.IsAbs(cleaned) || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return false
	}

	info, err := os.Stat(filepath.Join(outDir, filepath.FromSlash(cleaned)))
	if err != nil {
		return false
	}
	return info.IsDir() || info.Mode().IsRegular()
}
