/**
 * RecurrenceConfig Component
 * Recurring pattern builder for daily, weekly, and monthly campaigns
 */

import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Checkbox } from '~/components/ui/checkbox';
import { Calendar } from '~/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { cn } from '~/lib/utils';
import { format, addDays, addWeeks, addMonths, isBefore } from 'date-fns';
import { CalendarIcon, Clock, Repeat } from 'lucide-react';

interface RecurrenceConfigProps {
  campaignId: string;
  onSave: (config: RecurrenceConfiguration) => void;
  onCancel: () => void;
  initialConfig?: Partial<RecurrenceConfiguration>;
  isSubmitting?: boolean;
}

export interface RecurrenceConfiguration {
  pattern: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format
  timezone: string;
  daysOfWeek?: number[]; // For weekly: 0=Sun, 1=Mon, etc.
  dayOfMonth?: number; // For monthly: 1-31, -1=last day
  endCondition: 'never' | 'after_executions' | 'end_date';
  maxExecutions?: number;
  endDate?: Date;
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

const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
}));
DAYS_OF_MONTH.push({ value: -1, label: 'Last day' });

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function RecurrenceConfig({
  campaignId,
  onSave,
  onCancel,
  initialConfig,
  isSubmitting = false,
}: RecurrenceConfigProps) {
  const [pattern, setPattern] = useState<'daily' | 'weekly' | 'monthly'>(
    initialConfig?.pattern || 'weekly'
  );
  const [time, setTime] = useState<string>(initialConfig?.time || '09:00');
  const [timezone, setTimezone] = useState<string>(initialConfig?.timezone || 'UTC');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    initialConfig?.daysOfWeek || [1, 3, 5] // Mon, Wed, Fri default
  );
  const [dayOfMonth, setDayOfMonth] = useState<number>(initialConfig?.dayOfMonth || 1);
  const [endCondition, setEndCondition] = useState<'never' | 'after_executions' | 'end_date'>(
    initialConfig?.endCondition || 'never'
  );
  const [maxExecutions, setMaxExecutions] = useState<number>(initialConfig?.maxExecutions || 10);
  const [endDate, setEndDate] = useState<Date | undefined>(initialConfig?.endDate);
  const [error, setError] = useState<string>('');

  // Calculate next 5 executions for preview
  const getNextExecutions = (): string[] => {
    const executions: string[] = [];
    let currentDate = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    currentDate.setHours(hours, minutes, 0, 0);

    let count = 0;
    const maxIterations = 100; // Prevent infinite loop

    while (executions.length < 5 && count < maxIterations) {
      count++;

      if (pattern === 'daily') {
        currentDate = addDays(currentDate, 1);
        executions.push(format(currentDate, 'EEE, MMM d, yyyy \'at\' h:mm a'));
      } else if (pattern === 'weekly') {
        currentDate = addDays(currentDate, 1);
        const dayOfWeek = currentDate.getDay();
        if (daysOfWeek.includes(dayOfWeek)) {
          executions.push(format(currentDate, 'EEE, MMM d, yyyy \'at\' h:mm a'));
        }
      } else if (pattern === 'monthly') {
        currentDate = addMonths(currentDate, 1);
        if (dayOfMonth === -1) {
          // Last day of month
          const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          currentDate.setDate(lastDay.getDate());
        } else {
          currentDate.setDate(dayOfMonth);
        }
        executions.push(format(currentDate, 'EEE, MMM d, yyyy \'at\' h:mm a'));
      }
    }

    return executions;
  };

  const toggleDayOfWeek = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const handleSubmit = () => {
    // Validation
    if (pattern === 'weekly' && daysOfWeek.length === 0) {
      setError('Please select at least one day for weekly recurrence');
      return;
    }

    if (endCondition === 'after_executions' && (!maxExecutions || maxExecutions < 1)) {
      setError('Please enter a valid number of executions');
      return;
    }

    if (endCondition === 'end_date') {
      if (!endDate) {
        setError('Please select an end date');
        return;
      }
      if (isBefore(endDate, new Date())) {
        setError('End date must be in the future');
        return;
      }
    }

    const config: RecurrenceConfiguration = {
      pattern,
      time,
      timezone,
      endCondition,
      ...(pattern === 'weekly' && { daysOfWeek }),
      ...(pattern === 'monthly' && { dayOfMonth }),
      ...(endCondition === 'after_executions' && { maxExecutions }),
      ...(endCondition === 'end_date' && { endDate }),
    };

    setError('');
    onSave(config);
  };

  const nextExecutions = getNextExecutions();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Pattern Selector */}
        <div className="space-y-2">
          <Label>Recurrence Pattern</Label>
          <Select value={pattern} onValueChange={(value: any) => setPattern(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Weekly: Days of Week */}
        {pattern === 'weekly' && (
          <div className="space-y-2">
            <Label>Days of Week</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <Button
                  key={day.value}
                  variant={daysOfWeek.includes(day.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleDayOfWeek(day.value)}
                  type="button"
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Monthly: Day of Month */}
        {pattern === 'monthly' && (
          <div className="space-y-2">
            <Label>Day of Month</Label>
            <Select value={String(dayOfMonth)} onValueChange={(value) => setDayOfMonth(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_MONTH.map((day) => (
                  <SelectItem key={day.value} value={String(day.value)}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Time Picker */}
        <div className="space-y-2">
          <Label htmlFor="recurrence-time">Time of Day</Label>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              id="recurrence-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        {/* Timezone Selector */}
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
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

        {/* End Condition */}
        <div className="space-y-3">
          <Label>End Condition</Label>
          <RadioGroup value={endCondition} onValueChange={(value: any) => setEndCondition(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="never" id="never" />
              <Label htmlFor="never" className="font-normal cursor-pointer">
                Never end
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="after_executions" id="after_executions" />
              <Label htmlFor="after_executions" className="font-normal cursor-pointer">
                After
              </Label>
              <Input
                type="number"
                min="1"
                value={maxExecutions}
                onChange={(e) => setMaxExecutions(Number(e.target.value))}
                disabled={endCondition !== 'after_executions'}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">executions</span>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="end_date" id="end_date" />
              <Label htmlFor="end_date" className="font-normal cursor-pointer">
                End on
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={endCondition !== 'end_date'}
                    className={cn(
                      'justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => isBefore(date, new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </RadioGroup>
        </div>

        {/* Preview: Next 5 Executions */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Next 5 Executions:
          </Label>
          <div className="rounded-md border bg-muted/50 p-3 space-y-1">
            {nextExecutions.length > 0 ? (
              nextExecutions.map((execution, index) => (
                <div key={index} className="text-sm">
                  {index + 1}. {execution} {timezone}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No valid executions scheduled</div>
            )}
          </div>
        </div>

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
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Recurrence'}
        </Button>
      </div>
    </div>
  );
}
