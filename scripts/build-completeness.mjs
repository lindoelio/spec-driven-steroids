#!/usr/bin/env node
/**
 * Emits the fixture completeness manifest.
 *
 * The manifest lists one entry per acceptance criterion and per command
 * surface item. An entry points at a recorded fixture or at a Go test, so the
 * removal of the TypeScript implementation can be gated mechanically: every
 * criterion has to be covered by something that outlives the oracle.
 *
 * Usage: node scripts/build-completeness.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const specDir = path.resolve(root, '.specs/changes/go-rewrite-universal-agents');
const outFile = path.resolve(root, 'internal/testdata/fixtures/completeness.json');

/**
 * The coverage of every criterion. The key is the criterion, the value is the
 * evidence that outlives the TypeScript implementation: a Go test file, a
 * recorded fixture, or both.
 */
const coverage = {
  'REQ-1.1': ['internal/cli/surface_test.go'],
  'REQ-1.2': ['internal/cli/surface_test.go', 'internal/validate/differential_test.go'],
  'REQ-1.3': ['scripts/pack-check.mjs'],
  'REQ-1.4': ['scripts/pack-check.mjs'],
  'REQ-1.5': ['scripts/set-version.mjs', 'internal/version/version_test.go'],
  'REQ-1.6': ['scripts/pack-check.mjs'],
  'REQ-1.7': ['internal/version/version_test.go'],
  'REQ-1.8': ['internal/version/version_test.go'],
  'REQ-1.9': ['internal/cli/surface_test.go'],

  'REQ-2.1': ['internal/config/config_test.go'],
  'REQ-2.2': ['internal/config/config_test.go'],
  'REQ-2.3': ['internal/config/config_test.go'],
  'REQ-2.4': ['internal/config/config_test.go'],
  'REQ-2.5': ['internal/cleanup/cleanup_test.go'],
  'REQ-2.6': ['internal/cli/surface_test.go'],
  'REQ-2.7': ['internal/cleanup/cleanup_test.go'],

  'REQ-3.1': ['internal/descriptor/descriptor_test.go'],
  'REQ-3.2': ['internal/emit/emit_test.go'],
  'REQ-3.3': ['internal/emit/emit_test.go'],
  'REQ-3.4': ['internal/emit/emit_test.go'],
  'REQ-3.5': ['internal/manifest/manifest_test.go'],
  'REQ-3.6': ['internal/descriptor/descriptor_test.go'],
  'REQ-3.7': ['internal/descriptor/descriptor_test.go'],
  'REQ-3.8': ['internal/descriptor/descriptor_test.go'],
  'REQ-3.9': ['internal/descriptor/descriptor_test.go'],

  'REQ-4.1': ['internal/manifest/manifest_test.go'],
  'REQ-4.2': ['internal/cleanup/cleanup_test.go'],
  'REQ-4.3': ['internal/cleanup/cleanup_test.go'],
  'REQ-4.4': ['internal/cleanup/cleanup_test.go'],
  'REQ-4.5': ['internal/manifest/manifest_test.go'],
  'REQ-4.6': ['internal/manifest/manifest_test.go'],
  'REQ-4.7': ['internal/manifest/manifest_test.go'],
  'REQ-4.8': ['internal/manifest/manifest_test.go'],
  'REQ-4.9': ['internal/cleanup/scope.go'],

  'REQ-5.1': ['internal/assets/canonical/skills/project-guidelines-writer/SKILL.md'],
  'REQ-5.2': ['internal/assets/canonical/commands/inject-guidelines.command.md'],
  'REQ-5.3': ['internal/assets/canonical/skills/project-guidelines-writer/SKILL.md'],
  'REQ-5.4': ['internal/cli/manifest.go'],
  'REQ-5.5': ['internal/assets/canonical/skills/project-guidelines-writer/SKILL.md'],
  'REQ-5.6': ['internal/assets/canonical/skills/project-guidelines-writer/SKILL.md'],
  'REQ-5.7': ['internal/assets/canonical/skills/code-review-hardening/SKILL.md'],
  'REQ-5.8': ['CONVENTIONS.md'],
  'REQ-5.4': ['internal/cli/manifest.go'],

  'REQ-6.1': ['internal/validate/differential_test.go'],
  'REQ-6.2': ['internal/validate/differential_test.go'],
  'REQ-6.5': ['internal/validate/differential_test.go'],

  'REQ-7.1': ['internal/bundle/contract_test.go'],
  'REQ-7.2': ['internal/bundle/source_test.go'],
  'REQ-7.3': ['internal/bundle/source_test.go'],
  'REQ-7.4': ['internal/bundle/source_test.go'],
  'REQ-7.5': ['internal/assets/assets.go'],
  'REQ-7.6': ['internal/bundle/difftest/'],

  'REQ-8.1': ['internal/version/version_test.go'],
  'REQ-8.2': ['internal/version/version_test.go'],
  'REQ-8.3': ['internal/version/version_test.go'],
  'REQ-8.4': ['.github/workflows/ci.yml'],
  'REQ-8.5': ['.github/workflows/publish.yml'],
  'REQ-8.6': ['docs/DISTRIBUTION.md'],

  'REQ-9.1': ['internal/pack/package_test.go'],
  'REQ-9.2': ['internal/pack/package_test.go'],
  'REQ-9.3': ['internal/pack/package_test.go'],
  'REQ-9.4': ['internal/pack/vendor_test.go'],
  'REQ-9.5': ['internal/pack/validate_test.go'],
  'REQ-9.6': ['internal/pack/package_test.go'],

  'REQ-10.1': ['internal/pack/catalog_test.go'],
  'REQ-10.2': ['internal/pack/catalog_test.go'],
  'REQ-10.3': ['internal/pack/validate_test.go'],
  'REQ-10.4': ['internal/pack/catalog_test.go'],
  'REQ-10.5': ['internal/pack/publish_test.go'],
  'REQ-10.6': ['internal/pack/publish_test.go'],
  'REQ-10.7': ['internal/pack/catalog_test.go'],

  'REQ-11.1': ['scripts/pack-check.mjs'],
  'REQ-11.2': ['scripts/pack-check.mjs'],
  'REQ-11.3': ['packages/cli/README.md'],
  'REQ-11.4': ['.github/workflows/publish.yml'],

  'REQ-12.1': ['internal/manifest/manifest_test.go'],
  'REQ-12.2': ['internal/cleanup/cleanup_test.go'],
  'REQ-12.3': ['internal/cleanup/cleanup_test.go'],
  'REQ-12.4': ['internal/cleanup/cleanup_test.go']
};

