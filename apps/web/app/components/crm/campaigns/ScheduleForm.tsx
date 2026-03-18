/**
 * ScheduleForm Component
 * Date/time picker with timezone selector for scheduling campaigns
 */

import { useState, useEffect } from 'react';
import { Calendar } from '~/components/ui/calendar';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { cn } from '~/lib/utils';
import { format, formatDistanceToNow, parseISO, isBefore, addMinutes } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { CalendarIcon, Clock } from 'lucide-react';

interface ScheduleFormProps {
  campaignId: string;
  onSchedule: (scheduledAt: string, timezone: string) => void;
  onCancel: () => void;
  initialDate?: Date;
  initialTimezone?: string;
  isSubmitting?: boolean;
}

// Common IANA timezones
const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'ET (Eastern Time)' },
  { value: 'America/Chicago', label: 'CT (Central Time)' },
  { value: 'America/Denver', label: 'MT (Mountain Time)' },
  { value: 'America/Los_Angeles', label: 'PT (Pacific Time)' },
  { value: 'Europe/London', label: 'GMT (London)' },
  { value: 'Europe/Paris', label: 'CET (Paris)' },
  { value: 'Africa/Johannesburg', label: 'SAST (South Africa)' },
  { value: 'Asia/Dubai', label: 'GST (Dubai)' },
  { value: 'Asia/Shanghai', label: 'CST (Shanghai)' },
  { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
  { value: 'Australia/Sydney', label: 'AEDT (Sydney)' },
];

export function ScheduleForm({
  campaignId,
  onSchedule,
  onCancel,
  initialDate,
  initialTimezone = 'UTC',
  isSubmitting = false,
}: ScheduleFormProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialDate || addMinutes(new Date(), 30) // Default to 30 minutes from now
  );
  const [time, setTime] = useState<string>(
    initialDate ? format(initialDate, 'HH:mm') : format(addMinutes(new Date(), 30), 'HH:mm')
  );
  const [timezone, setTimezone] = useState<string>(initialTimezone);
  const [error, setError] = useState<string>('');

  // Calculate countdown display
  const getCountdown = () => {
    if (!selectedDate || !time) return null;

    const [hours, minutes] = time.split(':').map(Number);
    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);

    // Check if in the past
    if (isBefore(scheduledDateTime, new Date())) {
      return 'Invalid: Time is in the past';
    }

    return `Executes in ${formatDistanceToNow(scheduledDateTime)}`;
  };

  const handleSubmit = () => {
    if (!selectedDate || !time) {
      setError('Please select both date and time');
      return;
    }

    const [hours, minutes] = time.split(':').map(Number);
    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);

    // Validate future date
    if (isBefore(scheduledDateTime, new Date())) {
      setError('Scheduled time must be in the future');
      return;
    }

    // Convert to ISO string in the selected timezone
    const scheduledAtISO = formatInTimeZone(
      scheduledDateTime,
      timezone,
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );

    setError('');
    onSchedule(scheduledAtISO, timezone);
  };

  const countdown = getCountdown();
  const isValid = countdown && !countdown.startsWith('Invalid');

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Date Picker */}
        <div className="space-y-2">
          <Label htmlFor="schedule-date">Schedule Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="schedule-date"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !selectedDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => isBefore(date, new Date(new Date().setHours(0, 0, 0, 0)))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time Picker */}
        <div className="space-y-2">
          <Label htmlFor="schedule-time">Time</Label>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              id="schedule-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        {/* Timezone Selector */}
        <div className="space-y-2">
          <Label htmlFor="schedule-timezone">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="schedule-timezone">
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

        {/* Countdown Preview */}
        {countdown && (
          <div
            className={cn(
              'rounded-md border p-3 text-sm',
              isValid ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
            )}
          >
            {countdown}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
          {isSubmitting ? 'Scheduling...' : 'Schedule Campaign'}
        </Button>
      </div>
    </div>
  );
}
