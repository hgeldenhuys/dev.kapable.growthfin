/**
 * ActivityForm Component
 * Create/edit activity with dynamic fields based on type
 */

import { useState } from 'react';
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
import type { Activity, CreateActivityRequest } from '~/types/crm';
import { ACTIVITY_TYPES, ACTIVITY_PRIORITIES, ACTIVITY_STATUSES, CALL_DIRECTIONS } from '~/types/crm';

interface ActivityFormProps {
  activity?: Activity;
  relatedToType?: 'lead' | 'contact' | 'account' | 'opportunity';
  relatedToId?: string;
  workspaceId: string;
  assignedToId: string;
  onSubmit: (data: CreateActivityRequest) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function ActivityForm({
  activity,
  relatedToType,
  relatedToId,
  workspaceId,
  assignedToId,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ActivityFormProps) {
  const [activityType, setActivityType] = useState<'task' | 'call' | 'email' | 'sms' | 'whatsapp' | 'meeting'>(
    activity?.type || activity?.activityType || 'task'
  );
  const [subject, setSubject] = useState(activity?.subject || '');
  const [description, setDescription] = useState(activity?.description || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(
    activity?.priority || 'medium'
  );
  const [status, setStatus] = useState<'planned' | 'in_progress' | 'completed' | 'cancelled'>(
    activity?.status || 'planned'
  );
  const [dueDate, setDueDate] = useState(
    activity?.dueDate ? activity.dueDate.substring(0, 16) : ''
  );

  // Call-specific fields
  const [callDirection, setCallDirection] = useState<'inbound' | 'outbound'>(
    (activity?.callDirection as 'inbound' | 'outbound') || 'outbound'
  );
  const [callDuration, setCallDuration] = useState(activity?.callDuration?.toString() || '');

  // Meeting-specific fields
  const [meetingLocation, setMeetingLocation] = useState(activity?.meetingLocation || '');
  const [meetingStartTime, setMeetingStartTime] = useState(
    activity?.meetingStartTime ? activity.meetingStartTime.substring(0, 16) : ''
  );
  const [meetingEndTime, setMeetingEndTime] = useState(
    activity?.meetingEndTime ? activity.meetingEndTime.substring(0, 16) : ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Map frontend field names to backend API field names
    // Backend expects: type (not activityType), assigneeId (not assignedToId),
    // and individual entity ID fields (contactId, leadId, etc.) instead of relatedToType/relatedToId
    const resolvedRelatedType = relatedToType || activity?.relatedToType;
    const resolvedRelatedId = relatedToId || activity?.relatedToId;

    const data: CreateActivityRequest = {
      workspaceId,
      type: activityType,
      subject,
      description: description || undefined,
      priority,
      status,
      assigneeId: assignedToId,
      createdBy: assignedToId,
      updatedBy: assignedToId,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      // Map relatedToType/relatedToId to specific entity ID fields
      ...(resolvedRelatedType === 'contact' && resolvedRelatedId ? { contactId: resolvedRelatedId } : {}),
      ...(resolvedRelatedType === 'lead' && resolvedRelatedId ? { leadId: resolvedRelatedId } : {}),
      ...(resolvedRelatedType === 'account' && resolvedRelatedId ? { accountId: resolvedRelatedId } : {}),
      ...(resolvedRelatedType === 'opportunity' && resolvedRelatedId ? { opportunityId: resolvedRelatedId } : {}),
    };

    // Add call-specific fields to metadata
    if (activityType === 'call') {
      data.metadata = {
        ...data.metadata,
        callDirection,
        ...(callDuration ? { callDuration: parseInt(callDuration, 10) } : {}),
      };
    }

    // Add meeting-specific fields to metadata
    if (activityType === 'meeting') {
      data.metadata = {
        ...data.metadata,
        meetingLocation: meetingLocation || undefined,
        ...(meetingStartTime ? { meetingStartTime: new Date(meetingStartTime).toISOString() } : {}),
        ...(meetingEndTime ? { meetingEndTime: new Date(meetingEndTime).toISOString() } : {}),
      };
    }

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Activity Type */}
      <div className="space-y-2">
        <Label htmlFor="activityType">Activity Type</Label>
        <Select value={activityType} onValueChange={(value: any) => setActivityType(value)}>
          <SelectTrigger id="activityType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="subject">Subject *</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter activity subject"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter activity description"
          rows={3}
        />
      </div>

      {/* Priority and Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(value: any) => setStatus(value)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Due Date */}
      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date</Label>
        <Input
          id="dueDate"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      {/* Call-specific fields */}
      {activityType === 'call' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="callDirection">Direction</Label>
              <Select value={callDirection} onValueChange={(value: any) => setCallDirection(value)}>
                <SelectTrigger id="callDirection">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALL_DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="callDuration">Duration (seconds)</Label>
              <Input
                id="callDuration"
                type="number"
                value={callDuration}
                onChange={(e) => setCallDuration(e.target.value)}
                placeholder="e.g., 300"
              />
            </div>
          </div>
        </>
      )}

      {/* Meeting-specific fields */}
      {activityType === 'meeting' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="meetingLocation">Location</Label>
            <Input
              id="meetingLocation"
              value={meetingLocation}
              onChange={(e) => setMeetingLocation(e.target.value)}
              placeholder="Meeting location or URL"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="meetingStartTime">Start Time</Label>
              <Input
                id="meetingStartTime"
                type="datetime-local"
                value={meetingStartTime}
                onChange={(e) => setMeetingStartTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meetingEndTime">End Time</Label>
              <Input
                id="meetingEndTime"
                type="datetime-local"
                value={meetingEndTime}
                onChange={(e) => setMeetingEndTime(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : activity ? 'Update Activity' : 'Create Activity'}
        </Button>
      </div>
    </form>
  );
}
