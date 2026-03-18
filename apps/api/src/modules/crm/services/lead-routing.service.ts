/**
 * Lead Routing Service (Phase U)
 * Automated lead routing based on configurable rules with round-robin support.
 */

import type { Database } from '@agios/db';
import {
  crmLeadRoutingRules,
  crmLeads,
} from '@agios/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { CrmLeadRoutingRule, NewCrmLeadRoutingRule } from '@agios/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface RouteResult {
  matched: boolean;
  ruleId?: string;
  assignedTo?: string;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'exists' | 'not_exists';
  value?: unknown;
}

export interface CreateRuleInput {
  workspaceId: string;
  name: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
  conditions: RuleCondition | RuleCondition[];
  assignToUserId?: string;
  assignToTeam?: string;
  roundRobin?: boolean;
  createdBy?: string;
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
  conditions?: RuleCondition | RuleCondition[];
  assignToUserId?: string;
  assignToTeam?: string;
  roundRobin?: boolean;
}

// ============================================================================
// Service
// ============================================================================

export class LeadRoutingService {
  /**
   * Apply routing rules to a lead. Evaluates rules by priority (highest first).
   * If a match is found, assigns the lead and updates rule statistics.
   */
  async routeLead(
    db: Database,
    workspaceId: string,
    leadId: string,
    leadData: Record<string, unknown>
  ): Promise<RouteResult> {
    // Get active rules sorted by priority descending
    const rules = await db
      .select()
      .from(crmLeadRoutingRules)
      .where(
        and(
          eq(crmLeadRoutingRules.workspaceId, workspaceId),
          eq(crmLeadRoutingRules.isActive, true)
        )
      )
      .orderBy(desc(crmLeadRoutingRules.priority));

    for (const rule of rules) {
      const conditions = rule.conditions as RuleCondition | RuleCondition[];
      if (this.evaluateConditions(conditions, leadData)) {
        // Determine assigned user
        let assignedTo: string | undefined;

        if (rule.roundRobin && rule.assignToTeam) {
          assignedTo = this.getNextRoundRobinUser(rule);
          // Update round-robin state
          const state = (rule.roundRobinState as { lastIndex: number; users: string[] } | null) || {
            lastIndex: -1,
            users: [],
          };
          if (state.users.length > 0) {
            state.lastIndex = (state.lastIndex + 1) % state.users.length;
            await db
              .update(crmLeadRoutingRules)
              .set({
                roundRobinState: state,
                matchCount: rule.matchCount + 1,
                lastMatchedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(crmLeadRoutingRules.id, rule.id));
          }
        } else {
          assignedTo = rule.assignToUserId ?? undefined;
          // Update match count
          await db
            .update(crmLeadRoutingRules)
            .set({
              matchCount: rule.matchCount + 1,
              lastMatchedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(crmLeadRoutingRules.id, rule.id));
        }

        // Assign lead owner if we have a target
        if (assignedTo) {
          await db
            .update(crmLeads)
            .set({ ownerId: assignedTo })
            .where(eq(crmLeads.id, leadId));
        }

        return {
          matched: true,
          ruleId: rule.id,
          assignedTo,
        };
      }
    }

    return { matched: false };
  }

  /**
   * Create a new routing rule.
   */
  async createRule(
    db: Database,
    data: CreateRuleInput
  ): Promise<CrmLeadRoutingRule> {
    const [rule] = await db
      .insert(crmLeadRoutingRules)
      .values({
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description ?? null,
        priority: data.priority ?? 0,
        isActive: data.isActive ?? true,
        conditions: data.conditions,
        assignToUserId: data.assignToUserId ?? null,
        assignToTeam: data.assignToTeam ?? null,
        roundRobin: data.roundRobin ?? false,
        createdBy: data.createdBy ?? null,
      })
      .returning();

    return rule;
  }

  /**
   * Update an existing routing rule.
   */
  async updateRule(
    db: Database,
    ruleId: string,
    workspaceId: string,
    data: UpdateRuleInput
  ): Promise<CrmLeadRoutingRule | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updateData['name'] = data.name;
    if (data.description !== undefined) updateData['description'] = data.description;
    if (data.priority !== undefined) updateData['priority'] = data.priority;
    if (data.isActive !== undefined) updateData['isActive'] = data.isActive;
    if (data.conditions !== undefined) updateData['conditions'] = data.conditions;
    if (data.assignToUserId !== undefined) updateData['assignToUserId'] = data.assignToUserId;
    if (data.assignToTeam !== undefined) updateData['assignToTeam'] = data.assignToTeam;
    if (data.roundRobin !== undefined) updateData['roundRobin'] = data.roundRobin;

    const [updated] = await db
      .update(crmLeadRoutingRules)
      .set(updateData)
      .where(
        and(
          eq(crmLeadRoutingRules.id, ruleId),
          eq(crmLeadRoutingRules.workspaceId, workspaceId)
        )
      )
      .returning();

    return updated ?? null;
  }

  /**
   * Delete a routing rule.
   */
  async deleteRule(db: Database, ruleId: string, workspaceId: string): Promise<void> {
    await db
      .delete(crmLeadRoutingRules)
      .where(
        and(
          eq(crmLeadRoutingRules.id, ruleId),
          eq(crmLeadRoutingRules.workspaceId, workspaceId)
        )
      );
  }

  /**
   * List all routing rules for a workspace, ordered by priority descending.
   */
  async listRules(db: Database, workspaceId: string): Promise<CrmLeadRoutingRule[]> {
    return db
      .select()
      .from(crmLeadRoutingRules)
      .where(eq(crmLeadRoutingRules.workspaceId, workspaceId))
      .orderBy(desc(crmLeadRoutingRules.priority));
  }

  /**
   * Get a single routing rule by ID.
   */
  async getRule(
    db: Database,
    ruleId: string,
    workspaceId: string
  ): Promise<CrmLeadRoutingRule | null> {
    const [rule] = await db
      .select()
      .from(crmLeadRoutingRules)
      .where(
        and(
          eq(crmLeadRoutingRules.id, ruleId),
          eq(crmLeadRoutingRules.workspaceId, workspaceId)
        )
      );

    return rule ?? null;
  }

  /**
   * Evaluate conditions against lead data.
   * Supports single condition object or array of conditions (all must match).
   */
  private evaluateConditions(
    conditions: RuleCondition | RuleCondition[],
    leadData: Record<string, unknown>
  ): boolean {
    const conditionArray = Array.isArray(conditions) ? conditions : [conditions];

    for (const condition of conditionArray) {
      if (!this.evaluateSingleCondition(condition, leadData)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition against lead data.
   */
  private evaluateSingleCondition(
    condition: RuleCondition,
    leadData: Record<string, unknown>
  ): boolean {
    const fieldValue = leadData[condition.field];

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;

      case 'not_equals':
        return fieldValue !== condition.value;

      case 'contains':
        return (
          typeof fieldValue === 'string' &&
          typeof condition.value === 'string' &&
          fieldValue.toLowerCase().includes(condition.value.toLowerCase())
        );

      case 'not_contains':
        return (
          typeof fieldValue === 'string' &&
          typeof condition.value === 'string' &&
          !fieldValue.toLowerCase().includes(condition.value.toLowerCase())
        );

      case 'greater_than':
        return (
          typeof fieldValue === 'number' &&
          typeof condition.value === 'number' &&
          fieldValue > condition.value
        );

      case 'less_than':
        return (
          typeof fieldValue === 'number' &&
          typeof condition.value === 'number' &&
          fieldValue < condition.value
        );

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);

      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      default:
        return false;
    }
  }

  /**
   * Get the next user in round-robin rotation.
   */
  private getNextRoundRobinUser(rule: CrmLeadRoutingRule): string | undefined {
    const state = (rule.roundRobinState as { lastIndex: number; users: string[] } | null) || {
      lastIndex: -1,
      users: [],
    };

    if (state.users.length === 0) {
      return rule.assignToUserId ?? undefined;
    }

    const nextIndex = (state.lastIndex + 1) % state.users.length;
    return state.users[nextIndex];
  }
}

export const leadRoutingService = new LeadRoutingService();
