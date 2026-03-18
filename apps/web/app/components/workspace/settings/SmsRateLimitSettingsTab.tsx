/**
 * SMS Rate Limit Settings Tab (Phase H.3)
 * Configure SMS rate limiting for bulk campaigns
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Switch } from "../../ui/switch";
import { Badge } from "../../ui/badge";
import { toast } from "sonner";
import { Save, RefreshCw, MessageSquare, Clock, AlertTriangle } from "lucide-react";
import { Progress } from "../../ui/progress";

interface SmsRateLimitSettingsTabProps {
  workspaceId: string;
  userRole: string;
}

interface SmsRateLimitSettings {
  enabled: boolean;
  smsPerMinute?: number;
  smsPerHour?: number;
  smsPerDay?: number;
  batchSize?: number;
  batchDelayMs?: number;
}

interface UsageStats {
  minute: { current: number; limit: number; remaining: number; resetAt: string };
  hour: { current: number; limit: number; remaining: number; resetAt: string };
  day: { current: number; limit: number; remaining: number; resetAt: string };
}

export function SmsRateLimitSettingsTab({
  workspaceId,
  userRole,
}: SmsRateLimitSettingsTabProps) {
  const [settings, setSettings] = useState<SmsRateLimitSettings>({
    enabled: true,
    smsPerMinute: 60,
    smsPerHour: 1000,
    smsPerDay: 10000,
    batchSize: 100,
    batchDelayMs: 1000,
  });
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = userRole === "owner" || userRole === "admin";

  // Fetch current settings and usage
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch(
          `/api/v1/crm/workspaces/${workspaceId}/sms-rate-limit`
        );
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings);
          setUsage(data.usage);
        }
      } catch (error) {
        console.error("Failed to fetch SMS rate limit settings:", error);
        toast.error("Failed to load SMS rate limit settings");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [workspaceId]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/sms-rate-limit`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update settings");
      }

      toast.success("SMS rate limit settings updated successfully");
    } catch (error) {
      console.error("Failed to update SMS rate limit settings:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update settings"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefreshUsage() {
    try {
      const response = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/sms-rate-limit`
      );
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage);
        toast.success("Usage statistics refreshed");
      }
    } catch (error) {
      console.error("Failed to refresh usage:", error);
      toast.error("Failed to refresh usage statistics");
    }
  }

  function formatTimeUntilReset(resetAt: string): string {
    const now = new Date();
    const reset = new Date(resetAt);
    const diffMs = reset.getTime() - now.getTime();

    if (diffMs <= 0) return "Resets now";

    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    if (minutes > 0) {
      return `Resets in ${minutes}m ${seconds}s`;
    }
    return `Resets in ${seconds}s`;
  }

  function getUsageColor(current: number, limit: number): string {
    const percentage = (current / limit) * 100;
    if (percentage >= 90) return "text-destructive";
    if (percentage >= 70) return "text-yellow-600";
    return "text-green-600";
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading SMS rate limit settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>SMS Rate Limiting</CardTitle>
          </div>
          <CardDescription>
            Configure rate limits for bulk SMS campaigns to prevent throttling and ensure deliverability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="rate-limit-enabled">Enable Rate Limiting</Label>
              <p className="text-xs text-muted-foreground">
                When disabled, messages are sent without rate limits
              </p>
            </div>
            <Switch
              id="rate-limit-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              disabled={!canEdit}
            />
          </div>

          {settings.enabled && (
            <>
              {/* Rate Limits Section */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Message Limits</h4>

                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Per Minute */}
                  <div className="space-y-2">
                    <Label htmlFor="sms-per-minute">Per Minute</Label>
                    <Input
                      id="sms-per-minute"
                      type="number"
                      min={1}
                      max={500}
                      value={settings.smsPerMinute || 60}
                      onChange={(e) => setSettings({ ...settings, smsPerMinute: parseInt(e.target.value) || 60 })}
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">1-500 SMS/min</p>
                  </div>

                  {/* Per Hour */}
                  <div className="space-y-2">
                    <Label htmlFor="sms-per-hour">Per Hour</Label>
                    <Input
                      id="sms-per-hour"
                      type="number"
                      min={1}
                      max={10000}
                      value={settings.smsPerHour || 1000}
                      onChange={(e) => setSettings({ ...settings, smsPerHour: parseInt(e.target.value) || 1000 })}
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">1-10,000 SMS/hr</p>
                  </div>

                  {/* Per Day */}
                  <div className="space-y-2">
                    <Label htmlFor="sms-per-day">Per Day</Label>
                    <Input
                      id="sms-per-day"
                      type="number"
                      min={1}
                      max={100000}
                      value={settings.smsPerDay || 10000}
                      onChange={(e) => setSettings({ ...settings, smsPerDay: parseInt(e.target.value) || 10000 })}
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">1-100,000 SMS/day</p>
                  </div>
                </div>
              </div>

              {/* Batch Settings Section */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Batch Processing</h4>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Batch Size */}
                  <div className="space-y-2">
                    <Label htmlFor="batch-size">Batch Size</Label>
                    <Input
                      id="batch-size"
                      type="number"
                      min={1}
                      max={500}
                      value={settings.batchSize || 100}
                      onChange={(e) => setSettings({ ...settings, batchSize: parseInt(e.target.value) || 100 })}
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">
                      Messages sent in parallel per batch (1-500)
                    </p>
                  </div>

                  {/* Batch Delay */}
                  <div className="space-y-2">
                    <Label htmlFor="batch-delay">Batch Delay (ms)</Label>
                    <Input
                      id="batch-delay"
                      type="number"
                      min={100}
                      max={10000}
                      step={100}
                      value={settings.batchDelayMs || 1000}
                      onChange={(e) => setSettings({ ...settings, batchDelayMs: parseInt(e.target.value) || 1000 })}
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground">
                      Pause between batches (100-10,000 ms)
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Save Button */}
          {canEdit && (
            <div className="pt-4 border-t">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Settings
              </Button>
            </div>
          )}

          {!canEdit && (
            <p className="text-xs text-muted-foreground pt-4 border-t">
              Only workspace owners and admins can modify rate limit settings
            </p>
          )}
        </CardContent>
      </Card>

      {/* Usage Statistics Card */}
      {usage && settings.enabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <CardTitle>Current Usage</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefreshUsage}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
            <CardDescription>
              Real-time SMS usage against configured limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Per Minute Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Per Minute</Label>
                <div className="flex items-center gap-2">
                  <span className={getUsageColor(usage.minute.current, usage.minute.limit)}>
                    {usage.minute.current} / {usage.minute.limit}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {formatTimeUntilReset(usage.minute.resetAt)}
                  </Badge>
                </div>
              </div>
              <Progress
                value={(usage.minute.current / usage.minute.limit) * 100}
                className="h-2"
              />
            </div>

            {/* Per Hour Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Per Hour</Label>
                <div className="flex items-center gap-2">
                  <span className={getUsageColor(usage.hour.current, usage.hour.limit)}>
                    {usage.hour.current} / {usage.hour.limit}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {formatTimeUntilReset(usage.hour.resetAt)}
                  </Badge>
                </div>
              </div>
              <Progress
                value={(usage.hour.current / usage.hour.limit) * 100}
                className="h-2"
              />
            </div>

            {/* Per Day Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Per Day</Label>
                <div className="flex items-center gap-2">
                  <span className={getUsageColor(usage.day.current, usage.day.limit)}>
                    {usage.day.current} / {usage.day.limit}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {formatTimeUntilReset(usage.day.resetAt)}
                  </Badge>
                </div>
              </div>
              <Progress
                value={(usage.day.current / usage.day.limit) * 100}
                className="h-2"
              />
            </div>

            {/* Warning if any limit is near */}
            {(usage.minute.current / usage.minute.limit >= 0.9 ||
              usage.hour.current / usage.hour.limit >= 0.9 ||
              usage.day.current / usage.day.limit >= 0.9) && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Approaching Rate Limit
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Campaign sends may be delayed until limits reset.
                    Consider increasing limits or waiting for the reset window.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