/**
 * The command surface items, with the captured fixture of each.
 */
const commandSurface = [
  { command: 'inject', fixture: 'internal/testdata/fixtures/command-surface/help-inject.txt' },
  { command: 'clean', fixture: 'internal/testdata/fixtures/command-surface/help-clean.txt' },
  { command: 'doctor', fixture: 'internal/testdata/fixtures/command-surface/help-doctor.txt' },
  { command: 'repair', fixture: 'internal/testdata/fixtures/command-surface/help-repair.txt' },
  { command: 'uninstall', fixture: 'internal/testdata/fixtures/command-surface/help-uninstall.txt' },
  { command: 'templates', fixture: 'internal/testdata/fixtures/command-surface/help-templates.txt' },
  { command: 'validate', fixture: 'internal/testdata/fixtures/command-surface/help-validate.txt' },
  { command: 'package', fixture: 'internal/testdata/fixtures/command-surface/help-package.txt' },
  { command: '--version', fixture: 'internal/testdata/fixtures/command-surface/version.txt' },
  { command: '--help', fixture: 'internal/testdata/fixtures/command-surface/help-root-current.txt' }
];

/**
 * The criteria the native preview deliberately drops. A superseded criterion
 * carries the reason instead of evidence: the stewardship knowledge graph
 * was removed, so its storage, locking and resolution contracts no longer
 * exist.
 */
const superseded = {
  'REQ-6.3': 'removed by .specs/changes/remove-stewardship/brief.md: the rule graph no longer exists',
  'REQ-6.4': 'removed by .specs/changes/remove-stewardship/brief.md: the rule store lock no longer exists',
  'REQ-6.6': 'removed by .specs/changes/remove-stewardship/brief.md: project-over-global rule resolution no longer exists'
};

const requirements = fs.readFileSync(path.join(specDir, 'requirements.md'), 'utf8');
const criteria = [];
for (const match of requirements.matchAll(/^(\d+\.\d+)\s+(THE|WHEN|IF)\s/gm)) {
  criteria.push(`REQ-${match[1]}`);
}

const entries = [];
const missing = [];
for (const criterion of criteria) {
  const reason = superseded[criterion];
  if (reason !== undefined) {
    entries.push({ criterion, coveredBy: [], superseded: reason });
    continue;
  }
  const coveredBy = coverage[criterion] ?? [];
  if (coveredBy.length === 0) {
    missing.push(criterion);
  }
  const absent = coveredBy.filter((file) => !fs.existsSync(path.resolve(root, file)));
  entries.push({ criterion, coveredBy, absent: absent.length > 0 ? absent : undefined });
}

const absentFixtures = commandSurface
  .filter((item) => !fs.existsSync(path.resolve(root, item.fixture)))
  .map((item) => item.fixture);

const manifest = {
  schemaVersion: 1,
  generatedFrom: '.specs/changes/go-rewrite-universal-agents/requirements.md',
  criteria: entries,
  commandSurface,
  report: {
    criteria: entries.length,
    covered: entries.filter((entry) => entry.coveredBy.length > 0).length,
    superseded: entries.filter((entry) => entry.superseded).map((entry) => entry.criterion),
    missing,
    absentEvidence: entries.filter((entry) => entry.absent).map((entry) => entry.criterion),
    absentFixtures
  }
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `completeness: ${manifest.report.covered}/${manifest.report.criteria} criteria covered, ` +
    `${manifest.report.superseded.length} superseded, ${manifest.report.missing.length} missing, ` +
    `${manifest.report.absentEvidence.length} with an absent evidence file, ` +
    `${manifest.report.absentFixtures.length} absent fixtures`
);

if (manifest.report.missing.length > 0 || manifest.report.absentEvidence.length > 0 || manifest.report.absentFixtures.length > 0) {
  process.exitCode = 1;
}
