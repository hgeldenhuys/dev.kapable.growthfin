/**
 * CRM Calendar Page
 * Weekly calendar view of meetings and activities with list view toggle,
 * meeting creation dialog, and booking link management.
 */

import { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  Link,
  ExternalLink,
  Check,
  X,
  List,
  LayoutGrid,
  Loader2,
  Copy,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  type: 'call' | 'video' | 'in_person';
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  meetingUrl?: string;
  location?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  leadId?: string;
  contactId?: string;
  notes?: string;
  createdAt: string;
}

interface CalendarStats {
  total: number;
  completed: number;
  upcoming: number;
  cancelled: number;
  noShow: number;
}

interface BookingLink {
  id: string;
  title: string;
  slug: string;
  durationMinutes: number;
  bufferMinutes: number;
  availableHours: Record<string, any> | null;
  isActive: boolean;
  createdAt: string;
}

interface CreateMeetingPayload {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  type: 'call' | 'video' | 'in_person';
  meetingUrl?: string;
  location?: string;
  leadId?: string;
  contactId?: string;
  notes?: string;
}

interface CreateBookingLinkPayload {
  title: string;
  slug: string;
  durationMinutes: number;
  bufferMinutes: number;
  availableHours?: {
    start: string;
    end: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function formatDay(date: Date): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dayNames[date.getDay()]} ${date.getDate()}`;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  const startMonth = weekStart.toLocaleString('default', { month: 'short' });
  const endMonth = weekEnd.toLocaleString('default', { month: 'short' });

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
  }
  return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.toDateString() === d2.toDateString();
}

// ---------------------------------------------------------------------------
// Status / type helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-200',
  confirmed: 'bg-green-100 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200',
  cancelled: 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-400',
  completed: 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200',
  no_show: 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-950 dark:border-orange-700 dark:text-orange-200',
};

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  scheduled: 'default',
  confirmed: 'default',
  cancelled: 'secondary',
  completed: 'default',
  no_show: 'destructive',
};

function TypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'call':
      return <Phone className={className} />;
    case 'video':
      return <Video className={className} />;
    case 'in_person':
      return <MapPin className={className} />;
    default:
      return <Calendar className={className} />;
  }
}

// ---------------------------------------------------------------------------
// API hooks (inline)
// ---------------------------------------------------------------------------

function useMeetings(workspaceId: string, startDate: string, endDate: string) {
  return useQuery<Meeting[]>({
    queryKey: ['calendar', 'meetings', workspaceId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId, startDate, endDate });
      const res = await fetch(`/api/v1/crm/calendar/meetings?${params}`);
      if (!res.ok) throw new Error('Failed to fetch meetings');
      const data = await res.json();
      return data.meetings ?? data ?? [];
    },
    enabled: !!workspaceId,
  });
}

function useCalendarStats(workspaceId: string, startDate: string, endDate: string) {
  return useQuery<CalendarStats>({
    queryKey: ['calendar', 'stats', workspaceId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId, startDate, endDate });
      const res = await fetch(`/api/v1/crm/calendar/stats?${params}`);
      if (!res.ok) throw new Error('Failed to fetch calendar stats');
      const data = await res.json();
      return data;
    },
    enabled: !!workspaceId,
  });
}

function useCreateMeeting(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateMeetingPayload) => {
      const res = await fetch('/api/v1/crm/calendar/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, workspaceId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create meeting');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

function useCancelMeeting(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const res = await fetch(`/api/v1/crm/calendar/meetings/${meetingId}/cancel?workspaceId=${workspaceId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to cancel meeting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

function useCompleteMeeting(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const res = await fetch(`/api/v1/crm/calendar/meetings/${meetingId}/complete?workspaceId=${workspaceId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to complete meeting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

function useBookingLinks(workspaceId: string) {
  return useQuery<BookingLink[]>({
    queryKey: ['booking', 'links', workspaceId],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId });
      const res = await fetch(`/api/v1/crm/booking/links?${params}`);
      if (!res.ok) throw new Error('Failed to fetch booking links');
      const data = await res.json();
      return data.links ?? data ?? [];
    },
    enabled: !!workspaceId,
  });
}

function useCreateBookingLink(workspaceId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateBookingLinkPayload) => {
      const res = await fetch('/api/v1/crm/booking/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId,
          title: payload.title,
          slug: payload.slug,
          durationMinutes: payload.durationMinutes,
          bufferMinutes: payload.bufferMinutes,
          availableHours: payload.availableHours,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create booking link');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', 'links'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[640px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting block (calendar grid item)
// ---------------------------------------------------------------------------

function MeetingBlock({
  meeting,
  onClick,
}: {
  meeting: Meeting;
  onClick: (m: Meeting) => void;
}) {
  const startDate = new Date(meeting.startTime);
  const endDate = new Date(meeting.endTime);
  const startHour = startDate.getHours() + startDate.getMinutes() / 60;
  const endHour = endDate.getHours() + endDate.getMinutes() / 60;
  const durationHours = Math.max(endHour - startHour, 0.5);

  // Position: offset from 9 AM header row
  const topOffset = (startHour - 9) * 64; // 64px = h-16 per hour
  const height = durationHours * 64;

  // Only render if within viewable range
  if (startHour >= 18 || endHour <= 9) return null;

  const clampedTop = Math.max(topOffset, 0);
  const clampedHeight = Math.min(height, (18 - Math.max(startHour, 9)) * 64);

  const colorClass = STATUS_COLORS[meeting.status] || STATUS_COLORS['scheduled'];

  return (
    <button
      type="button"
      onClick={() => onClick(meeting)}
      className={cn(
        'absolute left-0.5 right-0.5 rounded border px-1.5 py-0.5 text-left overflow-hidden cursor-pointer transition-opacity hover:opacity-80 z-10',
        colorClass,
      )}
      style={{
        top: `${clampedTop}px`,
        height: `${Math.max(clampedHeight, 24)}px`,
      }}
    >
      <p className="text-[11px] font-medium truncate">{meeting.title}</p>
      <p className="text-[10px] opacity-75 truncate">
        {formatTime(meeting.startTime)}
      </p>
      {clampedHeight > 40 && meeting.attendeeName && (
        <p className="text-[10px] opacity-60 truncate">{meeting.attendeeName}</p>
      )}
      {clampedHeight > 56 && (
        <div className="mt-0.5">
          <TypeIcon type={meeting.type} className="h-3 w-3 inline-block opacity-60" />
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Meeting detail dialog
// ---------------------------------------------------------------------------

function MeetingDetailDialog({
  meeting,
  open,
  onOpenChange,
  onCancel,
  onComplete,
  cancelPending,
  completePending,
}: {
  meeting: Meeting | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCancel: (id: string) => void;
  onComplete: (id: string) => void;
  cancelPending: boolean;
  completePending: boolean;
}) {
  if (!meeting) return null;

  const canCancel = meeting.status === 'scheduled' || meeting.status === 'confirmed';
  const canComplete = meeting.status === 'scheduled' || meeting.status === 'confirmed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon type={meeting.type} className="h-5 w-5" />
            {meeting.title}
          </DialogTitle>
          <DialogDescription>
            Meeting details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[meeting.status] ?? 'secondary'}>
              {meeting.status.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {meeting.type.replace('_', ' ')}
            </Badge>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">
                  {formatDateTime(meeting.startTime)}
                </p>
                <p className="text-muted-foreground">
                  to {formatTime(meeting.endTime)}
                </p>
              </div>
            </div>

            {meeting.attendeeName && (
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{meeting.attendeeName}</p>
                  {meeting.attendeeEmail && (
                    <p className="text-muted-foreground">{meeting.attendeeEmail}</p>
                  )}
                </div>
              </div>
            )}

            {meeting.meetingUrl && (
              <div className="flex items-start gap-2">
                <Link className="h-4 w-4 text-muted-foreground mt-0.5" />
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline flex items-center gap-1"
                >
                  Join meeting
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {meeting.location && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p>{meeting.location}</p>
              </div>
            )}

            {meeting.description && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground">{meeting.description}</p>
              </div>
            )}

            {meeting.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-muted-foreground">{meeting.notes}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {canCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancel(meeting.id)}
              disabled={cancelPending}
            >
              {cancelPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <X className="mr-1 h-3 w-3" />
              )}
              Cancel Meeting
            </Button>
          )}
          {canComplete && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onComplete(meeting.id)}
              disabled={completePending}
            >
              {completePending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 h-3 w-3" />
              )}
              Mark Complete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Create meeting dialog
// ---------------------------------------------------------------------------

function CreateMeetingDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: CreateMeetingPayload) => void;
  isPending: boolean;
}) {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  const endDefault = new Date(nextHour);
  endDefault.setMinutes(endDefault.getMinutes() + 30);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(toLocalDatetimeString(nextHour));
  const [endTime, setEndTime] = useState(toLocalDatetimeString(endDefault));
  const [type, setType] = useState<'call' | 'video' | 'in_person'>('video');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description: description || undefined,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      type,
      meetingUrl: meetingUrl || undefined,
      notes: notes || undefined,
    });
  };

  // Reset form when dialog closes
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setTitle('');
      setDescription('');
      setStartTime(toLocalDatetimeString(nextHour));
      setEndTime(toLocalDatetimeString(endDefault));
      setType('video');
      setMeetingUrl('');
      setNotes('');
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Meeting</DialogTitle>
          <DialogDescription>
            Schedule a new meeting or appointment
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Title *</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Discovery call with Jane"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-desc">Description</Label>
            <Textarea
              id="meeting-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda or notes..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="meeting-start">Start *</Label>
              <Input
                id="meeting-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-end">End *</Label>
              <Input
                id="meeting-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'call' | 'video' | 'in_person')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">
                  <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Phone Call
                  </span>
                </SelectItem>
                <SelectItem value="video">
                  <span className="flex items-center gap-2">
                    <Video className="h-4 w-4" /> Video Call
                  </span>
                </SelectItem>
                <SelectItem value="in_person">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> In Person
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-url">Meeting URL</Label>
            <Input
              id="meeting-url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-notes">Notes</Label>
            <Textarea
              id="meeting-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this meeting..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Meeting
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Booking links management dialog
// ---------------------------------------------------------------------------

function BookingLinksDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
  userId: string;
}) {
  const { data: links = [], isLoading } = useBookingLinks(workspaceId);
  const createLink = useCreateBookingLink(workspaceId, userId);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [duration, setDuration] = useState('30');
  const [buffer, setBuffer] = useState('10');
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('17:00');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLink.mutateAsync({
        title,
        slug,
        durationMinutes: parseInt(duration, 10),
        bufferMinutes: parseInt(buffer, 10),
        availableHours: {
          start: startHour,
          end: endHour,
        },
      });
      toast.success('Booking link created');
      setShowCreate(false);
      setTitle('');
      setSlug('');
      setDuration('30');
      setBuffer('10');
    } catch (err) {
      toast.error('Error', { description: String(err) });
    }
  };

  const handleCopyLink = (linkSlug: string) => {
    const url = `${window.location.origin}/book/${linkSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied');
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Booking Links
          </DialogTitle>
          <DialogDescription>
            Manage shareable booking links for scheduling meetings
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {links.length === 0 && !showCreate && (
              <div className="text-center py-8 text-muted-foreground">
                <Link className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No booking links yet</p>
                <p className="text-sm">Create one to let others schedule meetings with you</p>
              </div>
            )}

            {links.length > 0 && (
              <div className="space-y-2">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{link.title}</p>
                        {link.isActive ? (
                          <Badge variant="default" className="text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        /{link.slug} &middot; {link.durationMinutes} min &middot; {link.bufferMinutes} min buffer
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyLink(link.slug)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {showCreate ? (
              <form onSubmit={handleCreate} className="space-y-4 border-t pt-4">
                <p className="font-medium text-sm">New Booking Link</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bl-title">Title</Label>
                    <Input
                      id="bl-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="30-min Meeting"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bl-slug">Slug</Label>
                    <Input
                      id="bl-slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="30min"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bl-duration">Duration (min)</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">60 minutes</SelectItem>
                        <SelectItem value="90">90 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bl-buffer">Buffer (min)</Label>
                    <Select value={buffer} onValueChange={setBuffer}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No buffer</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bl-start">Available from</Label>
                    <Input
                      id="bl-start"
                      type="time"
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bl-end">Available until</Label>
                    <Input
                      id="bl-end"
                      type="time"
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreate(false)}
                    disabled={createLink.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createLink.isPending || !title || !slug}
                  >
                    {createLink.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="mr-1 h-3 w-3" />
                    )}
                    Create
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(true)}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Booking Link
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const workspaceId = useWorkspaceId();
  const userId = useUserId();
  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart]);
  const weekEnd = useMemo(() => getWeekEnd(currentWeekStart), [currentWeekStart]);

  // View mode
  const [view, setView] = useState<'week' | 'list'>('week');

  // Dialogs
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);
  const [bookingLinksOpen, setBookingLinksOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Date strings for API
  const startDateStr = currentWeekStart.toISOString();
  const endDateStr = weekEnd.toISOString();

  // Queries
  const {
    data: meetings = [],
    isLoading: meetingsLoading,
    error: meetingsError,
  } = useMeetings(workspaceId, startDateStr, endDateStr);

  const {
    data: stats,
    isLoading: statsLoading,
  } = useCalendarStats(workspaceId, startDateStr, endDateStr);

  // Mutations
  const createMeeting = useCreateMeeting(workspaceId);
  const cancelMeeting = useCancelMeeting(workspaceId);
  const completeMeeting = useCompleteMeeting(workspaceId);

  // Hours grid (9 AM to 6 PM)
  const hours = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 9), []);

  // Group meetings by day
  const getMeetingsForDay = (day: Date): Meeting[] => {
    return meetings.filter((m) => {
      const mDate = new Date(m.startTime);
      return isSameDay(mDate, day);
    });
  };

  // Handlers
  const goToPreviousWeek = () => {
    setCurrentWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const goToToday = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  const handleCreateMeeting = async (payload: CreateMeetingPayload) => {
    try {
      await createMeeting.mutateAsync(payload);
      toast.success('Meeting created');
      setCreateMeetingOpen(false);
    } catch (err) {
      toast.error('Error creating meeting', { description: String(err) });
    }
  };

  const handleCancelMeeting = async (id: string) => {
    try {
      await cancelMeeting.mutateAsync(id);
      toast.success('Meeting cancelled');
      setDetailOpen(false);
      setSelectedMeeting(null);
    } catch (err) {
      toast.error('Error', { description: String(err) });
    }
  };

  const handleCompleteMeeting = async (id: string) => {
    try {
      await completeMeeting.mutateAsync(id);
      toast.success('Meeting marked as complete');
      setDetailOpen(false);
      setSelectedMeeting(null);
    } catch (err) {
      toast.error('Error', { description: String(err) });
    }
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDetailOpen(true);
  };

  // Loading state
  if (meetingsLoading && statsLoading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (meetingsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Calendar className="h-12 w-12 text-muted-foreground opacity-50" />
        <p className="text-destructive">Error loading calendar: {String(meetingsError)}</p>
        <Button variant="outline" onClick={goToToday}>
          Try Again
        </Button>
      </div>
    );
  }

  // Sorted meetings for list view
  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calendar className="h-8 w-8" />
            Calendar
          </h1>
          <p className="text-muted-foreground">
            Manage meetings and appointments
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as 'week' | 'list')}>
            <TabsList>
              <TabsTrigger value="week">
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Week
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="h-4 w-4 mr-1.5" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button variant="outline" size="sm" onClick={() => setBookingLinksOpen(true)}>
            <Link className="h-4 w-4 mr-1.5" />
            Booking Links
          </Button>

          <Button size="sm" onClick={() => setCreateMeetingOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Meeting
          </Button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={goToToday} className="font-medium">
          {formatWeekRange(currentWeekStart)}
        </Button>
        <Button variant="outline" size="icon" onClick={goToNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs text-muted-foreground">
          Today
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? meetings.length}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.completed ?? meetings.filter((m) => m.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">Meetings held</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.upcoming ??
                meetings.filter((m) => m.status === 'scheduled' || m.status === 'confirmed').length}
            </div>
            <p className="text-xs text-muted-foreground">Still to come</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled / No-Show</CardTitle>
            <X className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.cancelled ?? meetings.filter((m) => m.status === 'cancelled').length) +
                (stats?.noShow ?? meetings.filter((m) => m.status === 'no_show').length)}
            </div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly calendar view */}
      {view === 'week' && (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <div className="grid grid-cols-8 border rounded-lg min-w-[800px]">
              {/* Time column header */}
              <div className="border-r border-b h-10 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Time</span>
              </div>

              {/* Day headers */}
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-r last:border-r-0 border-b h-10 flex items-center justify-center',
                    isToday(day) && 'bg-blue-50 dark:bg-blue-950/30',
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isToday(day) && 'text-blue-600 dark:text-blue-400',
                    )}
                  >
                    {formatDay(day)}
                  </span>
                  {isToday(day) && (
                    <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 inline-block" />
                  )}
                </div>
              ))}

              {/* Time column + day columns with hourly rows */}
              {hours.map((hour) => (
                <div key={`row-${hour}`} className="contents">
                  {/* Time label */}
                  <div className="border-r border-b h-16 flex items-start justify-end pr-2 pt-1">
                    <span className="text-xs text-muted-foreground">
                      {hour <= 12 ? hour : hour - 12}:00 {hour < 12 ? 'AM' : 'PM'}
                    </span>
                  </div>

                  {/* Day cells */}
                  {weekDays.map((day) => (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className={cn(
                        'border-r last:border-r-0 border-b h-16',
                        isToday(day) && 'bg-blue-50/50 dark:bg-blue-950/20',
                      )}
                    />
                  ))}
                </div>
              ))}

              {/* Meeting overlays - positioned absolutely within each day column */}
              {/* We render them using a separate overlay layer */}
            </div>

            {/* Overlay meetings on top of the grid using an identical column layout */}
            <div className="grid grid-cols-8 min-w-[800px] -mt-[calc(10*4rem)] pointer-events-none">
              {/* Skip time column */}
              <div />

              {weekDays.map((day) => {
                const dayMeetings = getMeetingsForDay(day);
                return (
                  <div
                    key={`overlay-${day.toISOString()}`}
                    className="relative pointer-events-auto"
                    style={{ height: `${hours.length * 64}px` }}
                  >
                    {dayMeetings.map((meeting) => (
                      <MeetingBlock
                        key={meeting.id}
                        meeting={meeting}
                        onClick={handleMeetingClick}
                      />
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Empty state */}
            {meetings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 mb-3 opacity-50" />
                <p>No meetings this week</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCreateMeetingOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Schedule a meeting
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* List view */}
      {view === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>
              Meetings ({meetings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 mb-3 opacity-50" />
                <p>No meetings this week</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCreateMeetingOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Schedule a meeting
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Attendee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMeetings.map((meeting) => {
                    const startD = new Date(meeting.startTime);
                    const isActive =
                      meeting.status === 'scheduled' || meeting.status === 'confirmed';

                    return (
                      <TableRow
                        key={meeting.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleMeetingClick(meeting)}
                      >
                        <TableCell className="font-medium">
                          {startD.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                        </TableCell>
                        <TableCell className="font-medium">{meeting.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize gap-1">
                            <TypeIcon type={meeting.type} className="h-3 w-3" />
                            {meeting.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {meeting.attendeeName || (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE_VARIANT[meeting.status] ?? 'secondary'}>
                            {meeting.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {isActive && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCompleteMeeting(meeting.id)}
                                  disabled={completeMeeting.isPending}
                                  title="Mark complete"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelMeeting(meeting.id)}
                                  disabled={cancelMeeting.isPending}
                                  title="Cancel meeting"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create meeting dialog */}
      <CreateMeetingDialog
        open={createMeetingOpen}
        onOpenChange={setCreateMeetingOpen}
        onSubmit={handleCreateMeeting}
        isPending={createMeeting.isPending}
      />

      {/* Meeting detail dialog */}
      <MeetingDetailDialog
        meeting={selectedMeeting}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onCancel={handleCancelMeeting}
        onComplete={handleCompleteMeeting}
        cancelPending={cancelMeeting.isPending}
        completePending={completeMeeting.isPending}
      />

      {/* Booking links dialog */}
      <BookingLinksDialog
        open={bookingLinksOpen}
        onOpenChange={setBookingLinksOpen}
        workspaceId={workspaceId}
        userId={userId}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
