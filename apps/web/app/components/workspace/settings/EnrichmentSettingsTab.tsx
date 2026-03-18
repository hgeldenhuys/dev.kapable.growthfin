/**
 * Enrichment Settings Tab (CRM-004)
 * Configure lead enrichment provider settings, rate limits, and budget
 */

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Badge } from "../../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Switch } from "../../ui/switch";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  Zap,
} from "lucide-react";
import { Progress } from "../../ui/progress";

interface EnrichmentConfig {
  workspaceId: string;
  autoEnrichNewLeads: boolean;
  autoEnrichFields: string[];
  provider: "mock" | "clearbit" | "zoominfo" | "real" | "hybrid";
  rateLimitPerHour: number;
  linkedinRateLimitPerHour: number;
  zerobounceRateLimitPerHour: number;
  websearchRateLimitPerHour: number;
  linkedinCostPerCall: string;
  zerobounceCostPerCall: string;
  websearchCostPerCall: string;
  budgetLimitMonthly: string | null;
  budgetUsedThisMonth: string;
  budgetResetDay: number;
  minConfidenceToApply: string;
  apiKeyConfigured: {
    linkedin: boolean;
    zerobounce: boolean;
    brave: boolean;
    perplexity: boolean;
  };
}

interface CostSummary {
  costs: {
    total: number;
    budgetLimit: number | null;
    budgetRemaining: number | null;
    budgetUsedPercent: number | null;
  };
  enrichments: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  rates: {
    linkedinCostPerCall: number;
    zerobounceCostPerCall: number;
    websearchCostPerCall: number;
  };
}

interface ProviderTestResult {
  connected: boolean;
  message: string;
}

interface EnrichmentSettingsTabProps {
  workspaceId: string;
  userRole: string;
}

