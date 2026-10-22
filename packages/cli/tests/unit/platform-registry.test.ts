import { describe, expect, it, vi, afterEach } from 'vitest';
import path from 'path';
import os from 'os';

import {
  PLATFORM_DEFINITIONS,
  getPlatformDefinition,
  getPlatformDefinitions,
  getGlobalCapablePlatforms,
  resolvePlatformScope
} from '../../src/cli/platform-registry.js';
import { PLATFORM_CONFIGS } from '../../src/cli/platform-config.js';

describe('Unit: platform registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('covers every transform platform config', () => {
    for (const id of Object.keys(PLATFORM_CONFIGS)) {
      const definition = getPlatformDefinition(id);
      expect(definition, `missing definition for ${id}`).toBeDefined();
      expect(definition!.config).toBe(PLATFORM_CONFIGS[id]);
      expect(definition!.displayName.length).toBeGreaterThan(0);
      expect(definition!.supportedScopes.length).toBeGreaterThan(0);
    }
  });

  it('resolves project roots and skills roots under the project directory', () => {
    const context = { cwd: '/tmp/example-project', home: '/tmp/home' };
    for (const definition of getPlatformDefinitions()) {
      if (!definition.supportedScopes.includes('project')) continue;
      const root = definition.resolveRoot('project', context);
      const skillsRoot = definition.resolveSkillsRoot('project', context);
      expect(path.resolve(root).startsWith(path.resolve(context.cwd))).toBe(true);
      expect(path.resolve(skillsRoot).startsWith(path.resolve(context.cwd))).toBe(true);
    }
  });

  it('resolves global roots under the mocked home directory', () => {
    const home = '/tmp/sds-home';
    vi.spyOn(os, 'homedir').mockReturnValue(home);
    const context = { cwd: '/tmp/example-project', home };

    for (const definition of getGlobalCapablePlatforms()) {
      const root = definition.resolveRoot('global', context);
      const skillsRoot = definition.resolveSkillsRoot('global', context);
      expect(path.resolve(root).startsWith(path.resolve(home))).toBe(true);
      expect(path.resolve(skillsRoot).startsWith(path.resolve(home))).toBe(true);
    }
  });

  it('falls back to project scope for project-only platforms', () => {
    for (const definition of getPlatformDefinitions()) {
      if (definition.supportedScopes.includes('global')) {
        expect(resolvePlatformScope(definition, 'global')).toBe('global');
      } else {
        expect(resolvePlatformScope(definition, 'global')).toBe('project');
      }
    }
  });

  it('keeps the registry free of duplicate ids', () => {
    const ids = Object.keys(PLATFORM_DEFINITIONS);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
