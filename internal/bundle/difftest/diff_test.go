package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// TestDifferentialAgainstTheOracle runs every shared case against the port
// and against the previous release, and reports every difference.
func TestDifferentialAgainstTheOracle(t *testing.T) {
	here := sourceDirectory()

	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node is not installed")
	}
	if _, err := os.Stat(filepath.Join(here, "../../../packages/cli/dist/cli/template-bundle.js")); err != nil {
		t.Skip("the previous release is not built")
	}

	cases, err := loadCases(filepath.Join(here, "cases.json"))
	if err != nil {
		t.Fatalf("load cases: %v", err)
	}

	matched, differences, err := runHarness(cases, "node", filepath.Join(here, "oracle.mjs"), filepath.Join(here, "cases.json"))
	if err != nil {
		t.Fatalf("harness: %v", err)
	}

	for _, difference := range differences {
		t.Errorf("%s\n  port:   %s\n  oracle: %s", difference.name, difference.port, difference.oracle)
	}
	if matched != len(cases) {
		t.Fatalf("matched %d of %d cases", matched, len(cases))
	}
	t.Logf("%d cases matched the previous release", matched)
}
