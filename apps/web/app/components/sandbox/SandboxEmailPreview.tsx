/**
 * SandboxEmailPreview — Renders email HTML in a sandboxed iframe + action buttons
 */

import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Mail, CheckCircle, Eye, MousePointerClick, AlertTriangle, X } from 'lucide-react';

interface SandboxEmailPreviewProps {
  message: {
    id: string;
    to: string;
    from: string;
    subject?: string;
    content: string;
    contentHtml?: string;
    status: string;
    events: any[];
    createdAt: string;
  };
  onSimulateEvent: (messageId: string, eventType: string) => void;
  onClose?: () => void;
}

const STATUS_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  sent: { variant: 'secondary', label: 'Sent' },
  pending: { variant: 'outline', label: 'Pending' },
  delivered: { variant: 'default', label: 'Delivered' },
  opened: { variant: 'default', label: 'Opened' },
  clicked: { variant: 'default', label: 'Clicked' },
  bounced: { variant: 'destructive', label: 'Bounced' },
  failed: { variant: 'destructive', label: 'Failed' },
};

export function SandboxEmailPreview({ message, onSimulateEvent, onClose }: SandboxEmailPreviewProps) {
  const [iframeHeight, setIframeHeight] = useState(400);
  const badge = STATUS_BADGES[message.status] || { variant: 'outline' as const, label: message.status };
  const htmlContent = message.contentHtml || message.content;

  return (
    <Card className="border-muted">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm">{message.subject || '(No Subject)'}</CardTitle>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>To: {message.to}</div>
          <div>From: {message.from}</div>
          <div>Sent: {new Date(message.createdAt).toLocaleString()}</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* HTML Preview */}
        <div className="border rounded-md overflow-hidden bg-white">
          <iframe
            srcDoc={htmlContent}
            sandbox="allow-same-origin"
            className="w-full border-0"
            style={{ height: iframeHeight }}
            title="Email Preview"
            onLoad={(e) => {
              const doc = (e.target as HTMLIFrameElement).contentDocument;
              if (doc?.body) {
                setIframeHeight(Math.min(doc.body.scrollHeight + 20, 600));
              }
            }}
          />
        </div>

        {/* Event simulation buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onSimulateEvent(message.id, 'delivered')}>
            <CheckCircle className="h-3 w-3 mr-1" /> Delivered
          </Button>
          <Button size="sm" variant="outline" onClick={() => onSimulateEvent(message.id, 'opened')}>
            <Eye className="h-3 w-3 mr-1" /> Opened
          </Button>
          <Button size="sm" variant="outline" onClick={() => onSimulateEvent(message.id, 'clicked')}>
            <MousePointerClick className="h-3 w-3 mr-1" /> Clicked
          </Button>
          <Button size="sm" variant="outline" onClick={() => onSimulateEvent(message.id, 'bounced')}>
            <AlertTriangle className="h-3 w-3 mr-1" /> Bounced
          </Button>
        </div>

        {/* Event log */}
        {message.events && message.events.length > 0 && (
          <div className="text-xs space-y-1">
            <div className="font-medium text-muted-foreground">Event Log:</div>
            {(message.events as any[]).map((evt: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-muted-foreground">
                <span className="font-mono">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                <Badge variant="outline" className="text-[10px]">{evt.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
