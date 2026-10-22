import type { CapabilityReport, CapabilityTier } from './types.js';
import { accessSync, constants, mkdirSync } from 'fs';
import { homedir, tmpdir } from 'os';
import path from 'path';

export interface CapabilityDetector {
  detectFileSystem(): Promise<boolean>;
}

export class DefaultCapabilityDetector implements CapabilityDetector {
  async detectFileSystem(): Promise<boolean> {
    const candidates = [
      process.env.SDS_HOME,
      path.join(homedir(), '.agents'),
      tmpdir()
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        mkdirSync(candidate, { recursive: true });
        accessSync(candidate, constants.W_OK);
        return true;
      } catch {
        // Try the next candidate.
      }
    }

    return false;
  }
}

export class GracefulDegradationRouter {
  private detector: CapabilityDetector;
  private cachedCapabilities?: CapabilityReport;
  private tier!: CapabilityTier;

  constructor(detector?: CapabilityDetector) {
    this.detector = detector ?? new DefaultCapabilityDetector();
  }

  async initialize(): Promise<CapabilityReport> {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    const fileSystem = await this.detector.detectFileSystem();
    this.tier = 'tier2-json-graph';

    const enabledFeatures: string[] = [];
    if (fileSystem) enabledFeatures.push('json-graph', 'semantic-retrieval', 'versioning', 'conflict-detection');

    this.cachedCapabilities = {
      tier: this.tier,
      fileSystemAvailable: fileSystem,
      enabledFeatures,
    };

    return this.cachedCapabilities;
  }

  getTier(): CapabilityTier {
    if (!this.tier) {
      throw new Error('Router not initialized. Call initialize() first.');
    }
    return this.tier;
  }

  getCapabilities(): CapabilityReport | undefined {
    return this.cachedCapabilities;
  }

  supportsVectorSearch(): boolean {
    return false;
  }

  supportsJsonGraph(): boolean {
    return this.tier === 'tier2-json-graph';
  }

  formatCapabilities(): string {
    const caps = this.cachedCapabilities;
    if (!caps) {
      return 'Capabilities not yet detected. Call initialize() first.';
    }

    const lines = [
      `Tier: ${caps.tier}`,
      `File System: ${caps.fileSystemAvailable ? 'available' : 'unavailable'}`,
      `Enabled Features: ${caps.enabledFeatures.join(', ') || 'none'}`,
    ];

    return lines.join('\n');
  }
}

export const defaultRouter = new GracefulDegradationRouter();
