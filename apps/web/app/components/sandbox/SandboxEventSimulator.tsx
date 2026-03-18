/**
 * SandboxEventSimulator — Dialog for triggering webhook events on sandbox messages
 */

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
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
import { Zap, CheckCircle, Eye, MousePointerClick, AlertTriangle, XCircle, Reply } from 'lucide-react';

interface SandboxEventSimulatorProps {
  messageId: string;
  channel: string;
  currentStatus: string;
  onSimulateEvent: (messageId: string, eventType: string, metadata?: Record<string, any>) => void;
}

const EVENT_TYPES = [
  { value: 'delivered', label: 'Delivered', icon: CheckCircle, description: 'Message delivered to recipient', color: 'text-green-500' },
  { value: 'opened', label: 'Opened', icon: Eye, description: 'Recipient opened the message', color: 'text-purple-500' },
  { value: 'clicked', label: 'Clicked', icon: MousePointerClick, description: 'Recipient clicked a link', color: 'text-indigo-500' },
  { value: 'bounced', label: 'Bounced', icon: AlertTriangle, description: 'Message bounced back', color: 'text-red-500' },
  { value: 'failed', label: 'Failed', icon: XCircle, description: 'Delivery failure', color: 'text-red-600' },
  { value: 'complained', label: 'Complained', icon: AlertTriangle, description: 'Recipient marked as spam', color: 'text-orange-500' },
  { value: 'replied', label: 'Replied', icon: Reply, description: 'Recipient replied', color: 'text-blue-500' },
];

export function SandboxEventSimulator({ messageId, channel, currentStatus, onSimulateEvent }: SandboxEventSimulatorProps) {
  const [open, setOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState('delivered');
  const [clickUrl, setClickUrl] = useState('');
  const [bounceReason, setBounceReason] = useState('');
  const [metadataJson, setMetadataJson] = useState('');

  const handleSimulate = () => {
    const metadata: Record<string, any> = {};

    if (selectedEvent === 'clicked' && clickUrl) {
      metadata.url = clickUrl;
    }
    if (selectedEvent === 'bounced' && bounceReason) {
      metadata.bounceType = bounceReason;
    }

    // Parse additional metadata JSON
    if (metadataJson.trim()) {
      try {
        const parsed = JSON.parse(metadataJson);
        Object.assign(metadata, parsed);
      } catch {
        // Ignore invalid JSON
      }
    }

    onSimulateEvent(messageId, selectedEvent, Object.keys(metadata).length > 0 ? metadata : undefined);
    setOpen(false);
    setClickUrl('');
    setBounceReason('');
    setMetadataJson('');
  };

  // Filter available events based on channel
  const availableEvents = EVENT_TYPES.filter(evt => {
    if (channel === 'sms' || channel === 'whatsapp') {
      return ['delivered', 'failed', 'replied'].includes(evt.value);
    }
    if (channel === 'voice' || channel === 'ai_voice') {
      return ['delivered', 'failed'].includes(evt.value);
    }
    return true; // Email gets all events
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Zap className="h-3 w-3 mr-1" /> Simulate Event
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Simulate Webhook Event</DialogTitle>
          <DialogDescription>
            Trigger a simulated event that flows through the real webhook pipeline, updating recipient status, timeline, and engagement scores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current status */}
          <div className="text-sm text-muted-foreground">
            Current status: <span className="font-medium text-foreground">{currentStatus}</span>
          </div>

          {/* Event type selector */}
          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableEvents.map((evt) => {
                  const Icon = evt.icon;
                  return (
                    <SelectItem key={evt.value} value={evt.value}>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3 w-3 ${evt.color}`} />
                        <span>{evt.label}</span>
                        <span className="text-muted-foreground text-xs">- {evt.description}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional fields based on event type */}
          {selectedEvent === 'clicked' && (
            <div className="space-y-2">
              <Label>Click URL (optional)</Label>
              <Input
                placeholder="https://example.com/landing-page"
                value={clickUrl}
                onChange={(e) => setClickUrl(e.target.value)}
              />
            </div>
          )}

          {selectedEvent === 'bounced' && (
            <div className="space-y-2">
              <Label>Bounce Type</Label>
              <Select value={bounceReason} onValueChange={setBounceReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bounce type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hard">Hard Bounce (permanent)</SelectItem>
                  <SelectItem value="soft">Soft Bounce (temporary)</SelectItem>
                  <SelectItem value="undetermined">Undetermined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Advanced: custom metadata JSON */}
          <div className="space-y-2">
            <Label>Additional Metadata (JSON, optional)</Label>
            <Textarea
              placeholder='{"key": "value"}'
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
              rows={2}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSimulate}>
            <Zap className="h-4 w-4 mr-1" /> Simulate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
