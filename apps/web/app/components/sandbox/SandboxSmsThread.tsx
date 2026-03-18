/**
 * SandboxSmsThread — Chat bubble conversation view for sandbox SMS messages
 */

import { useState, useRef, useEffect } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { MessageSquare, Send, User, Bot, X } from 'lucide-react';

interface SmsMessage {
  id: string;
  to: string;
  from: string;
  content: string;
  direction: 'outbound' | 'inbound';
  status: string;
  createdAt: string;
  events: any[];
}

interface SandboxSmsThreadProps {
  messages: SmsMessage[];
  contactPhone: string;
  onReply: (messageId: string, content: string) => void;
  onSimulateEvent: (messageId: string, eventType: string) => void;
  onClose?: () => void;
}

const QUICK_REPLIES = [
  { label: 'STOP', description: 'Opt-out' },
  { label: 'HELP', description: 'Get help' },
  { label: 'YES', description: 'Confirm' },
];

export function SandboxSmsThread({ messages, contactPhone, onReply, onSimulateEvent, onClose }: SandboxSmsThreadProps) {
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSendReply = () => {
    const trimmed = replyText.trim();
    if (!trimmed || messages.length === 0) return;
    // Reply to the last outbound message
    const lastOutbound = [...messages].reverse().find(m => m.direction === 'outbound');
    if (lastOutbound) {
      onReply(lastOutbound.id, trimmed);
      setReplyText('');
    }
  };

  const handleQuickReply = (text: string) => {
    const lastOutbound = [...messages].reverse().find(m => m.direction === 'outbound');
    if (lastOutbound) {
      onReply(lastOutbound.id, text);
    }
  };

  return (
    <Card className="border-muted flex flex-col" style={{ maxHeight: 600 }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-500" />
            <CardTitle className="text-sm">{contactPhone}</CardTitle>
            <Badge variant="outline" className="text-[10px]">{messages.length} messages</Badge>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden p-3">
        {/* Chat bubbles */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 px-1" style={{ minHeight: 200, maxHeight: 400 }}>
          {messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound';
            return (
              <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] flex flex-col gap-1`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isOutbound
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] text-muted-foreground ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                    {isOutbound ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                    {isOutbound && (
                      <Badge variant="outline" className="text-[9px] ml-1">{msg.status}</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick reply buttons (TCPA keywords) */}
        <div className="flex gap-1">
          {QUICK_REPLIES.map((qr) => (
            <Button
              key={qr.label}
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => handleQuickReply(qr.label)}
              title={qr.description}
            >
              {qr.label}
            </Button>
          ))}
        </div>

        {/* Reply input */}
        <div className="flex gap-2">
          <Input
            placeholder="Simulate inbound reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSendReply} disabled={!replyText.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
