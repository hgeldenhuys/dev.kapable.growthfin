/**
 * Sandbox Dashboard — Central hub for viewing intercepted messages, simulating events, and managing sandbox mode.
 */

import { useState, useCallback } from 'react';
import { useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Switch } from '~/components/ui/switch';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { getSession } from '~/lib/auth';
import {
  FlaskConical, Mail, MessageSquare, MessageCircle, Phone, Bot, Trash2, RefreshCw, Settings2,
  CheckCircle, Eye, MousePointerClick, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

// Components
import { SandboxStats } from '~/components/sandbox/SandboxStats';
import { SandboxEmailPreview } from '~/components/sandbox/SandboxEmailPreview';
import { SandboxSmsThread } from '~/components/sandbox/SandboxSmsThread';
import { SandboxCallLog } from '~/components/sandbox/SandboxCallLog';
import { SandboxEventSimulator } from '~/components/sandbox/SandboxEventSimulator';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

// ─── Types ───────────────────────────────────────────────────────────────

interface SandboxMessage {
  id: string;
  to: string;
  from: string;
  channel: string;
  direction: 'outbound' | 'inbound';
  subject?: string;
  content: string;
  contentHtml?: string;
  status: string;
  events: any[];
  contactId?: string;
  campaignId?: string;
  voiceMetadata?: any;
  createdAt: string;
}

interface SandboxConfig {
  enabled: boolean;
  voiceTestNumber?: string;
  autoSimulateDelivery?: boolean;
  autoSimulateDelayMs?: number;
}

interface ChannelStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  replied: number;
}

// ─── Loader ──────────────────────────────────────────────────────────────

