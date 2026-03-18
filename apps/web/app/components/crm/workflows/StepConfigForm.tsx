/**
 * StepConfigForm Component
 * Dynamic form for configuring workflow steps based on step type
 */

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
import type { WorkflowStep } from '~/hooks/useCampaignWorkflows';

interface StepConfigFormProps {
  step: WorkflowStep;
  onChange: (step: WorkflowStep) => void;
  campaigns?: Array<{ id: string; name: string }>;
}

export function StepConfigForm({ step, onChange, campaigns = [] }: StepConfigFormProps) {
  const updateConfig = (key: string, value: any) => {
    onChange({
      ...step,
      config: {
        ...step.config,
        [key]: value,
      },
    });
  };

  // Render different fields based on step type
  switch (step.type) {
    case 'send_campaign':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign</Label>
            <Select
              value={step.config.campaignId || ''}
              onValueChange={(value) => updateConfig('campaignId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'wait':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Wait Duration</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={step.config.duration || 1}
                onChange={(e) => updateConfig('duration', parseInt(e.target.value))}
                min={1}
              />
              <Select
                value={step.config.unit || 'days'}
                onValueChange={(value) => updateConfig('unit', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );

    case 'condition':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Field to Check</Label>
            <Input
              value={step.config.field || ''}
              onChange={(e) => updateConfig('field', e.target.value)}
              placeholder="e.g., lead.score"
            />
          </div>
          <div className="space-y-2">
            <Label>Operator</Label>
            <Select
              value={step.config.operator || 'equals'}
              onValueChange={(value) => updateConfig('operator', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="not_equals">Not Equals</SelectItem>
                <SelectItem value="greater_than">Greater Than</SelectItem>
                <SelectItem value="less_than">Less Than</SelectItem>
                <SelectItem value="contains">Contains</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Value</Label>
            <Input
              value={step.config.value || ''}
              onChange={(e) => updateConfig('value', e.target.value)}
              placeholder="Comparison value"
            />
          </div>
        </div>
      );

    case 'update_lead_field':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Field Name</Label>
            <Input
              value={step.config.field || ''}
              onChange={(e) => updateConfig('field', e.target.value)}
              placeholder="e.g., status"
            />
          </div>
          <div className="space-y-2">
            <Label>New Value</Label>
            <Input
              value={step.config.value || ''}
              onChange={(e) => updateConfig('value', e.target.value)}
              placeholder="New value for field"
            />
          </div>
        </div>
      );

    case 'add_tag':
    case 'remove_tag':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tag Name</Label>
            <Input
              value={step.config.tag || ''}
              onChange={(e) => updateConfig('tag', e.target.value)}
              placeholder="Tag to add/remove"
            />
          </div>
        </div>
      );

    case 'send_notification':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Recipient Email</Label>
            <Input
              type="email"
              value={step.config.email || ''}
              onChange={(e) => updateConfig('email', e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={step.config.subject || ''}
              onChange={(e) => updateConfig('subject', e.target.value)}
              placeholder="Notification subject"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={step.config.message || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
              placeholder="Notification message"
              rows={4}
            />
          </div>
        </div>
      );

    default:
      return (
        <div className="text-sm text-muted-foreground">
          No configuration needed for this step type
        </div>
      );
  }
}
