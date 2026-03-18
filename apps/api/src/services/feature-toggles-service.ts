/**
 * Feature Toggles Service
 *
 * Evaluation engine, CRUD operations, and quota tracking for feature flags.
 * Flags are org-scoped, supporting boolean and percentage rollout types
 * with targeting rules and environment overrides.
 */

import crypto from 'crypto';
import { sql } from '../lib/db';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  flag_type: 'boolean' | 'rollout';
  default_value: boolean;
  rollout_config: RolloutConfig;
  environment_overrides: Record<string, boolean>;
  enabled: boolean;
  source: 'yaml' | 'console';
  created_at: string;
  updated_at: string;
}

export interface RolloutConfig {
  percentage?: number;
  rules?: TargetingRule[];
}

export interface TargetingRule {
  attribute: string;
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'starts_with' | 'ends_with' | 'contains' | 'gt' | 'lt';
  value: string | string[] | number;
  result: boolean;
}

export interface EvaluateParams {
  flagName: string;
  userId?: string;
  environment?: string;
  context?: Record<string, unknown>;
  appId?: string;
}

export interface EvaluateResult {
  flagName: string;
  enabled: boolean;
  reason: string;
}

export interface FeatureFlagUsage {
  evaluations: number;
  quota: number;
  remaining: number;
  month: string;
}

export interface CreateFlagParams {
  name: string;
  description?: string;
  flagType?: 'boolean' | 'rollout';
  defaultValue?: boolean;
  rolloutConfig?: RolloutConfig;
  environmentOverrides?: Record<string, boolean>;
  enabled?: boolean;
}

// ─── Quota ──────────────────────────────────────────────────────────────────

