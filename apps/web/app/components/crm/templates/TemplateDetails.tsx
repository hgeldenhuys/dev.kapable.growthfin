/**
 * TemplateDetails Component
 * Modal dialog showing full template details and JSON preview
 */

import { Copy, Eye, Edit, History, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Separator } from '~/components/ui/separator';
import { toast } from 'sonner';
import {
  useTemplate,
  useTemplateVersions,
  type CampaignTemplate,
} from '~/hooks/useCampaignTemplates';
import { format } from 'date-fns';
import { Skeleton } from '~/components/ui/skeleton';

interface TemplateDetailsProps {
  templateId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse?: (template: CampaignTemplate) => void;
  onEdit?: (template: CampaignTemplate) => void;
}

export function TemplateDetails({
  templateId,
  workspaceId,
  open,
  onOpenChange,
  onUse,
  onEdit,
}: TemplateDetailsProps) {
  const { data: template, isLoading } = useTemplate(templateId, workspaceId);
  const { data: versions = [] } = useTemplateVersions(templateId, workspaceId);

  const handleCopyJSON = () => {
    if (template) {
      navigator.clipboard.writeText(JSON.stringify(template.templateData, null, 2));
      toast.success('Copied to Clipboard', { description: 'Template configuration copied' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Template Details</span>
            {template && (
              <div className="flex items-center gap-2">
                {onUse && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onUse(template);
                      onOpenChange(false);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                )}
                {onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onEdit(template);
                      onOpenChange(false);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            )}
          </DialogTitle>
          <DialogDescription>
            View template configuration and version history
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!isLoading && template && (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                Versions ({versions.length})
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-lg font-semibold">{template.name}</h3>
                    <p className="text-muted-foreground mt-1">
                      {template.description || 'No description'}
                    </p>
                  </div>

                  <Separator />

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Category</p>
                      <Badge className="mt-1">{template.category}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Version</p>
                      <p className="text-sm text-muted-foreground mt-1">v{template.version}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Usage Count</p>
                      <p className="text-sm text-muted-foreground mt-1">{template.usageCount} times</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      <Badge variant={template.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                        {template.status}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Tags */}
                  {template.tags.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Timestamps */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>{format(new Date(template.createdAt), 'PPpp')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated</span>
                      <span>{format(new Date(template.updatedAt), 'PPpp')}</span>
                    </div>
                    {template.lastUsedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Used</span>
                        <span>{format(new Date(template.lastUsedAt), 'PPpp')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Configuration Tab */}
            <TabsContent value="config" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Template configuration in JSON format
                </p>
                <Button size="sm" variant="outline" onClick={handleCopyJSON}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto">
                  {JSON.stringify(template.templateData, null, 2)}
                </pre>
              </ScrollArea>
            </TabsContent>

            {/* Version History Tab */}
            <TabsContent value="history" className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                {versions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No version history available
                  </p>
                ) : (
                  <div className="space-y-3">
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={version.isLatestVersion ? 'default' : 'secondary'}>
                              v{version.version}
                            </Badge>
                            {version.isLatestVersion && (
                              <Badge variant="outline">Latest</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(version.createdAt), 'PPp')}
                          </span>
                        </div>
                        <p className="text-sm">{version.description || 'No description'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
