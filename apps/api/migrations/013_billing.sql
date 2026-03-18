-- Migration 013: Billing System
-- Creates tables for billing plans, subscriptions, usage metrics, invoices, and payment methods

-- Billing plans
CREATE TABLE IF NOT EXISTS billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- 'hobbyist', 'pro', 'business', 'enterprise'
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly INT NOT NULL DEFAULT 0,  -- cents
  price_yearly INT NOT NULL DEFAULT 0,   -- cents
  features JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',  -- row_limit, storage_limit_mb, api_calls_limit, projects_limit
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organization subscriptions
CREATE TABLE IF NOT EXISTS org_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES billing_plans(id),
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',  -- 'monthly', 'yearly'
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 month'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Usage metrics (aggregated daily)
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,  -- NULL for org-level metrics
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL,  -- 'api_calls', 'rows', 'storage_bytes', 'bandwidth_bytes', 'ws_connections', 'sse_connections'
  value BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, project_id, metric_date, metric_type)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES org_subscriptions(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  stripe_invoice_id TEXT UNIQUE,
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  line_items JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,  -- 'card', 'bank_account', 'sepa_debit'
  last_four TEXT,
  brand TEXT,  -- 'visa', 'mastercard', 'amex', etc
  exp_month INT,
  exp_year INT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  billing_details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage alerts (for limit notifications)
CREATE TABLE IF NOT EXISTS usage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  threshold_percent INT NOT NULL,  -- 80, 90, 100
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON org_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON org_subscriptions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON org_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_org_date ON usage_metrics(org_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_usage_project_date ON usage_metrics(project_id, metric_date) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_type_date ON usage_metrics(metric_type, metric_date);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status) WHERE status IN ('open', 'draft');
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON payment_methods(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(org_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_usage_alerts_org ON usage_alerts(org_id, triggered_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trigger_billing_plans_updated_at ON billing_plans;
CREATE TRIGGER trigger_billing_plans_updated_at
  BEFORE UPDATE ON billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON org_subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON org_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON invoices;
CREATE TRIGGER trigger_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS trigger_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER trigger_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_updated_at();

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_month TEXT;
  seq_num INT;
BEGIN
  year_month := to_char(now(), 'YYYYMM');

  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INT)), 0) + 1
  INTO seq_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_month || '-%';

  RETURN 'INV-' || year_month || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to check if org is within limits
CREATE OR REPLACE FUNCTION check_org_limits(
  p_org_id UUID,
  p_metric_type TEXT
)
RETURNS TABLE (
  within_limit BOOLEAN,
  current_value BIGINT,
  limit_value BIGINT,
  percent_used NUMERIC
) AS $$
DECLARE
  v_plan_limits JSONB;
  v_current_value BIGINT;
  v_limit_value BIGINT;
  v_limit_key TEXT;
BEGIN
  -- Get plan limits
  SELECT bp.limits INTO v_plan_limits
  FROM org_subscriptions os
  JOIN billing_plans bp ON bp.id = os.plan_id
  WHERE os.org_id = p_org_id AND os.status = 'active';

  IF NOT FOUND THEN
    -- No active subscription, use free tier limits
    v_plan_limits := '{"api_calls_limit": 10000, "rows_limit": 10000, "storage_limit_mb": 100}'::jsonb;
  END IF;

  -- Map metric type to limit key
  CASE p_metric_type
    WHEN 'api_calls' THEN v_limit_key := 'api_calls_limit';
    WHEN 'rows' THEN v_limit_key := 'rows_limit';
    WHEN 'storage_bytes' THEN v_limit_key := 'storage_limit_mb';
    ELSE v_limit_key := p_metric_type || '_limit';
  END CASE;

  -- Get limit value
  v_limit_value := COALESCE((v_plan_limits->>v_limit_key)::BIGINT, 0);

  -- For storage, convert MB to bytes
  IF p_metric_type = 'storage_bytes' THEN
    v_limit_value := v_limit_value * 1024 * 1024;
  END IF;

  -- Get current month's usage
  SELECT COALESCE(SUM(value), 0) INTO v_current_value
  FROM usage_metrics
  WHERE org_id = p_org_id
    AND metric_type = p_metric_type
    AND metric_date >= date_trunc('month', CURRENT_DATE);

  -- Return results
  RETURN QUERY SELECT
    v_limit_value = 0 OR v_current_value < v_limit_value AS within_limit,
    v_current_value AS current_value,
    v_limit_value AS limit_value,
    CASE WHEN v_limit_value > 0
      THEN ROUND((v_current_value::NUMERIC / v_limit_value) * 100, 2)
      ELSE 0
    END AS percent_used;
END;
$$ LANGUAGE plpgsql;

-- Function to record daily usage
CREATE OR REPLACE FUNCTION record_usage(
  p_org_id UUID,
  p_project_id UUID,
  p_metric_type TEXT,
  p_value BIGINT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_metrics (org_id, project_id, metric_date, metric_type, value)
  VALUES (p_org_id, p_project_id, CURRENT_DATE, p_metric_type, p_value)
  ON CONFLICT (org_id, project_id, metric_date, metric_type)
  DO UPDATE SET value = usage_metrics.value + EXCLUDED.value;
END;
$$ LANGUAGE plpgsql;

-- Function to get usage summary
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_org_id UUID,
  p_start_date DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  metric_type TEXT,
  total_value BIGINT,
  limit_value BIGINT,
  percent_used NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH metrics AS (
    SELECT um.metric_type, SUM(um.value) as total_value
    FROM usage_metrics um
    WHERE um.org_id = p_org_id
      AND um.metric_date BETWEEN p_start_date AND p_end_date
    GROUP BY um.metric_type
  ),
  limits AS (
    SELECT
      bp.limits->>'api_calls_limit' as api_calls_limit,
      bp.limits->>'rows_limit' as rows_limit,
      (bp.limits->>'storage_limit_mb')::BIGINT * 1024 * 1024 as storage_limit
    FROM org_subscriptions os
    JOIN billing_plans bp ON bp.id = os.plan_id
    WHERE os.org_id = p_org_id AND os.status = 'active'
  )
  SELECT
    m.metric_type,
    m.total_value,
    CASE m.metric_type
      WHEN 'api_calls' THEN COALESCE(l.api_calls_limit::BIGINT, 10000)
      WHEN 'rows' THEN COALESCE(l.rows_limit::BIGINT, 10000)
      WHEN 'storage_bytes' THEN COALESCE(l.storage_limit, 104857600)
      ELSE 0
    END as limit_value,
    CASE m.metric_type
      WHEN 'api_calls' THEN ROUND((m.total_value::NUMERIC / GREATEST(COALESCE(l.api_calls_limit::BIGINT, 10000), 1)) * 100, 2)
      WHEN 'rows' THEN ROUND((m.total_value::NUMERIC / GREATEST(COALESCE(l.rows_limit::BIGINT, 10000), 1)) * 100, 2)
      WHEN 'storage_bytes' THEN ROUND((m.total_value::NUMERIC / GREATEST(COALESCE(l.storage_limit, 104857600), 1)) * 100, 2)
      ELSE 0
    END as percent_used
  FROM metrics m
  CROSS JOIN (SELECT * FROM limits LIMIT 1) l;
END;
$$ LANGUAGE plpgsql;

-- Seed default billing plans
INSERT INTO billing_plans (name, display_name, description, price_monthly, price_yearly, features, limits, sort_order)
VALUES
  (
    'hobbyist',
    'Hobbyist',
    'Perfect for side projects and learning',
    0,
    0,
    '{"realtime": true, "webhooks": false, "direct_db": false, "support": "community"}'::jsonb,
    '{"api_calls_limit": 10000, "rows_limit": 10000, "storage_limit_mb": 100, "projects_limit": 3}'::jsonb,
    1
  ),
  (
    'pro',
    'Pro',
    'For growing applications',
    2900,  -- $29/month
    29000, -- $290/year
    '{"realtime": true, "webhooks": true, "direct_db": false, "support": "email"}'::jsonb,
    '{"api_calls_limit": 100000, "rows_limit": 100000, "storage_limit_mb": 1000, "projects_limit": 10}'::jsonb,
    2
  ),
  (
    'business',
    'Business',
    'For teams and businesses',
    9900,   -- $99/month
    99000,  -- $990/year
    '{"realtime": true, "webhooks": true, "direct_db": true, "support": "priority"}'::jsonb,
    '{"api_calls_limit": 1000000, "rows_limit": 1000000, "storage_limit_mb": 10000, "projects_limit": 50}'::jsonb,
    3
  ),
  (
    'enterprise',
    'Enterprise',
    'Custom solutions for large organizations',
    0,  -- Custom pricing
    0,
    '{"realtime": true, "webhooks": true, "direct_db": true, "support": "dedicated", "sla": true, "custom_domain": true}'::jsonb,
    '{"api_calls_limit": 0, "rows_limit": 0, "storage_limit_mb": 0, "projects_limit": 0}'::jsonb, -- 0 = unlimited
    4
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  sort_order = EXCLUDED.sort_order;

-- Comments
COMMENT ON TABLE billing_plans IS 'Subscription plan definitions with pricing and limits';
COMMENT ON TABLE org_subscriptions IS 'Active subscriptions for organizations';
COMMENT ON TABLE usage_metrics IS 'Daily usage metrics for billing and monitoring';
COMMENT ON TABLE invoices IS 'Invoice records for billing';
COMMENT ON TABLE payment_methods IS 'Stored payment methods for organizations';
COMMENT ON TABLE usage_alerts IS 'Usage threshold alerts for notifications';
