/**
 * Event Summaries Dashboard Page
 * Real-time event summaries viewer with SSE updates
 * Filtered by Project + Agent Type context from URL
 *
 * Phase 1: MVP ✓
 * Phase 2: Timeline, Export, Persona Filtering (IN PROGRESS)
 * Phase 3: Grouping, Analytics
 */
import { Activity, Bot, FileText, Loader2, Filter, Zap, Brain, Hash, Download, Clock, Users, BarChart3, GitBranch } from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { FormattedDate, RelativeTime } from "../components/FormattedDate";
import { cn } from "../lib/utils";
import { useSharedSSE } from "../hooks/useSharedSSE";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const API_URL = typeof window !== 'undefined'
  ? (window as any).ENV?.API_URL || 'http://localhost:3000'
  : 'http://localhost:3000';

interface EventSummary {
  id: string;
  hookEventId: string;
  hookEventType: string;
  summary: string;
  sessionId: string;
  projectId: string | null;
  transactionId: string | null;
  personaId: string | null;
  role: string | null;
  llmConfigId: string | null;
  createdAt: string;
}

// Event type icons mapping
const EVENT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'command': Hash,
  'tool': Zap,
  'message': FileText,
  'thinking': Brain,
  'default': Activity
};

export default function EventSummaries() {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [personaFilter, setPersonaFilter] = useState<string>("all");  // US-008: Persona filtering
  const [viewMode, setViewMode] = useState<"cards" | "timeline" | "analytics">("cards");  // US-006: Timeline view, US-010: Analytics
  const [groupBySession, setGroupBySession] = useState(false);  // US-009: Summary grouping

  // Fetch summaries with shared SSE for real-time updates
  const { data: summaries = [], isLoading, error, isLeader } = useSharedSSE<EventSummary>({
    table: 'event_summaries',
    queryKey: ['event-summaries'],
    fetchFn: async () => {
      const params = new URLSearchParams();
      params.append('seconds', '86400'); // Last 24 hours

      const response = await fetch(`${API_URL}/api/v1/summaries/recent?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch summaries: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data.summaries) ? data.summaries : [];
    },
  });

  // Extract unique event types, sessions, and personas for filters
  const eventTypes = [...new Set(summaries.map(s => s.hookEventType))].sort();
  const sessions = [...new Set(summaries.map(s => s.sessionId))];
  const personas = [...new Set(summaries.map(s => s.personaId).filter(Boolean))].sort();  // US-008

  // Apply filters
  const filteredSummaries = summaries.filter((summary) => {
    // Event type filter
    if (eventTypeFilter !== "all" && summary.hookEventType !== eventTypeFilter) return false;

    // Session filter
    if (sessionFilter !== "all" && summary.sessionId !== sessionFilter) return false;

    // Persona filter (US-008)
    if (personaFilter !== "all") {
      if (personaFilter === "none" && summary.personaId) return false;
      if (personaFilter !== "none" && summary.personaId !== personaFilter) return false;
    }

    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (!summary.summary.toLowerCase().includes(searchLower) &&
          !summary.hookEventType.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    return true;
  });

  // Sort reverse chronologically (latest first)
  const sortedSummaries = [...filteredSummaries].sort((a, b) => {
    const aDate = new Date(a.createdAt).getTime();
    const bDate = new Date(b.createdAt).getTime();
    return bDate - aDate;
  });

  // Calculate statistics
  const totalSummaries = summaries.length;
  const uniqueSessions = new Set(summaries.map(s => s.sessionId)).size;
  const avgSummariesPerSession = uniqueSessions > 0 ? Math.round(totalSummaries / uniqueSessions) : 0;

  // Count by event type
  const eventTypeCounts = summaries.reduce((acc, summary) => {
    acc[summary.hookEventType] = (acc[summary.hookEventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Find most common event type
  const mostCommonEventType = Object.entries(eventTypeCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Build context display (updated for persona filter)
  const contextDisplay = (() => {
    let base = "All Events";
    // Add persona context if filtered (US-008)
    if (personaFilter !== "all") {
      base += ` • Persona: ${personaFilter === "none" ? "No Persona" : personaFilter}`;
    }
    return base;
  })();

  // US-007: Export functionality
  const exportSummaries = (format: 'json' | 'csv') => {
    const dataToExport = sortedSummaries;

    if (format === 'json') {
      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `summaries-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      // CSV export
      const headers = ['ID', 'Type', 'Summary', 'Session ID', 'Project ID', 'Persona ID', 'Created At'];
      const rows = dataToExport.map(s => [
        s.id,
        s.hookEventType,
        `"${s.summary.replace(/"/g, '""')}"`,  // Escape quotes in CSV
        s.sessionId,
        s.projectId || '',
        s.personaId || '',
        s.createdAt
      ]);

      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `summaries-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // US-009: Group summaries by session for grouped view
  const groupedSummaries = useMemo(() => {
    if (!groupBySession) return null;

    const groups = new Map<string, EventSummary[]>();
    sortedSummaries.forEach(summary => {
      if (!groups.has(summary.sessionId)) {
        groups.set(summary.sessionId, []);
      }
      groups.get(summary.sessionId)!.push(summary);
    });

    return Array.from(groups.entries()).map(([sessionId, items]) => ({
      sessionId,
      items,
      count: items.length,
      firstEvent: items[items.length - 1],  // Oldest
      lastEvent: items[0],  // Newest (sorted reverse chron)
    }));
  }, [groupBySession, sortedSummaries]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading summaries: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Event Summaries
            {/* Real-time indicator */}
            <span className={`flex items-center gap-1.5 text-xs font-normal ${
              isLeader
                ? 'text-green-600 dark:text-green-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full opacity-75 ${
                  isLeader ? 'bg-green-400 rounded-full' : 'bg-blue-400'
                }`}></span>
                <span className={`relative inline-flex h-2 w-2 ${
                  isLeader ? 'bg-green-500 rounded-full' : 'bg-blue-500'
                }`}></span>
              </span>
              Live
            </span>
          </h1>
          <p className="text-muted-foreground">
            {contextDisplay} • Real-time agent activity updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* US-007: Export button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportSummaries('json')}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSummaries('csv')}>
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {totalSummaries} Events
          </Badge>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSummaries}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueSessions}</div>
            <p className="text-xs text-muted-foreground">
              {avgSummariesPerSession} events/session avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Event Types</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventTypes.length}</div>
            <p className="text-xs text-muted-foreground">
              Most: {mostCommonEventType}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latest Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sortedSummaries[0] ? (
                <RelativeTime date={sortedSummaries[0].createdAt} />
              ) : (
                'N/A'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {sortedSummaries[0]?.hookEventType || 'No events'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="event-type-filter">Event Type</Label>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger id="event-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {eventTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-filter">Session</Label>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger id="session-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {sessions.map(sessionId => (
                    <SelectItem key={sessionId} value={sessionId}>
                      {sessionId.slice(0, 8)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* US-008: Persona filter */}
            <div className="space-y-2">
              <Label htmlFor="persona-filter">Persona</Label>
              <Select value={personaFilter} onValueChange={setPersonaFilter}>
                <SelectTrigger id="persona-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Personas</SelectItem>
                  <SelectItem value="none">No Persona</SelectItem>
                  {personas.map(personaId => (
                    <SelectItem key={personaId} value={personaId}>
                      {personaId.slice(0, 8)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search summaries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {sortedSummaries.length} of {summaries.length} summaries
            </p>
            {(eventTypeFilter !== "all" || sessionFilter !== "all" || personaFilter !== "all" || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEventTypeFilter("all");
                  setSessionFilter("all");
                  setPersonaFilter("all");
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="cards">
              <FileText className="h-4 w-4 mr-2" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <Clock className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>
          {viewMode === "cards" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupBySession(!groupBySession)}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              {groupBySession ? "Ungrouped" : "Group by Session"}
            </Button>
          )}
        </div>

        {sortedSummaries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {summaries.length === 0 ? "No Events Found" : "No Matching Events"}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {summaries.length === 0
                  ? `No event summaries for ${contextDisplay}. Summaries will appear here as agents perform actions.`
                  : "Try adjusting your filters to see more summaries."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Cards View */}
            <TabsContent value="cards">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {groupBySession ? "Grouped by Session" : "Event Timeline"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    {groupBySession && groupedSummaries ? (
                      <div className="space-y-6">
                        {groupedSummaries.map(group => (
                          <SessionGroup key={group.sessionId} group={group} />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sortedSummaries.map((summary) => (
                          <SummaryCard key={summary.id} summary={summary} />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Timeline View (US-006) */}
            <TabsContent value="timeline">
              <TimelineView summaries={sortedSummaries} />
            </TabsContent>

            {/* Analytics View (US-010) */}
            <TabsContent value="analytics">
              <AnalyticsView summaries={sortedSummaries} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

// US-009: Session Group Component for grouped view
function SessionGroup({ group }: {
  group: {
    sessionId: string;
    items: EventSummary[];
    count: number;
    firstEvent: EventSummary;
    lastEvent: EventSummary;
  }
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium">Session: {group.sessionId.slice(0, 8)}...</div>
            <div className="text-sm text-muted-foreground">
              {group.count} events • <RelativeTime date={group.firstEvent.createdAt} /> to <RelativeTime date={group.lastEvent.createdAt} />
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm">
          {expanded ? "Collapse" : "Expand"}
        </Button>
      </div>
      {expanded && (
        <div className="mt-4 space-y-4 pl-8">
          {group.items.map(summary => (
            <SummaryCard key={summary.id} summary={summary} />
          ))}
        </div>
      )}
    </div>
  );
}

// US-006: Timeline View Component
function TimelineView({ summaries }: { summaries: EventSummary[] }) {
  // Group by session for parallel lanes
  const sessionLanes = useMemo(() => {
    const lanes = new Map<string, EventSummary[]>();
    summaries.forEach(summary => {
      if (!lanes.has(summary.sessionId)) {
        lanes.set(summary.sessionId, []);
      }
      lanes.get(summary.sessionId)!.push(summary);
    });
    return Array.from(lanes.entries());
  }, [summaries]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timeline View
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-8">
            {sessionLanes.map(([sessionId, events]) => (
              <div key={sessionId} className="relative">
                <div className="sticky left-0 mb-4">
                  <Badge variant="outline">Session: {sessionId.slice(0, 8)}...</Badge>
                </div>
                <div className="pl-8 border-l-2 border-muted space-y-4">
                  {events.map((event, idx) => (
                    <div key={event.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-10 w-4 h-4 bg-primary rounded-full border-2 border-background" />

                      {/* Event card */}
                      <div className="ml-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {event.hookEventType}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            <FormattedDate date={event.createdAt} format="short" />
                          </span>
                        </div>
                        <p className="text-sm">{event.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// US-010: Analytics View Component
function AnalyticsView({ summaries }: { summaries: EventSummary[] }) {
  // Calculate hourly distribution
  const hourlyDistribution = useMemo(() => {
    const hours = new Array(24).fill(0);
    summaries.forEach(summary => {
      const hour = new Date(summary.createdAt).getHours();
      hours[hour]++;
    });
    return hours;
  }, [summaries]);

  // Calculate event type distribution
  const typeDistribution = useMemo(() => {
    const types = new Map<string, number>();
    summaries.forEach(summary => {
      types.set(summary.hookEventType, (types.get(summary.hookEventType) || 0) + 1);
    });
    return Array.from(types.entries()).sort((a, b) => b[1] - a[1]);
  }, [summaries]);

  // Find peak activity time
  const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Peak Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {peakHour}:00 - {peakHour + 1}:00
            </div>
            <p className="text-xs text-muted-foreground">
              {hourlyDistribution[peakHour]} events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Events/Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(summaries.length / 24)}
            </div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Most Active Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typeDistribution[0]?.[0] || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {typeDistribution[0]?.[1] || 0} events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Hourly Activity Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-1">
            {hourlyDistribution.map((count, hour) => {
              const height = count > 0 ? (count / Math.max(...hourlyDistribution)) * 100 : 0;
              return (
                <div
                  key={hour}
                  className="flex-1 bg-primary/20 hover:bg-primary/30 transition-colors relative group"
                  style={{ height: `${height}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant="secondary" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                  {hour % 3 === 0 && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                      {hour}h
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Event Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {typeDistribution.slice(0, 10).map(([type, count]) => {
              const percentage = ((count / summaries.length) * 100).toFixed(1);
              return (
                <div key={type} className="flex items-center gap-4">
                  <div className="w-32 font-medium">{type}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground w-20 text-right">
                    {count} ({percentage}%)
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ summary }: { summary: EventSummary }) {
  const IconComponent = EVENT_TYPE_ICONS[summary.hookEventType] || EVENT_TYPE_ICONS.default;

  // Determine color based on event type
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'command':
        return 'bg-blue-500 text-blue-50';
      case 'tool':
        return 'bg-purple-500 text-purple-50';
      case 'message':
        return 'bg-green-500 text-green-50';
      case 'thinking':
        return 'bg-amber-500 text-amber-50';
      default:
        return 'bg-gray-500 text-gray-50';
    }
  };

  return (
    <div className="flex gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      {/* Event Type Icon */}
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        getEventTypeColor(summary.hookEventType)
      )}>
        <IconComponent className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {summary.hookEventType}
            </Badge>
            {summary.personaId && (
              <Badge variant="outline" className="text-xs">
                Persona: {summary.personaId.slice(0, 8)}...
              </Badge>
            )}
            {summary.role && (
              <Badge variant="outline" className="text-xs">
                {summary.role}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RelativeTime date={summary.createdAt} />
          </div>
        </div>

        <p className="text-sm whitespace-pre-wrap break-words">{summary.summary}</p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FormattedDate date={summary.createdAt} format="long" />
          {summary.sessionId && (
            <>
              <span>•</span>
              <span className="font-mono">Session: {summary.sessionId.slice(0, 8)}...</span>
            </>
          )}
          {summary.transactionId && (
            <>
              <span>•</span>
              <span className="font-mono">Tx: {summary.transactionId.slice(0, 8)}...</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}