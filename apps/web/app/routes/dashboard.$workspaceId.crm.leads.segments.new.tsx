/**
 * Create New Segment Page
 * Visual query builder for creating dynamic lead segments
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useCreateSegment } from '~/hooks/useSegments';
import { toast } from 'sonner';
import { SegmentBuilder } from '~/components/crm/leads/SegmentBuilder';
import { SegmentPreview } from '~/components/crm/leads/SegmentPreview';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CreateSegmentPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const createSegment = useCreateSegment();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [criteria, setCriteria] = useState({
    all: []
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15);

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads/segments`);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Validation Error', { description: 'Segment name is required' });
      return;
    }

    if (criteria.all.length === 0 && !criteria.any) {
      toast.error('Validation Error', { description: 'At least one criteria condition is required' });
      return;
    }

    try {
      const segment = await createSegment.mutateAsync({
        workspaceId,
        name,
        description,
        color,
        criteria,
        autoRefresh,
        refreshIntervalMinutes: refreshInterval,
      });

      toast.success('Segment Created', { description: `"${name}" has been created successfully` });

      navigate(`/dashboard/${workspaceId}/crm/leads/segments/${segment.id}`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Create Segment</h1>
          <p className="text-muted-foreground">
            Build dynamic segments with visual query builder
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={createSegment.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {createSegment.isPending ? 'Saving...' : 'Save Segment'}
        </Button>
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Segment Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., High-Value Enterprise Leads"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this segment represents..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color Tag</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-20 h-10"
                  />
                  <span className="text-sm text-muted-foreground">{color}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Criteria Builder */}
          <Card>
            <CardHeader>
              <CardTitle>Segment Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              <SegmentBuilder
                criteria={criteria}
                onChange={setCriteria}
                workspaceId={workspaceId}
              />
            </CardContent>
          </Card>

          {/* Auto-Refresh Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Auto-Refresh Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="autoRefresh">
                  Automatically refresh segment membership
                </Label>
              </div>

              {autoRefresh && (
                <div className="space-y-2">
                  <Label htmlFor="refreshInterval">Refresh Interval (minutes)</Label>
                  <Input
                    id="refreshInterval"
                    type="number"
                    min="5"
                    max="1440"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Segment will be recalculated every {refreshInterval} minutes
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview */}
        <div className="space-y-6">
          <SegmentPreview
            criteria={criteria}
            workspaceId={workspaceId}
          />
        </div>
      </div>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
