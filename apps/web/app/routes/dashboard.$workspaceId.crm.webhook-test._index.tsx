/**
 * Multi-Channel Webhook Test UI
 * Manually trigger webhook events for testing (Email, SMS, Voice, WhatsApp)
 */

import { useState } from 'react';
import { Loader2, Send, TestTube2, Webhook, RefreshCw, Mail, MessageSquare, Phone, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useCampaigns, useCampaignRecipients } from '~/hooks/useCampaigns';
import { useContacts } from '~/hooks/useContacts';
import { toast } from 'sonner';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { RECIPIENT_STATUSES } from '~/types/crm';
import type { Campaign, CampaignRecipient } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

// Client-side code MUST use proxy routes (no API_URL prefix)
// Proxy route at /api/v1/* forwards to backend

type ChannelType = 'email' | 'sms' | 'voice' | 'whatsapp';
type EmailEventType = 'email.delivered' | 'email.bounced' | 'email.opened' | 'email.clicked';
type SMSEventType = 'sent' | 'delivered' | 'failed' | 'received';
type VoiceEventType = 'initiated' | 'ringing' | 'answered' | 'completed' | 'no-answer' | 'failed';
type WhatsAppEventType = 'sent' | 'delivered' | 'read' | 'failed' | 'received';
type BounceType = 'hard_bounce' | 'soft_bounce' | 'spam_complaint';

