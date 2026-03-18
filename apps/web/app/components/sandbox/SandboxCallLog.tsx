/**
 * SandboxCallLog — Voice/AI Voice call log table with recording player
 */

import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Phone, Bot, Play, Pause, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface VoiceMetadata {
  originalTo?: string;
  isRealCall?: boolean;
  duration?: number;
  recordingUrl?: string;
  transcription?: string;
}

interface CallMessage {
  id: string;
  to: string;
  from: string;
  channel: 'voice' | 'ai_voice';
  content: string;
  status: string;
  voiceMetadata?: VoiceMetadata;
  events: any[];
  createdAt: string;
}

interface SandboxCallLogProps {
  calls: CallMessage[];
  onSimulateEvent: (messageId: string, eventType: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

function formatDuration(seconds?: number): string {
  if (!seconds) return '--';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function SandboxCallLog({ calls, onSimulateEvent }: SandboxCallLogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (calls.length === 0) {
    return (
      <Card className="border-muted">
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Phone className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">No voice calls yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Voice and AI voice calls will appear here when campaigns run in sandbox mode.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-muted">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Phone className="h-4 w-4 text-purple-500" />
          Call Log ({calls.length} calls)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recording</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.map((call) => {
              const meta = call.voiceMetadata;
              const isExpanded = expandedId === call.id;
              const originalTo = meta?.originalTo || call.to;

              return (
                <>
                  <TableRow key={call.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : call.id)}>
                    <TableCell>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {new Date(call.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{originalTo}</div>
                      {meta?.isRealCall && meta.originalTo && meta.originalTo !== call.to && (
                        <div className="text-[10px] text-muted-foreground">
                          Routed to test: {call.to}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {call.channel === 'ai_voice' ? (
                          <><Bot className="h-3 w-3 mr-1" /> AI Voice</>
                        ) : (
                          <><Phone className="h-3 w-3 mr-1" /> Voice</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDuration(meta?.duration)}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[call.status] || 'bg-gray-100 text-gray-700'}`}>
                        {call.status}
                      </span>
                      {meta?.isRealCall && (
                        <Badge variant="secondary" className="text-[9px] ml-1">Real Call</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {meta?.recordingUrl ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlayingId(playingId === call.id ? null : call.id);
                            }}
                          >
                            {playingId === call.id ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                          <a
                            href={meta.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSimulateEvent(call.id, call.status === 'sent' ? 'delivered' : 'completed');
                        }}
                      >
                        Simulate
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <TableRow key={`${call.id}-detail`}>
                      <TableCell colSpan={8} className="bg-muted/30">
                        <div className="p-3 space-y-3">
                          {/* Audio player */}
                          {meta?.recordingUrl && playingId === call.id && (
                            <div>
                              <audio
                                controls
                                autoPlay
                                src={meta.recordingUrl}
                                className="w-full"
                                onEnded={() => setPlayingId(null)}
                              />
                            </div>
                          )}

                          {/* Transcription */}
                          {meta?.transcription && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Transcription:</div>
                              <div className="text-sm bg-background rounded p-2 border">{meta.transcription}</div>
                            </div>
                          )}

                          {/* Call content/script */}
                          {call.content && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Script/Content:</div>
                              <div className="text-sm bg-background rounded p-2 border">{call.content}</div>
                            </div>
                          )}

                          {/* Event log */}
                          {call.events && call.events.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Events:</div>
                              <div className="space-y-1">
                                {(call.events as any[]).map((evt: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-mono">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                                    <Badge variant="outline" className="text-[9px]">{evt.type}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
