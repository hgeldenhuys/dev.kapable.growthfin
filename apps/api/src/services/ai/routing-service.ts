/**
 * Lead Routing Service (US-LEAD-AI-011)
 * Automated lead routing with agent matching algorithms
 */

import { db } from '@agios/db';
import {
  agentProfiles,
  leadRoutingHistory,
  routingRules,
  crmLeads,
  leadEnrichments,
  leadPredictions,
  type AgentProfile,
  type CrmLead,
  type LeadEnrichment,
  type LeadPrediction,
  type RoutingRule,
  type RoutingStrategy,
} from '@agios/db';
import { and, eq, desc, sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface RoutingContext {
  lead: CrmLead;
  enrichment?: LeadEnrichment;
  prediction?: LeadPrediction;
  availableAgents: AgentProfile[];
}

export interface RoutingResult {
  routing_id: string;
  assigned_agent_id: string;
  assigned_agent_name: string;
  routing_reason: string;
  routing_score: number;
  alternative_agents: Array<{
    agent_id: string;
    agent_name: string;
    routing_score: number;
    reason: string;
  }>;
}

export interface RoutingOptions {
  strategy?: RoutingStrategy;
  prioritize?: string[];
  constraints?: {
    maxLeadsPerAgent?: number;
    requiredSkills?: string[];
  };
}

interface AgentScore {
  agent: AgentProfile;
  score: number;
  breakdown: {
    skillScore: number;
    workloadScore: number;
    performanceScore: number;
  };
}

// ============================================================================
// ROUTING SERVICE
// ============================================================================

export class RoutingService {
  /**
   * Route lead to best-fit agent
   */
  async routeLead(
    leadId: string,
    workspaceId: string,
    options: RoutingOptions = {}
  ): Promise<RoutingResult> {
    const strategy = options.strategy || 'balanced';

    console.log(`[Routing Service] Routing lead ${leadId} with strategy: ${strategy}`);

    // 1. Gather context
    const context = await this.gatherRoutingContext(leadId, workspaceId);

    // 2. Check routing rules first
    const ruleMatch = await this.evaluateRoutingRules(context, workspaceId);
    if (ruleMatch) {
      console.log(`[Routing Service] Matched routing rule: ${ruleMatch.name}`);
      return await this.executeRuleBasedRouting(ruleMatch, context);
    }

    // 3. Apply routing strategy
    let bestAgent: AgentProfile;
    let routingScore: number;
    let reason: string;

    switch (strategy) {
      case 'skill_match':
        ({ agent: bestAgent, score: routingScore, reason } = await this.skillMatchRouting(context));
        break;
      case 'predictive':
        ({ agent: bestAgent, score: routingScore, reason } = await this.predictiveRouting(context));
        break;
      case 'round_robin':
        ({ agent: bestAgent, score: routingScore, reason } = await this.roundRobinRouting(context));
        break;
      case 'balanced':
      default:
        ({ agent: bestAgent, score: routingScore, reason } = await this.balancedRouting(context));
        break;
    }

    // 4. Assign lead to agent (update lead's assigned_to field)
    await db
      .update(crmLeads)
      .set({
        assignedTo: bestAgent.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)));

    // 5. Update agent workload
    await db
      .update(agentProfiles)
      .set({
        currentLeadCount: sql`${agentProfiles.currentLeadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(agentProfiles.id, bestAgent.id));

    // 6. Record routing decision
    const [routingHistory] = await db
      .insert(leadRoutingHistory)
      .values({
        workspaceId,
        leadId,
        toAgentId: bestAgent.userId,
        routingStrategy: strategy,
        routingScore: routingScore.toString(),
        routingReason: reason,
        agentWorkloadSnapshot: {
          current_leads: bestAgent.currentLeadCount,
          max_leads: bestAgent.maxConcurrentLeads,
          availability: bestAgent.availabilityStatus,
        },
        leadScoreSnapshot: {
          conversion_score: context.prediction?.predictionScore,
          enrichment_complete: !!context.enrichment,
        },
        routedAt: new Date(),
      })
      .returning();

    // 7. Calculate alternative agents
    const alternatives = await this.getAlternativeAgents(context, bestAgent, strategy);

    // Get agent name (from user join, but for now use userId)
    const agentName = `Agent ${bestAgent.userId.substring(0, 8)}`;

    return {
      routing_id: routingHistory.id,
      assigned_agent_id: bestAgent.userId,
      assigned_agent_name: agentName,
      routing_reason: reason,
      routing_score: routingScore,
      alternative_agents: alternatives,
    };
  }

  /**
   * Balanced routing: Skills + Workload + Availability
   */
  private async balancedRouting(context: RoutingContext): Promise<{
    agent: AgentProfile;
    score: number;
    reason: string;
  }> {
    const scores: AgentScore[] = context.availableAgents.map((agent) => {
      // Skill match score (0-1)
      const skillScore = this.calculateSkillMatch(agent, context.lead, context.enrichment);

      // Workload score (0-1, higher = more capacity)
      const workloadScore = 1 - agent.currentLeadCount / agent.maxConcurrentLeads;

      // Performance score (0-1)
      const performanceScore = Number(agent.conversionRate) || 0.5;

      // Weighted composite
      const compositeScore = skillScore * 0.4 + workloadScore * 0.4 + performanceScore * 0.2;

      return {
        agent,
        score: compositeScore,
        breakdown: { skillScore, workloadScore, performanceScore },
      };
    });

    // Sort by composite score
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const reason =
      `Balanced routing: Skill match ${(best.breakdown.skillScore * 100).toFixed(0)}%, ` +
      `Capacity ${(best.breakdown.workloadScore * 100).toFixed(0)}%, ` +
      `Performance ${(best.breakdown.performanceScore * 100).toFixed(0)}%`;

    return {
      agent: best.agent,
      score: best.score,
      reason,
    };
  }

  /**
   * Skill match routing: Best skills/industry fit
   */
  private async skillMatchRouting(context: RoutingContext): Promise<{
    agent: AgentProfile;
    score: number;
    reason: string;
  }> {
    const scores = context.availableAgents.map((agent) => {
      const score = this.calculateSkillMatch(agent, context.lead, context.enrichment);
      return { agent, score };
    });

    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const industry = (context.enrichment?.enrichedFields as any)?.industry?.value || 'this lead';
    const reason = `Best skill match (${(best.score * 100).toFixed(0)}% fit) for ${industry}`;

    return {
      agent: best.agent,
      score: best.score,
      reason,
    };
  }

  /**
   * Predictive routing: Use conversion prediction + agent performance
   */
  private async predictiveRouting(context: RoutingContext): Promise<{
    agent: AgentProfile;
    score: number;
    reason: string;
  }> {
    const leadScore = context.prediction?.predictionScore || 50;

    const scores = context.availableAgents.map((agent) => {
      // High-value leads → High-performing agents
      const performanceScore = Number(agent.conversionRate) || 0.5;
      const workloadScore = 1 - agent.currentLeadCount / agent.maxConcurrentLeads;

      // Weight performance higher for high-score leads
      const performanceWeight = leadScore > 70 ? 0.7 : 0.4;
      const workloadWeight = 1 - performanceWeight;

      const compositeScore = performanceScore * performanceWeight + workloadScore * workloadWeight;

      return { agent, score: compositeScore };
    });

    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const conversionRate = Number(best.agent.conversionRate) || 0;
    const reason = `High-value lead (score ${leadScore}) → Top performer (${(conversionRate * 100).toFixed(0)}% conversion rate)`;

    return {
      agent: best.agent,
      score: best.score,
      reason,
    };
  }

  /**
   * Round robin routing: Equal distribution
   */
  private async roundRobinRouting(context: RoutingContext): Promise<{
    agent: AgentProfile;
    score: number;
    reason: string;
  }> {
    // Sort by current workload (ascending)
    const sorted = [...context.availableAgents].sort(
      (a, b) => a.currentLeadCount - b.currentLeadCount
    );

    const agent = sorted[0];
    const score = 1 - agent.currentLeadCount / agent.maxConcurrentLeads;
    const reason = `Round robin: Lowest workload (${agent.currentLeadCount}/${agent.maxConcurrentLeads} leads)`;

    return { agent, score, reason };
  }

  /**
   * Calculate skill match score
   */
  private calculateSkillMatch(
    agent: AgentProfile,
    lead: CrmLead,
    enrichment?: LeadEnrichment
  ): number {
    let score = 0;
    let factors = 0;

    // Industry match
    const enrichedFields = (enrichment?.enrichedFields as any) || {};
    if (enrichedFields.industry?.value && agent.industries) {
      const industryMatch = agent.industries.includes(enrichedFields.industry.value);
      score += industryMatch ? 1 : 0;
      factors++;
    }

    // Company size match (enterprise vs SMB)
    if (enrichedFields.employee_count?.value) {
      const employeeCount = enrichedFields.employee_count.value;
      const isEnterprise = employeeCount > 1000;
      const hasEnterpriseSkill = agent.skills?.includes('enterprise');
      const hasSmbSkill = agent.skills?.includes('smb');

      if ((isEnterprise && hasEnterpriseSkill) || (!isEnterprise && hasSmbSkill)) {
        score += 1;
      }
      factors++;
    }

    // Technical complexity match
    if (enrichedFields.technologies && agent.skills?.includes('technical')) {
      score += 1;
      factors++;
    }

    return factors > 0 ? score / factors : 0.5; // Default 0.5 if no factors
  }

  /**
   * Gather all context needed for routing decision
   */
  private async gatherRoutingContext(
    leadId: string,
    workspaceId: string
  ): Promise<RoutingContext> {
    // Get lead
    const lead = await db.query.crmLeads.findFirst({
      where: and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)),
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // Get enrichment (latest completed)
    const enrichment = await db.query.leadEnrichments.findFirst({
      where: and(
        eq(leadEnrichments.leadId, leadId),
        eq(leadEnrichments.status, 'completed')
      ),
      orderBy: [desc(leadEnrichments.createdAt)],
    });

    // Get prediction (latest)
    const prediction = await db.query.leadPredictions.findFirst({
      where: eq(leadPredictions.leadId, leadId),
      orderBy: [desc(leadPredictions.createdAt)],
    });

    // Get available agents with capacity
    const availableAgents = await db.query.agentProfiles.findMany({
      where: and(
        eq(agentProfiles.workspaceId, workspaceId),
        eq(agentProfiles.availabilityStatus, 'available'),
        sql`${agentProfiles.currentLeadCount} < ${agentProfiles.maxConcurrentLeads}`
      ),
    });

    if (availableAgents.length === 0) {
      throw new Error('No available agents with capacity');
    }

    return { lead, enrichment, prediction, availableAgents };
  }

  /**
   * Evaluate routing rules
   */
  private async evaluateRoutingRules(
    context: RoutingContext,
    workspaceId: string
  ): Promise<RoutingRule | null> {
    const rules = await db.query.routingRules.findMany({
      where: and(eq(routingRules.workspaceId, workspaceId), eq(routingRules.isActive, true)),
      orderBy: [desc(routingRules.priority)],
    });

    for (const rule of rules) {
      const matches = this.evaluateRuleConditions(rule.conditions, context);
      if (matches) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Evaluate rule conditions against lead context
   */
  private evaluateRuleConditions(conditions: any, context: RoutingContext): boolean {
    // Simple condition evaluation (can be enhanced)
    // For now, just return false (no rule match)
    // In production, this would parse the JSONB conditions and evaluate them
    return false;
  }

  /**
   * Execute rule-based routing
   */
  private async executeRuleBasedRouting(
    rule: RoutingRule,
    context: RoutingContext
  ): Promise<RoutingResult> {
    // If rule specifies specific agent, route there
    if (rule.assignToAgentId) {
      const agent = context.availableAgents.find((a) => a.userId === rule.assignToAgentId);

      if (!agent) {
        throw new Error('Rule-specified agent not available');
      }

      return {
        routing_id: crypto.randomUUID(),
        assigned_agent_id: agent.userId,
        assigned_agent_name: `Agent ${agent.userId.substring(0, 8)}`,
        routing_reason: `Routing rule: ${rule.name}`,
        routing_score: 1.0,
        alternative_agents: [],
      };
    }

    // Otherwise, use rule's routing strategy
    const strategy = rule.routingStrategy || 'balanced';
    return this.routeLead(context.lead.id, context.lead.workspaceId, { strategy });
  }

  /**
   * Get alternative agents (top 3 after best)
   */
  private async getAlternativeAgents(
    context: RoutingContext,
    bestAgent: AgentProfile,
    strategy: RoutingStrategy
  ): Promise<Array<{ agent_id: string; agent_name: string; routing_score: number; reason: string }>> {
    // For simplicity, return empty array
    // In production, this would calculate scores for all agents and return top alternatives
    return [];
  }

  /**
   * Get agent capacity overview
   */
  async getAgentCapacity(workspaceId: string): Promise<any[]> {
    const agents = await db.query.agentProfiles.findMany({
      where: eq(agentProfiles.workspaceId, workspaceId),
    });

    return agents.map((agent) => ({
      agent_id: agent.userId,
      agent_name: `Agent ${agent.userId.substring(0, 8)}`,
      current_leads: agent.currentLeadCount,
      max_leads: agent.maxConcurrentLeads,
      capacity_percentage: (agent.currentLeadCount / agent.maxConcurrentLeads) * 100,
      availability_status: agent.availabilityStatus,
      skills: agent.skills,
      conversion_rate: agent.conversionRate,
    }));
  }
}

/**
 * Create routing service instance
 */
export function createRoutingService(): RoutingService {
  return new RoutingService();
}
