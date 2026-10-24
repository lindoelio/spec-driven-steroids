import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import { STEROIDS_SKILL_DIRS } from '../../src/cli/index.js';
import { collectFiles } from '../../src/cli/install-manifest.js';
import { getPlatformDefinitions } from '../../src/cli/platform-registry.js';
import { transformForPlatform } from '../../src/cli/transformation-pipeline.js';
import { expectThinEntryPoint, readTemplate, templatesRoot } from '../helpers/template-test-helpers.js';

describe('Unit: skill-first planning contract', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(directory => fs.remove(directory)));
  });

  it.each(['agents/spec-driven.agent.md', 'commands/spec-driven.command.md'])('keeps %s as a thin entry point', async source => {
    const content = await readTemplate(`universal/${source}`);

    expectThinEntryPoint(content);
    expect(content.match(/`spec-driven-planner`/g)).toHaveLength(1);
    expect(content).toMatch(/approval before implementation|before the selected lane's approval gate/);
    expect(content).not.toContain('Delegate this to');
  });

  it('ships every explicitly referenced planning skill and tracks it for cleanup', async () => {
    const files = await collectFiles(path.join(templatesRoot, 'universal'));
    const references = new Set<string>();
    for (const file of files.filter(file => file.endsWith('.md'))) {
      const content = await fs.readFile(file, 'utf8');
      for (const match of content.matchAll(/`(spec-driven-[a-z-]+)`\s+skill\b/g)) {
        references.add(match[1]);
      }
    }

    expect(references.has('spec-driven-planner')).toBe(true);
    for (const name of references) {
      expect(STEROIDS_SKILL_DIRS).toContain(name);
      expect(await fs.pathExists(path.join(templatesRoot, 'universal', 'skills', name, 'SKILL.md'))).toBe(true);
    }
  });

  it('defines the escalation considerations once without size-based triggers', async () => {
    const files = await collectFiles(path.join(templatesRoot, 'universal'));
    const contents = await Promise.all(files.filter(file => file.endsWith('.md')).map(file => fs.readFile(file, 'utf8')));
    const allContent = contents.join('\n');
    for (const sentinel of ['**Irreversibility:**', '**External contracts:**', '**Persistence:**', '**Architectural boundaries:**', '**Security posture:**', '**Critical runtime behavior:**']) {
      expect(allContent.split(sentinel)).toHaveLength(2);
    }
    expect(allContent).not.toContain('more than 5 requirements');
    expect(allContent).not.toContain('more than 8 implementation tasks');
  });

  it('requires full to earn its overhead and keeps ordinary brief approval as the only stop', async () => {
    const content = await readTemplate('universal/skills/spec-driven-planner/references/lane-selection.md');
    expect(content).toContain('concrete advantage from separate requirements, design, and tasks approval');
    expect(content).toContain('not automatic escalation');
    expect(content).toContain('Do not add a separate lane-confirmation stop');
    expect(content).toContain('If explicit instructions contradict one another, ask one clarification');
    expect(content).toContain('separate sibling slug per slice');
    expect(content).toContain('including test tasks');
  });

  it.each(getPlatformDefinitions())('routes $id entry points to the shipped planner without native-agent assumptions', async definition => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sds-flow-contract-'));
    tempDirs.push(directory);
    const results = await transformForPlatform(definition.id, templatesRoot, directory);

    for (const result of results.filter(result => !result.sourcePath.includes('inject-guidelines'))) {
      expect(result.success).toBe(true);
      const content = await fs.readFile(result.outputPath, 'utf8');
      expectThinEntryPoint(content);
      expect(content).not.toContain('Delegate this to');
    }
    if (definition.config.skillsOnly) {
      const content = await fs.readFile(path.join(directory, 'skills', 'spec-driven', 'SKILL.md'), 'utf8');
      expect(content).not.toMatch(/delegate.*agent|native agent/i);
    }
  });
});
