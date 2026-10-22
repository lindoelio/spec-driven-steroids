import { describe, expect, it } from 'vitest';

import program from '../../dist/cli/index.js';

describe('Compiled CLI smoke test', () => {
  it('exposes the expected public commands from dist', () => {
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toEqual(expect.arrayContaining([
      'inject',
      'clean',
      'validate',
      'stewardship'
    ]));
  });

  it('keeps the sds alias on the compiled program', () => {
    expect(program.alias()).toBe('sds');
  });
});
