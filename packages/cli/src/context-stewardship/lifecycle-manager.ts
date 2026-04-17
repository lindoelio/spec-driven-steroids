import type { RuleNode, LifecycleValue } from './types.js';
import { KnowledgeGraphStore } from './knowledge-graph-store.js';

export interface LifecycleNotification {
  ruleId: string;
  type: 'deprecated' | 'archived' | 'expiring';
  message: string;
  supersededBy?: string;
}

export type NotificationSink = (notification: LifecycleNotification) => void;

export class LifecycleManager {
  private store: KnowledgeGraphStore;
  private notificationSink?: NotificationSink;

  constructor(store: KnowledgeGraphStore, notificationSink?: NotificationSink) {
    this.store = store;
    this.notificationSink = notificationSink;
  }

  setNotificationSink(sink: NotificationSink): void {
    this.notificationSink = sink;
  }

  async transitionState(
    ruleId: string,
    newState: LifecycleValue,
    changedBy: string,
    supersededBy?: string
  ): Promise<RuleNode | null> {
    const rule = await this.store.readRule(ruleId);
    if (!rule) return null;

    if (newState === 'deprecated') {
      const updated = await this.store.updateRule(
        ruleId,
        {
          supersededBy,
          state: { value: 'deprecated', changedAt: new Date().toISOString(), changedBy },
        },
        changedBy
      );
      if (updated && this.notificationSink) {
        this.notificationSink({
          ruleId,
          type: 'deprecated',
          message: `Rule "${rule.content.slice(0, 50)}..." has been deprecated.`,
          supersededBy,
        });
      }
      return updated;
    }

    if (newState === 'archived') {
      const updated = await this.store.updateRule(
        ruleId,
        { state: { value: 'archived', changedAt: new Date().toISOString(), changedBy } },
        changedBy
      );
      if (updated && this.notificationSink) {
        this.notificationSink({
          ruleId,
          type: 'archived',
          message: `Rule "${rule.content.slice(0, 50)}..." has been archived.`,
        });
      }
      return updated;
    }

    return this.store.updateRule(
      ruleId,
      { state: { value: newState, changedAt: new Date().toISOString(), changedBy } },
      changedBy
    );
  }

  async scanExpiredRules(changedBy: string): Promise<RuleNode[]> {
    const now = new Date();
    const allRules = await this.store.listRules({ state: 'active' });
    const expiredRules: RuleNode[] = [];

    for (const rule of allRules) {
      const expiresAt = new Date(rule.metadata.expiresAt);
      if (expiresAt <= now) {
        const updated = await this.transitionState(rule.id, 'deprecated', changedBy);
        if (updated) expiredRules.push(updated);
      }
    }

    return expiredRules;
  }

  groupByLifecycleState(rules: RuleNode[]): Record<LifecycleValue, RuleNode[]> {
    const groups: Record<LifecycleValue, RuleNode[]> = {
      active: [],
      deprecated: [],
      archived: [],
    };

    for (const rule of rules) {
      groups[rule.state.value].push(rule);
    }

    return groups;
  }

  async getRulesByState(state: LifecycleValue): Promise<RuleNode[]> {
    return this.store.listRules({ state });
  }

  async getActiveRules(): Promise<RuleNode[]> {
    return this.store.listRules({ state: 'active' });
  }

  async getDeprecatedRules(): Promise<RuleNode[]> {
    return this.store.listRules({ state: 'deprecated' });
  }

  async getArchivedRules(): Promise<RuleNode[]> {
    return this.store.listRules({ state: 'archived' });
  }

  getSupersedingRuleLink(rule: RuleNode): string | undefined {
    return rule.supersededBy;
  }
}
