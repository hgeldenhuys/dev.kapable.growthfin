/**
 * AI Voice Message Step Component (Phase N)
 * Campaign wizard step for configuring AI voice calling
 *
 * Features:
 * - Script selection from available AI call scripts
 * - Calling hours configuration (timezone-aware)
 * - Retry settings
 * - Estimated completion time based on queue size
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Clock,
  RefreshCw,
  Phone,
  Calendar,
  Settings2,
  AlertCircle,
  CheckCircle,
  Target,
  MessageSquare,
  HelpCircle,
  Star,
} from 'lucide-react';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Slider } from '~/components/ui/slider';
import { cn } from '~/lib/utils';

export interface AiCallConfig {
  maxAttempts?: number;
  retryDelayMinutes?: number;
  preferredHours?: string;
  timezone?: string;
  concurrentCalls?: number;
}

export interface AiVoiceMessageStepProps {
  workspaceId: string;
  selectedScriptId: string | null;
  aiCallConfig: AiCallConfig;
  onScriptChange: (scriptId: string | null) => void;
  onConfigChange: (config: AiCallConfig) => void;
  recipientCount?: number;
}

interface AiCallScript {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  objective?: string;
  isDefault: boolean;
  isActive: boolean;
  successRate?: string;
}

// Default values matching AI_VOICE_DEFAULTS
const DEFAULT_CONFIG: AiCallConfig = {
  maxAttempts: 3,
  retryDelayMinutes: 30,
  preferredHours: '09:00-18:00',
  timezone: 'UTC',
  concurrentCalls: 1,
};

// Common timezones
const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST)' },
];

export function AiVoiceMessageStep({
  workspaceId,
  selectedScriptId,
  aiCallConfig,
  onScriptChange,
  onConfigChange,
  recipientCount = 0,
}: AiVoiceMessageStepProps) {
  // Merge defaults with provided config
  const config = { ...DEFAULT_CONFIG, ...aiCallConfig };

  // Fetch available AI call scripts
  const { data: scriptsData, isLoading: isLoadingScripts } = useQuery({
    queryKey: ['ai-call-scripts', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/crm/ai-call-scripts?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to load scripts');
      return response.json() as Promise<{ scripts: AiCallScript[] }>;
    },
  });

  const scripts = scriptsData?.scripts ?? [];
  const activeScripts = scripts.filter((s) => s.isActive);
  const selectedScript = scripts.find((s) => s.id === selectedScriptId);

  // Auto-select default script if none selected
  useEffect(() => {
    if (!selectedScriptId && activeScripts.length > 0) {
      const defaultScript = activeScripts.find((s) => s.isDefault) || activeScripts[0];
      onScriptChange(defaultScript.id);
    }
  }, [selectedScriptId, activeScripts, onScriptChange]);

  // Parse preferred hours
  const [hoursStart, hoursEnd] = (config.preferredHours || '09:00-18:00').split('-');

  const handleHoursChange = (type: 'start' | 'end', value: string) => {
    const newStart = type === 'start' ? value : hoursStart;
    const newEnd = type === 'end' ? value : hoursEnd;
    onConfigChange({ ...config, preferredHours: `${newStart}-${newEnd}` });
  };

  // Calculate estimated completion time
  const estimatedMinutes = recipientCount * ((config.maxAttempts || 3) * 5); // ~5 min per call attempt
  const estimatedHours = Math.ceil(estimatedMinutes / 60);

  // Script icons based on purpose
  const getPurposeIcon = (purpose?: string) => {
    switch (purpose) {
      case 'qualification':
        return <Target className="h-4 w-4" />;
      case 'demo_booking':
        return <Calendar className="h-4 w-4" />;
      case 'follow_up':
        return <MessageSquare className="h-4 w-4" />;
      case 'support':
        return <HelpCircle className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Script Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Call Script
          </CardTitle>
          <CardDescription>
            Select the AI script that will guide the conversation with each recipient
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingScripts ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading scripts...</span>
            </div>
          ) : activeScripts.length === 0 ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Active Scripts</AlertTitle>
              <AlertDescription>
                You need to create and activate at least one AI call script before
                creating an AI voice campaign. Go to AI Call Scripts to create one.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3">
              {activeScripts.map((script) => (
                <Card
                  key={script.id}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary/50',
                    selectedScriptId === script.id && 'border-primary ring-1 ring-primary'
                  )}
                  onClick={() => onScriptChange(script.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-lg bg-primary/10 p-2">
                          {getPurposeIcon(script.purpose)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{script.name}</h4>
                            {script.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="mr-1 h-3 w-3" />
                                Default
                              </Badge>
                            )}
                            {script.successRate && parseFloat(script.successRate) > 70 && (
                              <Badge variant="outline" className="text-xs text-green-600">
                                {script.successRate}% success
                              </Badge>
                            )}
                          </div>
                          {script.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {script.description}
                            </p>
                          )}
                          {script.objective && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              <strong>Objective:</strong> {script.objective}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedScriptId === script.id && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calling Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Calling Configuration
          </CardTitle>
          <CardDescription>
            Configure when and how calls should be made
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preferred Calling Hours */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Preferred Calling Hours
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start Time</Label>
                <Input
                  type="time"
                  value={hoursStart}
                  onChange={(e) => handleHoursChange('start', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">End Time</Label>
                <Input
                  type="time"
                  value={hoursEnd}
                  onChange={(e) => handleHoursChange('end', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timezone
            </Label>
            <Select
              value={config.timezone}
              onValueChange={(value) => onConfigChange({ ...config, timezone: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Retry Configuration */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry Settings
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Max Attempts: {config.maxAttempts}
                </Label>
                <Slider
                  value={[config.maxAttempts || 3]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={([value]) => onConfigChange({ ...config, maxAttempts: value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Retry Delay: {config.retryDelayMinutes} minutes
                </Label>
                <Slider
                  value={[config.retryDelayMinutes || 30]}
                  min={15}
                  max={120}
                  step={15}
                  onValueChange={([value]) =>
                    onConfigChange({ ...config, retryDelayMinutes: value })
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Estimate */}
      {recipientCount > 0 && (
        <Alert>
          <Phone className="h-4 w-4" />
          <AlertTitle>Campaign Estimate</AlertTitle>
          <AlertDescription>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Recipients:</strong> {recipientCount}
              </div>
              <div>
                <strong>Max Attempts:</strong> {config.maxAttempts} per recipient
              </div>
              <div>
                <strong>Calling Hours:</strong> {hoursStart} - {hoursEnd} ({config.timezone})
              </div>
              <div>
                <strong>Est. Duration:</strong> ~{estimatedHours} hours
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Note: AI calls are processed sequentially to ensure quality conversations.
              Actual duration depends on call outcomes and retries.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