export function EnrichmentSettingsTab({
  workspaceId,
  userRole,
}: EnrichmentSettingsTabProps) {
  const [config, setConfig] = useState<EnrichmentConfig | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult> | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const canEdit = userRole === "owner" || userRole === "admin";

  // Load config on mount
  useEffect(() => {
    loadConfig();
    loadCostSummary();
  }, [workspaceId]);

  async function loadConfig() {
    try {
      const response = await fetch(
        `/api/v1/crm/enrichment/config?workspaceId=${workspaceId}`
      );
      if (!response.ok) throw new Error("Failed to load config");
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error("Failed to load enrichment config:", error);
      toast.error("Failed to load enrichment settings");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCostSummary() {
    try {
      const response = await fetch(
        `/api/v1/crm/enrichment/config/costs?workspaceId=${workspaceId}`
      );
      if (!response.ok) throw new Error("Failed to load costs");
      const data = await response.json();
      setCostSummary(data);
    } catch (error) {
      console.error("Failed to load cost summary:", error);
    }
  }

  async function handleSave() {
    if (!config) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/crm/enrichment/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          autoEnrichNewLeads: config.autoEnrichNewLeads,
          provider: config.provider,
          rateLimitPerHour: config.rateLimitPerHour,
          linkedinRateLimitPerHour: config.linkedinRateLimitPerHour,
          zerobounceRateLimitPerHour: config.zerobounceRateLimitPerHour,
          websearchRateLimitPerHour: config.websearchRateLimitPerHour,
          budgetLimitMonthly: config.budgetLimitMonthly
            ? parseFloat(config.budgetLimitMonthly)
            : null,
          budgetResetDay: config.budgetResetDay,
          minConfidenceToApply: parseFloat(config.minConfidenceToApply),
        }),
      });

      if (!response.ok) throw new Error("Failed to save config");

      toast.success("Enrichment settings saved");
      setHasChanges(false);
      loadCostSummary(); // Refresh costs
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnections() {
    setIsTesting(true);
    setTestResults(null);

    try {
      const response = await fetch(`/api/v1/crm/enrichment/config/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      if (!response.ok) throw new Error("Test failed");

      const data = await response.json();
      setTestResults(data.providers);

      if (data.allConnected) {
        toast.success("All providers connected successfully");
      } else {
        toast.warning("Some providers are not configured");
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      toast.error("Failed to test connections");
    } finally {
      setIsTesting(false);
    }
  }

  function updateConfig(updates: Partial<EnrichmentConfig>) {
    if (!config) return;
    setConfig({ ...config, ...updates });
    setHasChanges(true);
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load enrichment settings
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Enrichment Provider
          </CardTitle>
          <CardDescription>
            Choose how lead data is enriched. Real providers use external APIs
            (LinkedIn, ZeroBounce, web search) while mock uses simulated data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Provider Mode</Label>
            <Select
              value={config.provider}
              onValueChange={(value: EnrichmentConfig["provider"]) =>
                updateConfig({ provider: value })
              }
              disabled={!canEdit}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Mock</Badge>
                    <span>Simulated data (free, for testing)</span>
                  </div>
                </SelectItem>
                <SelectItem value="real">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Real</Badge>
                    <span>External APIs (LinkedIn, ZeroBounce, web search)</span>
                  </div>
                </SelectItem>
                <SelectItem value="hybrid">
                  <div className="flex items-center gap-2">
                    <Badge>Hybrid</Badge>
                    <span>Real APIs with mock fallback on failure</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* API Status Indicators */}
          <div className="space-y-2">
            <Label>API Key Status</Label>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(config.apiKeyConfigured).map(([provider, configured]) => (
                <div
                  key={provider}
                  className="flex items-center gap-2 p-2 rounded-md border"
                >
                  {configured ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="capitalize">{provider}</span>
                  <Badge
                    variant={configured ? "default" : "outline"}
                    className="ml-auto"
                  >
                    {configured ? "Configured" : "Not Set"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Test Connection Button */}
          <Button
            variant="outline"
            onClick={handleTestConnections}
            disabled={isTesting}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Test Connections
          </Button>

          {/* Test Results */}
          {testResults && (
            <div className="space-y-2">
              {Object.entries(testResults).map(([provider, result]) => (
                <div
                  key={provider}
                  className={`p-3 rounded-md border ${
                    result.connected
                      ? "border-green-200 bg-green-50 dark:bg-green-950/20"
                      : "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.connected ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium capitalize">{provider}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.message}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Auto-enrich Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-enrich New Leads</Label>
              <p className="text-sm text-muted-foreground">
                Automatically enrich leads when they are imported
              </p>
            </div>
            <Switch
              checked={config.autoEnrichNewLeads}
              onCheckedChange={(checked) =>
                updateConfig({ autoEnrichNewLeads: checked })
              }
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Rate Limits
          </CardTitle>
          <CardDescription>
            Configure API call limits per hour to control costs and prevent abuse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin-limit">LinkedIn (per hour)</Label>
              <Input
                id="linkedin-limit"
                type="number"
                min="1"
                max="100"
                value={config.linkedinRateLimitPerHour}
                onChange={(e) =>
                  updateConfig({
                    linkedinRateLimitPerHour: parseInt(e.target.value) || 5,
                  })
                }
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                $0.01 per call
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zerobounce-limit">ZeroBounce (per hour)</Label>
              <Input
                id="zerobounce-limit"
                type="number"
                min="1"
                max="500"
                value={config.zerobounceRateLimitPerHour}
                onChange={(e) =>
                  updateConfig({
                    zerobounceRateLimitPerHour: parseInt(e.target.value) || 20,
                  })
                }
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                $0.008 per call
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="websearch-limit">Web Search (per hour)</Label>
              <Input
                id="websearch-limit"
                type="number"
                min="1"
                max="500"
                value={config.websearchRateLimitPerHour}
                onChange={(e) =>
                  updateConfig({
                    websearchRateLimitPerHour: parseInt(e.target.value) || 60,
                  })
                }
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                $0.001-0.005 per call
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overall-limit">Overall (per hour)</Label>
              <Input
                id="overall-limit"
                type="number"
                min="1"
                max="1000"
                value={config.rateLimitPerHour}
                onChange={(e) =>
                  updateConfig({
                    rateLimitPerHour: parseInt(e.target.value) || 100,
                  })
                }
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Total enrichments
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confidence">Minimum Confidence Threshold</Label>
            <Input
              id="confidence"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={config.minConfidenceToApply}
              onChange={(e) =>
                updateConfig({
                  minConfidenceToApply: e.target.value,
                })
              }
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">
              Only apply enriched data with confidence above this threshold (0-1)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Budget & Costs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget & Costs
          </CardTitle>
          <CardDescription>
            Set monthly budget limits and track enrichment costs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget-limit">Monthly Budget Limit ($)</Label>
              <Input
                id="budget-limit"
                type="number"
                min="0"
                step="1"
                placeholder="No limit"
                value={config.budgetLimitMonthly || ""}
                onChange={(e) =>
                  updateConfig({
                    budgetLimitMonthly: e.target.value || null,
                  })
                }
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for unlimited
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-day">Budget Reset Day</Label>
              <Input
                id="reset-day"
                type="number"
                min="1"
                max="28"
                value={config.budgetResetDay}
                onChange={(e) =>
                  updateConfig({
                    budgetResetDay: parseInt(e.target.value) || 1,
                  })
                }
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Day of month to reset budget
              </p>
            </div>
          </div>

          {/* Cost Summary */}
          {costSummary && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium">Current Period Summary</h4>

              {costSummary.costs.budgetLimit && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Budget Used</span>
                    <span>
                      ${costSummary.costs.total.toFixed(2)} / $
                      {costSummary.costs.budgetLimit.toFixed(2)}
                    </span>
                  </div>
                  <Progress
                    value={costSummary.costs.budgetUsedPercent || 0}
                    className="h-2"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Enrichments</p>
                  <p className="text-2xl font-bold">{costSummary.enrichments.total}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {costSummary.enrichments.successRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold">
                    ${costSummary.costs.total.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