export default function WebhookTestPage() {
  const workspaceId = useWorkspaceId();

  // Fetch campaigns and contacts
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns({ workspaceId });
  const { data: contacts = [], isLoading: contactsLoading } = useContacts({ workspaceId });

  // State
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('email');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedRecipient, setSelectedRecipient] = useState<CampaignRecipient | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string>('');

  // Email event state
  const [emailEventType, setEmailEventType] = useState<EmailEventType>('email.delivered');
  const [bounceType, setBounceType] = useState<BounceType>('hard_bounce');
  const [clickedUrl, setClickedUrl] = useState<string>('https://example.com/product');

  // SMS event state
  const [smsEventType, setSmsEventType] = useState<SMSEventType>('delivered');
  const [smsInboundMessage, setSmsInboundMessage] = useState<string>('Thanks for the message!');
  const [smsErrorCode, setSmsErrorCode] = useState<string>('30001');

  // Voice event state
  const [voiceEventType, setVoiceEventType] = useState<VoiceEventType>('completed');
  const [callDuration, setCallDuration] = useState<number>(180);

  // WhatsApp event state
  const [whatsappEventType, setWhatsAppEventType] = useState<WhatsAppEventType>('delivered');
  const [whatsappInboundMessage, setWhatsAppInboundMessage] = useState<string>('Yes, I\'m interested!');

  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

  // Fetch recipients for selected campaign
  const { data: recipients = [], isLoading: recipientsLoading, refetch: refetchRecipients } = useCampaignRecipients(
    selectedCampaignId,
    workspaceId
  );

  // Filter recipients based on channel
  const channelRecipients = recipients.filter((r) => {
    if (selectedChannel === 'email') return r.resendEmailId;
    return r.status !== 'pending'; // For SMS/Voice/WhatsApp, show sent recipients
  });

  // Handle campaign selection
  const handleCampaignChange = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setSelectedRecipient(null);
    setLastResponse(null);
  };

  // Handle recipient selection
  const handleRecipientChange = (recipientId: string) => {
    const recipient = channelRecipients.find((r) => r.id === recipientId);
    setSelectedRecipient(recipient || null);
    setLastResponse(null);
  };

  // Handle contact selection (for inbound messages)
  const handleContactChange = (contactId: string) => {
    setSelectedContactId(contactId);
    setLastResponse(null);
  };

  // Send webhook event
  const handleSendWebhook = async () => {
    // For inbound events, we need a contact, not a recipient
    const isInboundEvent =
      (selectedChannel === 'sms' && smsEventType === 'received') ||
      (selectedChannel === 'whatsapp' && whatsappEventType === 'received');

    if (isInboundEvent) {
      if (!selectedContactId) {
        toast.error('Error', { description: 'Please select a contact for inbound messages' });
        return;
      }
    } else {
      if (!selectedRecipient) {
        toast.error('Error', { description: 'Please select a recipient' });
        return;
      }
    }

    setIsSending(true);

    try {
      let payload: any;
      let webhookEndpoint: string;

      if (selectedChannel === 'email') {
        webhookEndpoint = `/api/v1/crm/webhooks/resend-email`;
        payload = {
          type: emailEventType,
          created_at: new Date().toISOString(),
          data: {
            email_id: selectedRecipient?.resendEmailId,
            to: selectedRecipient?.contact?.email || 'unknown@example.com',
          },
        };

        if (emailEventType === 'email.bounced') {
          payload.data.bounce = {
            type: bounceType,
            description: `Test ${bounceType.replace('_', ' ')} from webhook test UI`,
          };
        } else if (emailEventType === 'email.clicked') {
          payload.data.click = {
            link: clickedUrl,
          };
        }
      } else if (selectedChannel === 'sms') {
        webhookEndpoint = `/api/v1/crm/webhooks/twilio-sms`;

        const contact = contacts.find(c => c.id === (isInboundEvent ? selectedContactId : selectedRecipient?.contactId));

        if (smsEventType === 'received') {
          // Inbound SMS
          payload = new URLSearchParams({
            MessageSid: `SM${Math.random().toString(36).substring(7)}`,
            From: contact?.phone || '+11234567890',
            To: '+15142409282', // Test number
            Body: smsInboundMessage,
            NumSegments: String(Math.ceil(smsInboundMessage.length / 160)),
            ContactId: selectedContactId,
            WorkspaceId: workspaceId,
          });
        } else {
          // Outbound SMS status callback
          payload = new URLSearchParams({
            MessageSid: selectedRecipient?.resendEmailId || `SM${Math.random().toString(36).substring(7)}`,
            MessageStatus: smsEventType,
            From: '+15005550006',
            To: contact?.phone || '+11234567890',
            Body: 'Test SMS message',
            NumSegments: '1',
            RecipientId: selectedRecipient?.id || '',
            ContactId: selectedRecipient?.contactId || '',
            CampaignId: selectedCampaignId,
            WorkspaceId: workspaceId,
            ...(smsEventType === 'failed' && { ErrorCode: smsErrorCode }),
          });
        }
      } else if (selectedChannel === 'voice') {
        webhookEndpoint = `/api/v1/crm/webhooks/twilio-voice`;

        const contact = contacts.find(c => c.id === selectedRecipient?.contactId);

        payload = new URLSearchParams({
          CallSid: selectedRecipient?.resendEmailId || `CA${Math.random().toString(36).substring(7)}`,
          CallStatus: voiceEventType,
          From: '+15005550006',
          To: contact?.phone || '+11234567890',
          Direction: 'outbound-api',
          RecipientId: selectedRecipient?.id || '',
          ContactId: selectedRecipient?.contactId || '',
          CampaignId: selectedCampaignId,
          WorkspaceId: workspaceId,
          ...(voiceEventType === 'completed' && { CallDuration: String(callDuration) }),
        });
      } else if (selectedChannel === 'whatsapp') {
        webhookEndpoint = `/api/v1/crm/webhooks/twilio-whatsapp`;

        const contact = contacts.find(c => c.id === (isInboundEvent ? selectedContactId : selectedRecipient?.contactId));

        if (whatsappEventType === 'received') {
          // Inbound WhatsApp
          payload = new URLSearchParams({
            MessageSid: `SM${Math.random().toString(36).substring(7)}`,
            From: `whatsapp:${contact?.phone || '+11234567890'}`,
            To: 'whatsapp:+15142409282',
            Body: whatsappInboundMessage,
            NumSegments: '1',
            ContactId: selectedContactId,
            WorkspaceId: workspaceId,
          });
        } else {
          // Outbound WhatsApp status
          payload = new URLSearchParams({
            MessageSid: selectedRecipient?.resendEmailId || `SM${Math.random().toString(36).substring(7)}`,
            MessageStatus: whatsappEventType,
            From: 'whatsapp:+15005550006',
            To: `whatsapp:${contact?.phone || '+11234567890'}`,
            Body: 'Test WhatsApp message',
            RecipientId: selectedRecipient?.id || '',
            ContactId: selectedRecipient?.contactId || '',
            CampaignId: selectedCampaignId,
            WorkspaceId: workspaceId,
          });
        }
      }

      // Send webhook to API
      const contentType = selectedChannel === 'email' ? 'application/json' : 'application/x-www-form-urlencoded';
      const body = selectedChannel === 'email' ? JSON.stringify(payload) : payload.toString();

      const response = await fetch(webhookEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to send webhook');
      }

      const result = await response.json();
      setLastResponse(result);

      toast.success('Webhook Sent', { description: `Successfully sent ${selectedChannel} event` });

      // Refresh recipient data to show updates
      setTimeout(() => {
        refetchRecipients();
      }, 500);
    } catch (error) {
      console.error('Webhook send error:', error);
      toast.error('Error', { description: String(error) });
    } finally {
      setIsSending(false);
    }
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Webhook className="h-8 w-8" />
          Multi-Channel Webhook Test
        </h1>
        <p className="text-muted-foreground mt-2">
          Manually trigger webhook events to test email, SMS, voice, and WhatsApp tracking
        </p>
      </div>

      {/* Channel Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Channel</CardTitle>
          <CardDescription>Choose which communication channel to test</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as ChannelType)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                SMS
              </TabsTrigger>
              <TabsTrigger value="voice" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Voice
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Configuration */}
        <div className="space-y-6">
          {/* Campaign & Recipient/Contact Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5" />
                1. Select Campaign & Target
              </CardTitle>
              <CardDescription>
                Choose a campaign and {selectedChannel === 'sms' && smsEventType === 'received' || selectedChannel === 'whatsapp' && whatsappEventType === 'received' ? 'contact (for inbound)' : 'recipient (for outbound)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Campaign Selector */}
              <div className="space-y-2">
                <Label htmlFor="campaign">Campaign</Label>
                {campaignsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No campaigns available</p>
                ) : (
                  <Select value={selectedCampaignId} onValueChange={handleCampaignChange}>
                    <SelectTrigger id="campaign">
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Recipient or Contact Selector */}
              {selectedCampaignId && (
                <>
                  {/* For inbound events, show contact selector */}
                  {((selectedChannel === 'sms' && smsEventType === 'received') ||
                    (selectedChannel === 'whatsapp' && whatsappEventType === 'received')) ? (
                    <div className="space-y-2">
                      <Label htmlFor="contact">Contact (Inbound Message From)</Label>
                      {contactsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : contacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No contacts available</p>
                      ) : (
                        <Select value={selectedContactId} onValueChange={handleContactChange}>
                          <SelectTrigger id="contact">
                            <SelectValue placeholder="Select a contact" />
                          </SelectTrigger>
                          <SelectContent>
                            {contacts.slice(0, 50).map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.firstName} {contact.lastName} ({contact.phone || contact.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {selectedContact && (
                        <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Name:</span>
                            <span className="font-medium">{selectedContact.firstName} {selectedContact.lastName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Phone:</span>
                            <span className="font-mono text-xs">{selectedContact.phone || 'N/A'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* For outbound events, show recipient selector */
                    <div className="space-y-2">
                      <Label htmlFor="recipient">Recipient</Label>
                      {recipientsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : channelRecipients.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No recipients available. Please activate the campaign first.
                        </p>
                      ) : (
                        <Select
                          value={selectedRecipient?.id || ''}
                          onValueChange={handleRecipientChange}
                        >
                          <SelectTrigger id="recipient">
                            <SelectValue placeholder="Select a recipient" />
                          </SelectTrigger>
                          <SelectContent>
                            {channelRecipients.map((recipient) => (
                              <SelectItem key={recipient.id} value={recipient.id}>
                                {selectedChannel === 'email'
                                  ? `${recipient.contact?.email} (${recipient.status})`
                                  : `${recipient.contact?.firstName} ${recipient.contact?.lastName} (${recipient.status})`
                                }
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {selectedRecipient && (
                        <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {selectedChannel === 'email' ? 'Email:' : 'Name:'}
                            </span>
                            <span className="font-medium">
                              {selectedChannel === 'email'
                                ? selectedRecipient.contact?.email
                                : `${selectedRecipient.contact?.firstName} ${selectedRecipient.contact?.lastName}`
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant="outline">{selectedRecipient.status}</Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Event Type Selection - Email */}
          {selectedChannel === 'email' && (
            <Card>
              <CardHeader>
                <CardTitle>2. Select Email Event</CardTitle>
                <CardDescription>Choose which webhook event to simulate</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={emailEventType} onValueChange={(v) => setEmailEventType(v as EmailEventType)}>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="email.delivered" id="delivered" />
                      <Label htmlFor="delivered" className="flex-1 cursor-pointer">
                        <div className="font-medium">Delivered</div>
                        <div className="text-xs text-muted-foreground">Successfully delivered to inbox</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="email.opened" id="opened" />
                      <Label htmlFor="opened" className="flex-1 cursor-pointer">
                        <div className="font-medium">Opened</div>
                        <div className="text-xs text-muted-foreground">Recipient opened the email</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="email.clicked" id="clicked" />
                      <Label htmlFor="clicked" className="flex-1 cursor-pointer">
                        <div className="font-medium">Clicked</div>
                        <div className="text-xs text-muted-foreground">Clicked a link</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="email.bounced" id="bounced" />
                      <Label htmlFor="bounced" className="flex-1 cursor-pointer">
                        <div className="font-medium">Bounced</div>
                        <div className="text-xs text-muted-foreground">Email bounced</div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>

                {emailEventType === 'email.bounced' && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="bounceType">Bounce Type</Label>
                    <Select value={bounceType} onValueChange={(v) => setBounceType(v as BounceType)}>
                      <SelectTrigger id="bounceType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hard_bounce">Hard Bounce</SelectItem>
                        <SelectItem value="soft_bounce">Soft Bounce</SelectItem>
                        <SelectItem value="spam_complaint">Spam Complaint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {emailEventType === 'email.clicked' && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="clickedUrl">Clicked Link URL</Label>
                    <Input
                      id="clickedUrl"
                      type="url"
                      value={clickedUrl}
                      onChange={(e) => setClickedUrl(e.target.value)}
                      placeholder="https://example.com/product"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Event Type Selection - SMS */}
          {selectedChannel === 'sms' && (
            <Card>
              <CardHeader>
                <CardTitle>2. Select SMS Event</CardTitle>
                <CardDescription>Choose which SMS event to simulate</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={smsEventType} onValueChange={(v) => setSmsEventType(v as SMSEventType)}>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="sent" id="sms-sent" />
                      <Label htmlFor="sms-sent" className="flex-1 cursor-pointer">
                        <div className="font-medium">Sent (Queued)</div>
                        <div className="text-xs text-muted-foreground">SMS queued by Twilio</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="delivered" id="sms-delivered" />
                      <Label htmlFor="sms-delivered" className="flex-1 cursor-pointer">
                        <div className="font-medium">Delivered</div>
                        <div className="text-xs text-muted-foreground">SMS delivered to device</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="failed" id="sms-failed" />
                      <Label htmlFor="sms-failed" className="flex-1 cursor-pointer">
                        <div className="font-medium">Failed</div>
                        <div className="text-xs text-muted-foreground">SMS delivery failed</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value="received" id="sms-received" />
                      <Label htmlFor="sms-received" className="flex-1 cursor-pointer">
                        <div className="font-medium">Received (Inbound)</div>
                        <div className="text-xs text-muted-foreground">Contact replied to SMS</div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>

                {smsEventType === 'received' && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="smsInboundMessage">Inbound Message</Label>
                    <Textarea
                      id="smsInboundMessage"
                      value={smsInboundMessage}
                      onChange={(e) => setSmsInboundMessage(e.target.value)}
                      placeholder="Enter the message content..."
                      rows={3}
                    />
                  </div>
                )}

                {smsEventType === 'failed' && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="smsErrorCode">Error Code</Label>
                    <Input
                      id="smsErrorCode"
                      value={smsErrorCode}
                      onChange={(e) => setSmsErrorCode(e.target.value)}
                      placeholder="30001"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Event Type Selection - Voice */}
          {selectedChannel === 'voice' && (
            <Card>
              <CardHeader>
                <CardTitle>2. Select Voice Event</CardTitle>
                <CardDescription>Choose which voice call event to simulate</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={voiceEventType} onValueChange={(v) => setVoiceEventType(v as VoiceEventType)}>
                  <div className="space-y-3">
                    {['initiated', 'ringing', 'answered', 'completed', 'no-answer', 'failed'].map((event) => (
                      <div key={event} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value={event} id={`voice-${event}`} />
                        <Label htmlFor={`voice-${event}`} className="flex-1 cursor-pointer">
                          <div className="font-medium capitalize">{event.replace('-', ' ')}</div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>

                {voiceEventType === 'completed' && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="callDuration">Call Duration (seconds)</Label>
                    <Input
                      id="callDuration"
                      type="number"
                      value={callDuration}
                      onChange={(e) => setCallDuration(parseInt(e.target.value) || 0)}
                      placeholder="180"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Event Type Selection - WhatsApp */}
          {selectedChannel === 'whatsapp' && (
            <Card>
              <CardHeader>
                <CardTitle>2. Select WhatsApp Event</CardTitle>
                <CardDescription>Choose which WhatsApp event to simulate</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={whatsappEventType} onValueChange={(v) => setWhatsAppEventType(v as WhatsAppEventType)}>
                  <div className="space-y-3">
                    {['sent', 'delivered', 'read', 'failed', 'received'].map((event) => (
                      <div key={event} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value={event} id={`whatsapp-${event}`} />
                        <Label htmlFor={`whatsapp-${event}`} className="flex-1 cursor-pointer">
                          <div className="font-medium capitalize">{event}</div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>

                {whatsappEventType === 'received' && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="whatsappInboundMessage">Inbound Message</Label>
                    <Textarea
                      id="whatsappInboundMessage"
                      value={whatsappInboundMessage}
                      onChange={(e) => setWhatsAppInboundMessage(e.target.value)}
                      placeholder="Enter the message content..."
                      rows={3}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Send Button */}
          <Card>
            <CardHeader>
              <CardTitle>3. Send Test Webhook</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSendWebhook}
                disabled={
                  isSending ||
                  (!selectedRecipient && !(
                    (selectedChannel === 'sms' && smsEventType === 'received') ||
                    (selectedChannel === 'whatsapp' && whatsappEventType === 'received')
                  )) ||
                  (((selectedChannel === 'sms' && smsEventType === 'received') ||
                    (selectedChannel === 'whatsapp' && whatsappEventType === 'received')) && !selectedContactId)
                }
                className="w-full"
                size="lg"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send {selectedChannel.toUpperCase()} Webhook
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Results & Help */}
        <div className="space-y-6">
          {/* Webhook Response */}
          {lastResponse && (
            <Card>
              <CardHeader>
                <CardTitle>Webhook Response</CardTitle>
                <CardDescription>Response from the webhook endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto max-h-96">
                  {JSON.stringify(lastResponse, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Help Card */}
          <Card>
            <CardHeader>
              <CardTitle>How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-medium mb-1">1. Select Channel</div>
                <div className="text-muted-foreground">
                  Choose Email, SMS, Voice, or WhatsApp to test different channels
                </div>
              </div>
              <div>
                <div className="font-medium mb-1">2. Select Campaign & Target</div>
                <div className="text-muted-foreground">
                  Pick a campaign and either a recipient (outbound) or contact (inbound)
                </div>
              </div>
              <div>
                <div className="font-medium mb-1">3. Choose Event</div>
                <div className="text-muted-foreground">
                  Select the webhook event type with any additional parameters
                </div>
              </div>
              <div>
                <div className="font-medium mb-1">4. Send & Verify</div>
                <div className="text-muted-foreground">
                  Click "Send Webhook" and check the response. Check the contact timeline for updates.
                </div>
              </div>
              <div className="pt-3 border-t">
                <div className="font-medium mb-1">Test Mode Note</div>
                <div className="text-muted-foreground">
                  For SMS testing with correlation IDs, include the correlation (e.g., "K5 Thanks!") in inbound messages to test the test mode flow.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
