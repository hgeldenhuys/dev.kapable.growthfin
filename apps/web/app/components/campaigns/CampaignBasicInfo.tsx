/**
 * Campaign Basic Info Component
 * Step 1 of campaign creation wizard
 */

import { Mail, MessageSquare } from 'lucide-react';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_TYPES } from '~/types/crm';

interface CampaignBasicInfoProps {
  data: {
    name: string;
    description: string;
    objective: string;
    type: string;
    tags: string;
    channel: 'email' | 'sms';
  };
  onChange: (field: string, value: string) => void;
  errors?: Record<string, string>;
}

export function CampaignBasicInfo({ data, onChange, errors = {} }: CampaignBasicInfoProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="name">
          Campaign Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g., Summer Product Launch"
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive mt-1">{errors.name}</p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Describe the purpose of this campaign"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="objective">
          Objective <span className="text-destructive">*</span>
        </Label>
        <Select value={data.objective} onValueChange={(value) => onChange('objective', value)}>
          <SelectTrigger id="objective" className={errors.objective ? 'border-destructive' : ''}>
            <SelectValue placeholder="Select objective" />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_OBJECTIVES.map((obj) => (
              <SelectItem key={obj.value} value={obj.value}>
                {obj.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.objective && (
          <p className="text-sm text-destructive mt-1">{errors.objective}</p>
        )}
      </div>

      <div>
        <Label htmlFor="type">
          Campaign Type <span className="text-destructive">*</span>
        </Label>
        <Select value={data.type} onValueChange={(value) => onChange('type', value)}>
          <SelectTrigger id="type" className={errors.type ? 'border-destructive' : ''}>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-destructive mt-1">{errors.type}</p>
        )}
        {data.type !== 'one_time' && data.type && (
          <p className="text-sm text-muted-foreground mt-1">
            Note: Only One-Time campaigns are supported in Phase 1
          </p>
        )}
      </div>

      <div>
        <Label>
          Channel <span className="text-destructive">*</span>
        </Label>
        <ToggleGroup
          type="single"
          value={data.channel}
          onValueChange={(value) => value && onChange('channel', value)}
          className="justify-start mt-2"
        >
          <ToggleGroupItem
            value="email"
            aria-label="Email"
            className="flex items-center gap-2 px-4"
            data-testid="channel-email"
          >
            <Mail className="h-4 w-4" />
            Email
          </ToggleGroupItem>
          <ToggleGroupItem
            value="sms"
            aria-label="SMS"
            className="flex items-center gap-2 px-4"
            data-testid="channel-sms"
          >
            <MessageSquare className="h-4 w-4" />
            SMS
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-sm text-muted-foreground mt-1">
          {data.channel === 'email'
            ? 'Send personalized emails to your audience'
            : 'Send SMS messages (160 char limit per segment)'}
        </p>
        {errors.channel && (
          <p className="text-sm text-destructive mt-1">{errors.channel}</p>
        )}
      </div>

      <div>
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          value={data.tags}
          onChange={(e) => onChange('tags', e.target.value)}
          placeholder="Comma-separated tags (e.g., product-launch, summer, email)"
        />
        <p className="text-sm text-muted-foreground mt-1">
          Separate multiple tags with commas
        </p>
      </div>
    </div>
  );
}
