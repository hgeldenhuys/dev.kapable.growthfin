/**
 * Mock Inbox Page
 *
 * Development tool for viewing mock messages sent in TEST_MODE.
 * Shows all "sent" emails and SMS without actually sending them.
 *
 * Features:
 * - View mock email/SMS messages
 * - Filter by channel (email/sms)
 * - View message content
 * - Simulate inbound reply
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Mail, MessageSquare, RefreshCw, Reply, Inbox, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Textarea } from '~/components/ui/textarea';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Simple API helper for mock inbox
const mockInboxApi = {
  async get(url: string): Promise<{ data: unknown }> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    return { data: await response.json() };
  },
  async post(url: string, data: unknown): Promise<{ data: unknown }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    return { data: await response.json() };
  },
};

interface MockMessage {
  id: string;
  workspaceId: string;
  channel: 'email' | 'sms';
  direction: 'inbound' | 'outbound';
  to: string;
  from: string;
  subject?: string;
  content: string;
  status: string;
  campaignId?: string;
  recipientId?: string;
  contactId?: string;
  events: Array<{ type: string; occurredAt: string }>;
  createdAt: string;
}

// API hooks
function useMockMessages(workspaceId: string, channel?: 'email' | 'sms') {
  return useQuery({
    queryKey: ['mock-messages', workspaceId, channel],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId });
      if (channel) params.append('channel', channel);
      const response = await mockInboxApi.get(`/api/v1/dev/mock-inbox?${params}`);
      return response.data as MockMessage[];
    },
    refetchInterval: 5000, // Poll every 5 seconds
    enabled: !!workspaceId,
  });
}

function useSimulateReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      workspaceId: string;
      channel: 'email' | 'sms';
      from: string;
      to: string;
      content: string;
      subject?: string;
      inReplyTo?: string;
    }) => {
      const response = await mockInboxApi.post('/api/v1/dev/mock-inbox/reply', params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-messages'] });
      toast.success('Reply simulated', { description: 'The inbound message has been injected.' });
    },
    onError: (error: Error) => {
      toast.error('Failed to simulate reply', { description: error.message });
    },
  });
}

export default function MockInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspaceId') || '';
  const [workspaceInput, setWorkspaceInput] = useState(workspaceId);
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'email' | 'sms'>('all');
  const [selectedMessage, setSelectedMessage] = useState<MockMessage | null>(null);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const { data: messages = [], isLoading, refetch } = useMockMessages(
    workspaceId,
    selectedChannel === 'all' ? undefined : selectedChannel
  );
  const simulateReply = useSimulateReply();

  // If no workspaceId, show input form
  if (!workspaceId) {
    return (
      <div className="container mx-auto py-6 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-6 w-6" />
              Mock Inbox
            </CardTitle>
            <CardDescription>
              Enter a workspace ID to view mock messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspaceId">Workspace ID</Label>
              <Input
                id="workspaceId"
                placeholder="e.g., 713dc1ca-74de-46ac-8a45-a01b2ff23230"
                value={workspaceInput}
                onChange={(e) => setWorkspaceInput(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (workspaceInput.trim()) {
                  setSearchParams({ workspaceId: workspaceInput.trim() });
                }
              }}
            >
              Load Inbox
            </Button>
            <p className="text-xs text-muted-foreground">
              Tip: Use the UAT workspace ID: <code className="bg-muted px-1 rounded">713dc1ca-74de-46ac-8a45-a01b2ff23230</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter messages by direction
  const outboundMessages = messages.filter((m) => m.direction === 'outbound');
  const inboundMessages = messages.filter((m) => m.direction === 'inbound');

  const handleReply = (message: MockMessage) => {
    setSelectedMessage(message);
    setReplyContent('');
    setReplyDialogOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyContent.trim()) return;

    await simulateReply.mutateAsync({
      workspaceId,
      channel: selectedMessage.channel,
      // Reply comes from original recipient, to original sender
      from: selectedMessage.to,
      to: selectedMessage.from,
      content: replyContent,
      subject: selectedMessage.subject ? `Re: ${selectedMessage.subject}` : undefined,
      inReplyTo: selectedMessage.id,
    });

    setReplyDialogOpen(false);
    setReplyContent('');
    setSelectedMessage(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-500';
      case 'sent':
        return 'bg-blue-500';
      case 'failed':
      case 'bounced':
        return 'bg-red-500';
      case 'pending':
      case 'queued':
        return 'bg-yellow-500';
      case 'opened':
        return 'bg-purple-500';
      case 'clicked':
        return 'bg-indigo-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6" />
            Mock Inbox
          </h1>
          <p className="text-muted-foreground">
            View messages sent in TEST_MODE (not actually delivered)
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Channel Tabs */}
      <Tabs value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All ({messages.length})</TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-1" />
            Email ({messages.filter((m) => m.channel === 'email').length})
          </TabsTrigger>
          <TabsTrigger value="sms">
            <MessageSquare className="h-4 w-4 mr-1" />
            SMS ({messages.filter((m) => m.channel === 'sms').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedChannel} className="mt-4">
          {/* Outbound Messages */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Outbound Messages ({outboundMessages.length})</CardTitle>
              <CardDescription>Messages "sent" in TEST_MODE</CardDescription>
            </CardHeader>
            <CardContent>
              {outboundMessages.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No outbound messages yet. Create a campaign and execute it in TEST_MODE.
                </p>
              ) : (
                <div className="space-y-4">
                  {outboundMessages.map((message) => (
                    <div
                      key={message.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {message.channel === 'email' ? (
                            <Mail className="h-5 w-5 text-blue-500" />
                          ) : (
                            <MessageSquare className="h-5 w-5 text-green-500" />
                          )}
                          <div>
                            <div className="font-medium">
                              To: {message.to}
                            </div>
                            {message.subject && (
                              <div className="text-sm text-muted-foreground">
                                Subject: {message.subject}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(message.status)}>
                            {message.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReply(message)}
                          >
                            <Reply className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 text-sm bg-muted rounded p-2 max-h-32 overflow-y-auto">
                        {message.channel === 'email' ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: message.content }}
                            className="prose prose-sm max-w-none"
                          />
                        ) : (
                          <p>{message.content}</p>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{format(new Date(message.createdAt), 'PPpp')}</span>
                        {message.events.length > 0 && (
                          <span>
                            Events: {message.events.map((e) => e.type).join(' → ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inbound Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inbound Messages ({inboundMessages.length})</CardTitle>
              <CardDescription>Simulated replies from recipients</CardDescription>
            </CardHeader>
            <CardContent>
              {inboundMessages.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No inbound messages yet. Click "Reply" on an outbound message to simulate a reply.
                </p>
              ) : (
                <div className="space-y-4">
                  {inboundMessages.map((message) => (
                    <div
                      key={message.id}
                      className="border rounded-lg p-4 bg-accent/30"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {message.channel === 'email' ? (
                            <Mail className="h-5 w-5 text-blue-500" />
                          ) : (
                            <MessageSquare className="h-5 w-5 text-green-500" />
                          )}
                          <div>
                            <div className="font-medium">
                              From: {message.from}
                            </div>
                            {message.subject && (
                              <div className="text-sm text-muted-foreground">
                                Subject: {message.subject}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline">inbound</Badge>
                      </div>
                      <div className="mt-2 text-sm bg-muted rounded p-2">
                        <p>{message.content}</p>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {format(new Date(message.createdAt), 'PPpp')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulate Reply</DialogTitle>
            <DialogDescription>
              Inject an inbound message as if the recipient replied.
              {selectedMessage && (
                <div className="mt-2 text-sm">
                  <strong>Replying as:</strong> {selectedMessage.to}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Type the reply message..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendReply}
              disabled={!replyContent.trim() || simulateReply.isPending}
            >
              {simulateReply.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Reply className="h-4 w-4 mr-2" />
                  Simulate Reply
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