export async function loader({ params, request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const { workspaceId } = params;
  if (!workspaceId) {
    throw new Response('Workspace ID is required', { status: 400 });
  }

  const apiUrl = process.env['API_URL'] || 'http://localhost:3000';

  // Fetch config, messages, and stats in parallel
  const [configRes, messagesRes, statsRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/crm/sandbox/config?workspaceId=${workspaceId}`).catch(() => null),
    fetch(`${apiUrl}/api/v1/crm/sandbox/messages?workspaceId=${workspaceId}&limit=200`).catch(() => null),
    fetch(`${apiUrl}/api/v1/crm/sandbox/stats?workspaceId=${workspaceId}`).catch(() => null),
  ]);

  const config = configRes?.ok ? await configRes.json() : { enabled: false, config: { enabled: false }, envOverride: false };
  const messagesData = messagesRes?.ok ? await messagesRes.json() : { messages: [] };
  const statsData = statsRes?.ok ? await statsRes.json() : { stats: {} };

  return {
    config: config.config as SandboxConfig,
    sandboxEnabled: config.enabled as boolean,
    envOverride: config.envOverride as boolean,
    messages: (messagesData.messages || []) as SandboxMessage[],
    stats: (statsData.stats || {}) as Record<string, ChannelStats>,
  };
}

// ─── API helpers ─────────────────────────────────────────────────────────

function apiUrl(path: string, workspaceId: string): string {
  return `/api/v1/crm/sandbox${path}?workspaceId=${workspaceId}`;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function SandboxDashboard() {
  const workspaceId = useWorkspaceId();
  const loaderData = useLoaderData<typeof loader>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('all');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // ─── Queries ─────────────────────────────────────────────────────────

  const configQuery = useQuery({
    queryKey: ['sandbox', 'config', workspaceId],
    queryFn: async () => {
      const res = await fetch(apiUrl('/config', workspaceId));
      if (!res.ok) throw new Error('Failed to fetch sandbox config');
      return res.json();
    },
    initialData: {
      enabled: loaderData.sandboxEnabled,
      config: loaderData.config,
      envOverride: loaderData.envOverride,
    },
  });

  const messagesQuery = useQuery({
    queryKey: ['sandbox', 'messages', workspaceId],
    queryFn: async () => {
      const res = await fetch(apiUrl('/messages', workspaceId) + '&limit=200');
      if (!res.ok) throw new Error('Failed to fetch sandbox messages');
      const data = await res.json();
      return data.messages as SandboxMessage[];
    },
    initialData: loaderData.messages,
    refetchInterval: 5000, // Poll every 5s for new messages
  });

  const statsQuery = useQuery({
    queryKey: ['sandbox', 'stats', workspaceId],
    queryFn: async () => {
      const res = await fetch(apiUrl('/stats', workspaceId));
      if (!res.ok) throw new Error('Failed to fetch sandbox stats');
      const data = await res.json();
      return data.stats as Record<string, ChannelStats>;
    },
    initialData: loaderData.stats,
    refetchInterval: 5000,
  });

  const sandboxEnabled = configQuery.data?.enabled ?? false;
  const sandboxConfig = configQuery.data?.config ?? loaderData.config;
  const envOverride = configQuery.data?.envOverride ?? false;
  const messages = messagesQuery.data ?? [];
  const stats = statsQuery.data ?? {};

  // ─── Mutations ───────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch(apiUrl('/config', workspaceId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update sandbox config');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sandbox', 'config', workspaceId] });
      toast.success('Sandbox mode updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (config: Partial<SandboxConfig>) => {
      const res = await fetch(apiUrl('/config', workspaceId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to update sandbox config');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sandbox', 'config', workspaceId] });
      toast.success('Sandbox settings saved');
      setSettingsOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const simulateEventMutation = useMutation({
    mutationFn: async ({ messageId, eventType, metadata }: { messageId: string; eventType: string; metadata?: Record<string, any> }) => {
      const res = await fetch(apiUrl(`/messages/${messageId}/event`, workspaceId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, metadata }),
      });
      if (!res.ok) throw new Error('Failed to simulate event');
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['sandbox', 'messages', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['sandbox', 'stats', workspaceId] });
      toast.success(`Simulated "${vars.eventType}" event`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const res = await fetch(apiUrl(`/messages/${messageId}/reply`, workspaceId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to simulate reply');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sandbox', 'messages', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['sandbox', 'stats', workspaceId] });
      toast.success('Reply simulated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl('/messages', workspaceId), { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear sandbox data');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sandbox'] });
      toast.success(`Cleared ${data.deletedCount || 0} messages`);
      setClearConfirmOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Handlers ────────────────────────────────────────────────────────

  const handleSimulateEvent = useCallback((messageId: string, eventType: string, metadata?: Record<string, any>) => {
    simulateEventMutation.mutate({ messageId, eventType, metadata });
  }, [simulateEventMutation]);

  const handleReply = useCallback((messageId: string, content: string) => {
    replyMutation.mutate({ messageId, content });
  }, [replyMutation]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sandbox'] });
  }, [queryClient]);

  // ─── Filter messages by tab ──────────────────────────────────────────

  const emailMessages = messages.filter((m: SandboxMessage) => m.channel === 'email');
  const smsMessages = messages.filter((m: SandboxMessage) => m.channel === 'sms');
  const whatsappMessages = messages.filter((m: SandboxMessage) => m.channel === 'whatsapp');
  const voiceMessages = messages.filter((m: SandboxMessage) => m.channel === 'voice' || m.channel === 'ai_voice');

  // Group SMS by contact phone for thread view
  const smsThreads: Record<string, SandboxMessage[]> = {};
  for (const msg of smsMessages) {
    const key = msg.direction === 'outbound' ? msg.to : msg.from;
    if (!smsThreads[key]) smsThreads[key] = [];
    smsThreads[key].push(msg);
  }
  // Sort each thread by time
  for (const key of Object.keys(smsThreads)) {
    smsThreads[key].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Group WhatsApp by contact phone for thread view
  const whatsappThreads: Record<string, SandboxMessage[]> = {};
  for (const msg of whatsappMessages) {
    const key = msg.direction === 'outbound' ? msg.to : msg.from;
    if (!whatsappThreads[key]) whatsappThreads[key] = [];
    whatsappThreads[key].push(msg);
  }
  // Sort each thread by time
  for (const key of Object.keys(whatsappThreads)) {
    whatsappThreads[key].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const selectedEmail = selectedEmailId ? messages.find((m: SandboxMessage) => m.id === selectedEmailId) : null;

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-amber-500" />
            Sandbox Mode
          </h1>
          <p className="text-muted-foreground">
            Test campaigns with real data without contacting real people
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sandbox toggle */}
          <div className="flex items-center gap-2">
            <Label htmlFor="sandbox-toggle" className="text-sm">
              {sandboxEnabled ? 'Active' : 'Inactive'}
            </Label>
            <Switch
              id="sandbox-toggle"
              checked={sandboxEnabled}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={envOverride}
            />
            {envOverride && (
              <Badge variant="secondary" className="text-[10px]">ENV Override</Badge>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" /> Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 hover:text-red-600"
            onClick={() => setClearConfirmOpen(true)}
            disabled={messages.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* Sandbox status banner */}
      {sandboxEnabled && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-amber-700 dark:text-amber-400">Sandbox mode is active.</span>{' '}
            <span className="text-amber-600 dark:text-amber-500">
              Email, SMS, and WhatsApp messages are intercepted. Voice calls are routed to test numbers.
            </span>
          </div>
        </div>
      )}

      {/* Stats */}
      <SandboxStats stats={stats} />

      {/* Tabbed message view */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-3 w-3 mr-1" /> Email ({emailMessages.length})
          </TabsTrigger>
          <TabsTrigger value="sms">
            <MessageSquare className="h-3 w-3 mr-1" /> SMS ({smsMessages.length})
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageCircle className="h-3 w-3 mr-1 text-emerald-500" /> WhatsApp ({whatsappMessages.length})
          </TabsTrigger>
          <TabsTrigger value="voice">
            <Phone className="h-3 w-3 mr-1" /> Voice ({voiceMessages.length})
          </TabsTrigger>
        </TabsList>

        {/* All Messages */}
        <TabsContent value="all" className="space-y-3">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <MessageList
              messages={messages}
              onSelectEmail={setSelectedEmailId}
              onSimulateEvent={handleSimulateEvent}
            />
          )}
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-3">
          {selectedEmail ? (
            <SandboxEmailPreview
              message={selectedEmail}
              onSimulateEvent={handleSimulateEvent}
              onClose={() => setSelectedEmailId(null)}
            />
          ) : emailMessages.length === 0 ? (
            <EmptyState channel="email" />
          ) : (
            <MessageList
              messages={emailMessages}
              onSelectEmail={setSelectedEmailId}
              onSimulateEvent={handleSimulateEvent}
            />
          )}
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms" className="space-y-3">
          {Object.keys(smsThreads).length === 0 ? (
            <EmptyState channel="SMS" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(smsThreads).map(([phone, threadMsgs]) => (
                <SandboxSmsThread
                  key={phone}
                  messages={threadMsgs as any}
                  contactPhone={phone}
                  onReply={handleReply}
                  onSimulateEvent={handleSimulateEvent}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-3">
          {Object.keys(whatsappThreads).length === 0 ? (
            <EmptyState channel="WhatsApp" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(whatsappThreads).map(([phone, threadMsgs]) => (
                <SandboxSmsThread
                  key={phone}
                  messages={threadMsgs as any}
                  contactPhone={phone}
                  onReply={handleReply}
                  onSimulateEvent={handleSimulateEvent}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Voice Tab */}
        <TabsContent value="voice" className="space-y-3">
          <SandboxCallLog
            calls={voiceMessages as any}
            onSimulateEvent={handleSimulateEvent}
          />
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={sandboxConfig}
        onSave={(config) => updateConfigMutation.mutate(config)}
        saving={updateConfigMutation.isPending}
      />

      {/* Clear Confirmation Dialog */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Sandbox Data?</DialogTitle>
            <DialogDescription>
              This will permanently delete all {messages.length} sandbox messages and their event histories.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending ? 'Clearing...' : 'Clear All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function EmptyState({ channel }: { channel?: string }) {
  return (
    <Card className="border-muted">
      <CardContent className="py-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FlaskConical className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-medium">No {channel ? `${channel} ` : ''}messages yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Run a campaign with sandbox mode enabled to see intercepted messages here.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageList({
  messages,
  onSelectEmail,
  onSimulateEvent,
}: {
  messages: SandboxMessage[];
  onSelectEmail: (id: string) => void;
  onSimulateEvent: (messageId: string, eventType: string, metadata?: Record<string, any>) => void;
}) {
  const CHANNEL_ICONS: Record<string, React.ReactNode> = {
    email: <Mail className="h-4 w-4 text-blue-500" />,
    sms: <MessageSquare className="h-4 w-4 text-green-500" />,
    whatsapp: <MessageSquare className="h-4 w-4 text-emerald-500" />,
    voice: <Phone className="h-4 w-4 text-purple-500" />,
    ai_voice: <Bot className="h-4 w-4 text-orange-500" />,
  };

  const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    sent: 'secondary',
    pending: 'outline',
    delivered: 'default',
    opened: 'default',
    clicked: 'default',
    bounced: 'destructive',
    failed: 'destructive',
  };

  return (
    <div className="space-y-2">
      {messages.map((msg: SandboxMessage) => (
        <Card
          key={msg.id}
          className={`border-muted hover:border-foreground/20 transition-colors ${msg.channel === 'email' ? 'cursor-pointer' : ''}`}
          onClick={msg.channel === 'email' ? () => onSelectEmail(msg.id) : undefined}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {CHANNEL_ICONS[msg.channel] || <Mail className="h-4 w-4" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {msg.channel === 'email' ? (msg.subject || '(No Subject)') : msg.content.slice(0, 80)}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{msg.channel}</Badge>
                    <Badge variant="outline" className="text-[10px] shrink-0">{msg.direction}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    To: {msg.to} &middot; {new Date(msg.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <Badge variant={STATUS_VARIANTS[msg.status] || 'outline'}>{msg.status}</Badge>
                <SandboxEventSimulator
                  messageId={msg.id}
                  channel={msg.channel}
                  currentStatus={msg.status}
                  onSimulateEvent={onSimulateEvent}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  config,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SandboxConfig;
  onSave: (config: Partial<SandboxConfig>) => void;
  saving: boolean;
}) {
  const [testNumber, setTestNumber] = useState(config.voiceTestNumber || '');
  const [autoSimulate, setAutoSimulate] = useState(config.autoSimulateDelivery ?? true);
  const [delayMs, setDelayMs] = useState(String(config.autoSimulateDelayMs ?? 2000));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sandbox Settings</DialogTitle>
          <DialogDescription>
            Configure how sandbox mode handles outbound messages and simulated events.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Voice Test Phone Number</Label>
            <Input
              placeholder="+27XXXXXXXXX"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Voice and AI voice calls will be routed to this number instead of the real contact.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-simulate Delivery</Label>
              <p className="text-xs text-muted-foreground">
                Automatically mark intercepted messages as delivered after a delay.
              </p>
            </div>
            <Switch checked={autoSimulate} onCheckedChange={setAutoSimulate} />
          </div>

          {autoSimulate && (
            <div className="space-y-2">
              <Label>Simulation Delay (ms)</Label>
              <Input
                type="number"
                min="0"
                max="30000"
                value={delayMs}
                onChange={(e) => setDelayMs(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                How long to wait before auto-simulating the delivery event (default: 2000ms).
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() =>
              onSave({
                voiceTestNumber: testNumber || undefined,
                autoSimulateDelivery: autoSimulate,
                autoSimulateDelayMs: parseInt(delayMs) || 2000,
              })
            }
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
