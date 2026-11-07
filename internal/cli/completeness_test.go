package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// repositoryRoot returns the root of the repository, which the evidence
// paths of the manifest are relative to.
func repositoryRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatalf("resolve the repository root: %v", err)
	}
	return root
}

// completenessManifest is the recorded coverage of every acceptance criterion.
type completenessManifest struct {
	Criteria []struct {
		Criterion string   `json:"criterion"`
		CoveredBy []string `json:"coveredBy"`
		Absent    []string `json:"absent"`
	} `json:"criteria"`
	CommandSurface []struct {
		Command string `json:"command"`
		Fixture string `json:"fixture"`
	} `json:"commandSurface"`
	Report struct {
		Criteria       int      `json:"criteria"`
		Covered        int      `json:"covered"`
		Missing        []string `json:"missing"`
		AbsentEvidence []string `json:"absentEvidence"`
		AbsentFixtures []string `json:"absentFixtures"`
	} `json:"report"`
}

// TestTheFixtureCompletenessManifestIsComplete gates the removal of the
// TypeScript implementation.
//
// Every acceptance criterion has to point at evidence that outlives the
// oracle, and every evidence file has to exist. The manifest is the gate.
func TestTheFixtureCompletenessManifestIsComplete(t *testing.T) {
	path := filepath.Join("..", "testdata", "fixtures", "completeness.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read the completeness manifest: %v", err)
	}

	var manifest completenessManifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatalf("parse the completeness manifest: %v", err)
	}

	if len(manifest.Criteria) == 0 {
		t.Fatal("the completeness manifest records no criterion")
	}
	if manifest.Report.Criteria != len(manifest.Criteria) {
		t.Errorf("the manifest reports %d criteria but records %d", manifest.Report.Criteria, len(manifest.Criteria))
	}
	if manifest.Report.Covered != len(manifest.Criteria) {
		t.Errorf("only %d of %d criteria are covered", manifest.Report.Covered, len(manifest.Criteria))
	}
	if len(manifest.Report.Missing) > 0 {
		t.Errorf("the manifest reports uncovered criteria: %v", manifest.Report.Missing)
	}
	if len(manifest.Report.AbsentEvidence) > 0 {
		t.Errorf("the manifest reports criteria whose evidence is absent: %v", manifest.Report.AbsentEvidence)
	}
	if len(manifest.Report.AbsentFixtures) > 0 {
		t.Errorf("the manifest reports absent fixtures: %v", manifest.Report.AbsentFixtures)
	}

	for _, entry := range manifest.Criteria {
		if len(entry.CoveredBy) == 0 {
			t.Errorf("the criterion %s points at no evidence", entry.Criterion)
		}
		for _, file := range entry.CoveredBy {
			if _, err := os.Stat(filepath.Join(repositoryRoot(t), file)); err != nil {
				t.Errorf("the criterion %s points at a missing file: %s", entry.Criterion, file)
			}
		}
	}

	for _, item := range manifest.CommandSurface {
		if item.Fixture == "" {
			t.Errorf("the command surface item %s points at no fixture", item.Command)
			continue
		}
		if _, err := os.Stat(filepath.Join(repositoryRoot(t), item.Fixture)); err != nil {
			t.Errorf("the command surface item %s points at a missing fixture: %s", item.Command, item.Fixture)
		}
	}
}
