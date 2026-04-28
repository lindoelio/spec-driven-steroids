/**
 * Output format types for platform-specific agent files.
 */
export enum FormatType {
  MARKDOWN = 'markdown',
  TOML = 'toml'
}

/**
 * Frontmatter configuration for a platform.
 */
export interface FrontmatterConfig {
  /** Standard frontmatter fields (name, description) */
  fields: Record<string, string>;
  /** Additional platform-specific fields (e.g., mode: primary) */
  additionalFields?: Record<string, string>;
}

/**
 * Platform configuration for transformation.
 */
export interface PlatformConfig {
  /** Platform identifier */
  id: string;
  /** Output format (markdown or TOML) */
  format: FormatType;
  /** Frontmatter configuration */
  frontmatter: FrontmatterConfig;
  /** Agent output directory relative to platform template root */
  agentDirectory: string;
  /** Agent output filename */
  agentFilename: string;
  /** Command output directory relative to platform template root */
  commandDirectory: string;
  /** Spec-driven command output filename */
  specDrivenCommandFilename: string;
  /** Inject-guidelines command output filename */
  injectGuidelinesCommandFilename: string;
}

/**
 * Mapping of platform IDs to their configuration.
 */
export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  'github-vscode': {
    id: 'github-vscode',
    format: FormatType.MARKDOWN,
    frontmatter: {
      fields: {
        name: 'Spec-Driven',
        description: 'Use this planner when the user wants to define, design, decompose, or implement a change through the full Spec-Driven lifecycle. It must enforce requirements -> design -> tasks -> implementation, load long-running-work-planning at the start of each planning phase when available, and stop for human approval between phases.'
      }
    },
    agentDirectory: 'agents',
    agentFilename: 'spec-driven.agent.md',
    commandDirectory: 'prompts',
    specDrivenCommandFilename: 'spec-driven.prompt.md',
    injectGuidelinesCommandFilename: 'inject-guidelines.prompt.md'
  },
  'github-jetbrains': {
    id: 'github-jetbrains',
    format: FormatType.MARKDOWN,
    frontmatter: {
      fields: {
        name: 'Spec-Driven',
        description: 'Use this planner when the user wants to define, design, decompose, or implement a change through the full Spec-Driven lifecycle. It must enforce requirements -> design -> tasks -> implementation, load long-running-work-planning at the start of each planning phase when available, and stop for human approval between phases.'
      }
    },
    agentDirectory: 'agents',
    agentFilename: 'spec-driven.agent.md',
    commandDirectory: 'prompts',
    specDrivenCommandFilename: 'spec-driven.prompt.md',
    injectGuidelinesCommandFilename: 'inject-guidelines.prompt.md'
  },
  'claudecode': {
    id: 'claudecode',
    format: FormatType.MARKDOWN,
    frontmatter: {
      fields: {
        name: 'spec-driven',
        description: 'Primary skill for Spec-Driven flow (Requirements -> Design -> Tasks -> Implementation). Use when the user wants to plan or implement a feature, fix, or change using the spec-driven methodology.'
      }
    },
    agentDirectory: 'agents',
    agentFilename: 'spec-driven.md',
    commandDirectory: 'commands',
    specDrivenCommandFilename: 'spec-driven.md',
    injectGuidelinesCommandFilename: 'inject-guidelines.md'
  },
    'opencode': {
    id: 'opencode',
    format: FormatType.MARKDOWN,
    frontmatter: {
      fields: {
        name: 'Spec-Driven',
        description: 'Use this planner when the user wants to define, design, decompose, or implement a change through the full Spec-Driven lifecycle. It must enforce requirements -> design -> tasks -> implementation, load long-running-work-planning at the start of each planning phase when available, and stop for human approval between phases.'
      },
      additionalFields: {
        mode: 'primary'
      }
    },
    agentDirectory: 'agents',
    agentFilename: 'spec-driven.agent.md',
    commandDirectory: 'commands',
    specDrivenCommandFilename: 'spec-driven.md',
    injectGuidelinesCommandFilename: 'inject-guidelines.md'
  },
  'codex': {
    id: 'codex',
    format: FormatType.TOML,
    frontmatter: {
      fields: {
        name: 'spec-driven',
        description: 'Use this planner when the user wants to define, design, decompose, or implement a change through the full Spec-Driven lifecycle. It must enforce requirements -> design -> tasks -> implementation, load long-running-work-planning at the start of each planning phase when available, and stop for human approval between phases.'
      }
    },
    agentDirectory: 'agents',
    agentFilename: 'spec-driven.toml',
    commandDirectory: 'commands',
    specDrivenCommandFilename: 'spec-driven.md',
    injectGuidelinesCommandFilename: 'inject-guidelines.md'
  },
  'antigravity': {
    id: 'antigravity',
    format: FormatType.MARKDOWN,
    frontmatter: {
      fields: {
        name: 'Spec-Driven',
        description: 'Use this workflow when the user wants to define, design, decompose, or implement a change through the full Spec-Driven lifecycle. It must enforce requirements -> design -> tasks -> implementation, load long-running-work-planning at the start of each planning phase when available, and stop for human approval between phases.'
      }
    },
    agentDirectory: 'workflows',
    agentFilename: 'spec-driven.md',
    commandDirectory: 'workflows',
    specDrivenCommandFilename: 'spec-driven.md',
    injectGuidelinesCommandFilename: 'inject-guidelines.md'
  },
  'github-copilot-cli': {
    id: 'github-copilot-cli',
    format: FormatType.MARKDOWN,
    frontmatter: {
      fields: {
        name: 'Spec-Driven',
        description: 'Use this planner when the user wants to define, design, decompose, or implement a change through the full Spec-Driven lifecycle. It must enforce requirements -> design -> tasks -> implementation, load long-running-work-planning at the start of each planning phase when available, and stop for human approval between phases.'
      }
    },
    agentDirectory: 'agents',
    agentFilename: 'spec-driven.agent.md',
    commandDirectory: 'commands',
    specDrivenCommandFilename: 'spec-driven.md',
    injectGuidelinesCommandFilename: 'inject-guidelines.md'
  },
  'gemini-cli': {
    id: 'gemini-cli',
    format: FormatType.MARKDOWN,
    frontmatter: {
      fields: {
        name: 'spec-driven',
        description: 'Use this planner when the user wants to define, design, decompose, or implement a change through the full Spec-Driven lifecycle. It must enforce requirements -> design -> tasks -> implementation, load long-running-work-planning at the start of each planning phase when available, and stop for human approval between phases.'
      }
    },
    agentDirectory: 'agents',
    agentFilename: 'spec-driven.md',
    commandDirectory: 'commands',
    specDrivenCommandFilename: 'spec-driven.toml',
    injectGuidelinesCommandFilename: 'inject-guidelines.toml'
  },
  'qwen-code': {
    id: 'qwen-code',
    format: FormatType.MARKDOWN,
    frontmatter: {
      fields: {
        name: 'Spec-Driven',
        description: 'Use this planner when the user wants to define, design, decompose, or implement a change through the full Spec-Driven lifecycle. It must enforce requirements -> design -> tasks -> implementation, load long-running-work-planning at the start of each planning phase when available, and stop for human approval between phases.'
      }
    },
    agentDirectory: 'agents',
    agentFilename: 'spec-driven.agent.md',
    commandDirectory: 'commands',
    specDrivenCommandFilename: 'spec-driven.md',
    injectGuidelinesCommandFilename: 'inject-guidelines.md'
  }
};

/**
 * Get platform configuration by platform ID.
 */
export function getPlatformConfig(platformId: string): PlatformConfig | undefined {
  return PLATFORM_CONFIGS[platformId];
}
