package emit

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lindoelio/spec-driven-steroids/internal/descriptor"
)

// artifactFixture is a captured platform fixture.
type artifactFixture struct {
	Platform string `json:"platform"`
	Scope    string `json:"scope"`
	Native   bool   `json:"native"`
	Roots    struct {
		Root   string `json:"root"`
		Skills string `json:"skills"`
	} `json:"roots"`
	Files []struct {
		Root    string `json:"root"`
		Path    string `json:"path"`
		SHA256  string `json:"sha256"`
		Bytes   int    `json:"bytes"`
		Content string `json:"content"`
	} `json:"files"`
}

// TestAgainstTheCapturedFixtures compares the platform-side artifacts with the
// captured fixtures.
//
// The fixtures are the contract the rewrite is checked against: they record
// the paths and the bytes the shipped implementation produces.
//
// A platform whose root is the artifact root reads the canonical tree
// directly, so the canonical skills it receives are the ones the artifact root
// holds rather than copies of them. Those entries are compared through the
// canonical tree; the artifacts the platform adds beside them are compared
// here, because a platform that reads the artifact root still needs its own
// derived skills.
func TestAgainstTheCapturedFixtures(t *testing.T) {
	directory := filepath.Join("..", "testdata", "fixtures", "artifacts")
	entries, err := os.ReadDir(directory)
	if err != nil {
		t.Skipf("the captured fixtures are not available: %v", err)
	}

	registry, err := descriptor.Load()
	if err != nil {
		t.Fatalf("load the descriptors: %v", err)
	}

	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".json") || entry.Name() == "canonical-tree.json" {
			continue
		}
		name := entry.Name()
		t.Run(strings.TrimSuffix(name, ".json"), func(t *testing.T) {
			raw, err := os.ReadFile(filepath.Join(directory, name))
			if err != nil {
				t.Fatalf("read the fixture: %v", err)
			}
			var fixture artifactFixture
			if err := json.Unmarshal(raw, &fixture); err != nil {
				t.Fatalf("parse the fixture: %v", err)
			}
			if fixture.Native {
				t.Log("the platform reads the artifact root directly")
			}

			desc, ok := registry.Get(fixture.Platform)
			if !ok {
				t.Fatalf("the platform %q is unknown", fixture.Platform)
			}

			workDir := t.TempDir()
			homeDir := t.TempDir()
			env := descriptor.Env{Home: homeDir, WorkDir: workDir, Vars: map[string]string{}, OS: "linux"}
			base := workDir
			if fixture.Scope == "global" {
				base = homeDir
			}

			rootPath := filepath.Join(base, fixture.Roots.Root)
			skillsPath := filepath.Join(base, fixture.Roots.Skills)

			artifactRoot := filepath.Join(workDir, ".agents")
			if fixture.Scope == "global" {
				artifactRoot = filepath.Join(homeDir, ".agents")
			}

			plan, err := Build(desc, Options{
				Registry:     registry,
				Env:          env,
				Scope:        fixture.Scope,
				ArtifactRoot: artifactRoot,
			})
			if err != nil {
				t.Fatalf("build the plan: %v", err)
			}

			expected := map[string]string{}
			for _, file := range fixture.Files {
				expected[file.Root+"/"+file.Path] = file.SHA256
			}

			// A platform that reads the artifact root receives the canonical
			// skills from the artifact root itself. Those entries are not
			// platform-side artifacts, so they are compared through the
			// canonical tree instead.
			canonicalSkills := map[string]bool{}
			for _, file := range plan.Canonical {
				if strings.HasPrefix(file.RelPath, "skills/") {
					canonicalSkills["skills/"+strings.TrimPrefix(file.RelPath, "skills/")] = true
				}
			}
			if fixture.Native {
				for key := range canonicalSkills {
					delete(expected, key)
				}
			}

			artifactPaths := make([]string, 0, len(plan.Platform))
			for _, artifact := range plan.Platform {
				artifactPaths = append(artifactPaths, artifact.Path)
			}
			if flattensPrompts(desc, fixture.Scope) {
				artifactPaths = FlattenedPaths(rootPath, artifactPaths)
			}

			actual := map[string]string{}
			for index, artifact := range plan.Platform {
				key, ok := classify(artifactPaths[index], rootPath, skillsPath)
				if !ok {
					t.Errorf("the artifact %q is outside both declared roots", artifact.Path)
					continue
				}
				actual[key] = sha256Hex(artifact.Content)
			}

			for key, digest := range expected {
				got, ok := actual[key]
				if !ok {
					t.Errorf("the implementation does not write %q", key)
					continue
				}
				if got != digest {
					t.Errorf("the content of %q differs from the captured fixture", key)
				}
			}
			for key := range actual {
				if _, ok := expected[key]; !ok {
					t.Errorf("the implementation writes %q, which the fixture does not record", key)
				}
			}
		})
	}
}

// classify returns the root an artifact belongs to and its path below it.
func classify(artifactPath, rootPath, skillsPath string) (string, bool) {
	if relative, err := filepath.Rel(skillsPath, artifactPath); err == nil && !strings.HasPrefix(relative, "..") {
		return "skills/" + filepath.ToSlash(relative), true
	}
	if relative, err := filepath.Rel(rootPath, artifactPath); err == nil && !strings.HasPrefix(relative, "..") {
		return "root/" + filepath.ToSlash(relative), true
	}
	return "", false
}

func sha256Hex(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
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