async function getToggleQuotaLimit(orgId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(
      (bp.limits->>'feature_toggle_monthly_limit')::bigint,
      100000
    ) as toggle_limit
    FROM org_subscriptions os
    JOIN billing_plans bp ON bp.id = os.plan_id
    WHERE os.org_id = ${orgId}
  `;
  return rows.length > 0 ? Number(rows[0].toggle_limit) : 100000;
}

export async function getFeatureToggleUsage(orgId: string): Promise<FeatureFlagUsage> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  const [usageRows, quota] = await Promise.all([
    sql`
      SELECT evaluations FROM feature_toggle_usage
      WHERE organization_id = ${orgId} AND month = ${monthStr}
    `,
    getToggleQuotaLimit(orgId),
  ]);

  const evaluations = usageRows.length > 0 ? Number(usageRows[0].evaluations) : 0;
  const remaining = quota === 0 ? -1 : Math.max(0, quota - evaluations);

  return {
    evaluations,
    quota,
    remaining,
    month: monthStr,
  };
}

export async function checkFeatureToggleQuota(orgId: string): Promise<{ allowed: boolean; usage: FeatureFlagUsage }> {
  const usage = await getFeatureToggleUsage(orgId);
  const allowed = usage.quota === 0 || usage.evaluations < usage.quota;
  return { allowed, usage };
}

async function incrementEvaluationUsage(orgId: string, count: number): Promise<void> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  await sql`
    INSERT INTO feature_toggle_usage (organization_id, month, evaluations, updated_at)
    VALUES (${orgId}, ${monthStr}, ${count}, now())
    ON CONFLICT (organization_id, month)
    DO UPDATE SET evaluations = feature_toggle_usage.evaluations + ${count}, updated_at = now()
  `;
}

// ─── Evaluation Engine ──────────────────────────────────────────────────────

/**
 * Deterministic hash for percentage rollouts.
 * SHA-256 of "{flagName}:{userId}" mod 100 → 0-99.
 */
function hashPercentage(flagName: string, userId: string): number {
  const hash = crypto.createHash('sha256').update(`${flagName}:${userId}`).digest('hex');
  // Use the first 8 hex chars (32 bits) for the modulo
  const num = parseInt(hash.substring(0, 8), 16);
  return num % 100;
}

/**
 * Evaluate a single targeting rule against the context.
 */
function evaluateRule(rule: TargetingRule, context: Record<string, unknown>): boolean {
  const attrValue = context[rule.attribute];
  if (attrValue === undefined || attrValue === null) return false;

  const strValue = String(attrValue);

  switch (rule.operator) {
    case 'eq':
      return strValue === String(rule.value);
    case 'ne':
      return strValue !== String(rule.value);
    case 'in':
      if (Array.isArray(rule.value)) {
        return rule.value.includes(strValue);
      }
      return false;
    case 'not_in':
      if (Array.isArray(rule.value)) {
        return !rule.value.includes(strValue);
      }
      return true;
    case 'starts_with':
      return strValue.startsWith(String(rule.value));
    case 'ends_with':
      return strValue.endsWith(String(rule.value));
    case 'contains':
      return strValue.includes(String(rule.value));
    case 'gt':
      return Number(attrValue) > Number(rule.value);
    case 'lt':
      return Number(attrValue) < Number(rule.value);
    default:
      return false;
  }
}

/**
 * Evaluate a single flag against the given context.
 * Order of precedence:
 * 1. Flag disabled → false
 * 2. Environment override → override value
 * 3. Targeting rules (first match wins) → rule's result
 * 4. Percentage rollout → hash-based in/out
 * 5. Default value
 */
function evaluateFlagLogic(flag: FeatureFlag, params: EvaluateParams): EvaluateResult {
  // 1. Kill switch
  if (!flag.enabled) {
    return { flagName: flag.name, enabled: false, reason: 'disabled' };
  }

  // 2. Environment override
  if (params.environment && flag.environment_overrides) {
    const override = flag.environment_overrides[params.environment];
    if (override !== undefined) {
      return { flagName: flag.name, enabled: override, reason: `environment_override:${params.environment}` };
    }
  }

  // 3. Targeting rules (first match wins)
  const rules = flag.rollout_config?.rules;
  if (rules && rules.length > 0 && params.context) {
    for (let i = 0; i < rules.length; i++) {
      if (evaluateRule(rules[i], params.context)) {
        return { flagName: flag.name, enabled: rules[i].result, reason: `rule:${i}:${rules[i].attribute}` };
      }
    }
  }

  // 4. Percentage rollout
  if (flag.flag_type === 'rollout' && flag.rollout_config?.percentage !== undefined) {
    if (!params.userId) {
      // No userId — fall through to default
      return { flagName: flag.name, enabled: flag.default_value, reason: 'rollout_no_user' };
    }
    const bucket = hashPercentage(flag.name, params.userId);
    const inRollout = bucket < flag.rollout_config.percentage;
    return { flagName: flag.name, enabled: inRollout, reason: `rollout:${bucket}/${flag.rollout_config.percentage}` };
  }

  // 5. Default value
  return { flagName: flag.name, enabled: flag.default_value, reason: 'default' };
}

/**
 * Evaluate a single flag with quota check and usage tracking.
 */
export async function evaluateFlag(orgId: string, params: EvaluateParams): Promise<EvaluateResult> {
  const flags = await sql`
    SELECT * FROM feature_flags
    WHERE organization_id = ${orgId} AND name = ${params.flagName}
  `;

  if (flags.length === 0) {
    return { flagName: params.flagName, enabled: false, reason: 'not_found' };
  }

  const flag = flags[0] as unknown as FeatureFlag;
  const result = evaluateFlagLogic(flag, params);

  // Increment usage (fire-and-forget)
  incrementEvaluationUsage(orgId, 1).catch(() => {});

  // Sample log (1 in 100 evaluations)
  if (Math.random() < 0.01) {
    logEvaluation(orgId, params, result).catch(() => {});
  }

  return result;
}

/**
 * Evaluate multiple flags in a single DB query.
 */
export async function bulkEvaluateFlags(
  orgId: string,
  flagNames: string[],
  params: Omit<EvaluateParams, 'flagName'>
): Promise<EvaluateResult[]> {
  const flags = await sql`
    SELECT * FROM feature_flags
    WHERE organization_id = ${orgId} AND name = ANY(${flagNames})
  `;

  const flagMap = new Map<string, FeatureFlag>();
  for (const f of flags) {
    flagMap.set((f as unknown as FeatureFlag).name, f as unknown as FeatureFlag);
  }

  const results: EvaluateResult[] = [];
  for (const name of flagNames) {
    const flag = flagMap.get(name);
    if (!flag) {
      results.push({ flagName: name, enabled: false, reason: 'not_found' });
    } else {
      results.push(evaluateFlagLogic(flag, { ...params, flagName: name }));
    }
  }

  // Increment usage for all evaluations
  incrementEvaluationUsage(orgId, flagNames.length).catch(() => {});

  return results;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createFlag(orgId: string, params: CreateFlagParams): Promise<FeatureFlag> {
  const rows = await sql`
    INSERT INTO feature_flags (
      organization_id, name, description, flag_type, default_value,
      rollout_config, environment_overrides, enabled
    ) VALUES (
      ${orgId},
      ${params.name},
      ${params.description || null},
      ${params.flagType || 'boolean'},
      ${params.defaultValue ?? false},
      ${sql.json((params.rolloutConfig || {}) as any)},
      ${sql.json((params.environmentOverrides || {}) as any)},
      ${params.enabled ?? true}
    )
    RETURNING *
  `;
  return rows[0] as unknown as FeatureFlag;
}

export async function listFlags(orgId: string): Promise<FeatureFlag[]> {
  const rows = await sql`
    SELECT * FROM feature_flags
    WHERE organization_id = ${orgId}
    ORDER BY name ASC
  `;
  return rows as unknown as FeatureFlag[];
}

export async function getFlag(orgId: string, name: string): Promise<FeatureFlag | null> {
  const rows = await sql`
    SELECT * FROM feature_flags
    WHERE organization_id = ${orgId} AND name = ${name}
  `;
  return rows.length > 0 ? (rows[0] as unknown as FeatureFlag) : null;
}

export async function updateFlag(orgId: string, name: string, updates: Partial<CreateFlagParams> & { enabled?: boolean }): Promise<FeatureFlag | null> {
  // Build dynamic update — only set provided fields
  const flag = await getFlag(orgId, name);
  if (!flag) return null;

  const rows = await sql`
    UPDATE feature_flags SET
      description = ${updates.description !== undefined ? updates.description : flag.description},
      flag_type = ${updates.flagType || flag.flag_type},
      default_value = ${updates.defaultValue !== undefined ? updates.defaultValue : flag.default_value},
      rollout_config = ${sql.json((updates.rolloutConfig !== undefined ? updates.rolloutConfig : flag.rollout_config) as any)},
      environment_overrides = ${sql.json((updates.environmentOverrides !== undefined ? updates.environmentOverrides : flag.environment_overrides) as any)},
      enabled = ${updates.enabled !== undefined ? updates.enabled : flag.enabled}
    WHERE organization_id = ${orgId} AND name = ${name}
    RETURNING *
  `;
  return rows.length > 0 ? (rows[0] as unknown as FeatureFlag) : null;
}

export async function deleteFlag(orgId: string, name: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM feature_flags
    WHERE organization_id = ${orgId} AND name = ${name}
    RETURNING id
  `;
  return rows.length > 0;
}

// ─── Logging ────────────────────────────────────────────────────────────────

async function logEvaluation(
  orgId: string,
  params: EvaluateParams,
  result: EvaluateResult
): Promise<void> {
  await sql`
    INSERT INTO feature_toggle_logs (
      organization_id, app_id, flag_name, user_id, environment, result, matched_rule
    ) VALUES (
      ${orgId},
      ${params.appId || null},
      ${params.flagName},
      ${params.userId || null},
      ${params.environment || null},
      ${result.enabled},
      ${result.reason}
    )
  `;
}
