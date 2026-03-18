/**
 * Entity Detail Dialog Component
 * Shows detailed information about a knowledge graph entity
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Package, Lightbulb, Target, Heart, Compass, ArrowRight, Calendar, FileText, Link } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";

interface EntityDetailDialogProps {
  entity: any;
  entityType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntityClick?: (entityId: string, entityType: string) => void;
}

const entityIcons = {
  components: Package,
  decisions: Lightbulb,
  understandings: Target,
  values: Heart,
  purposes: Compass,
};

export function EntityDetailDialog({ entity, entityType, open, onOpenChange, onEntityClick }: EntityDetailDialogProps) {
  if (!entity) return null;

  const Icon = entityIcons[entityType as keyof typeof entityIcons] || Package;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Icon className="h-6 w-6" />
            {entity.name || entity.id || entity.title || 'Entity Details'}
          </DialogTitle>
          <DialogDescription>
            {entityType.charAt(0).toUpperCase() + entityType.slice(1, -1)} • {entity.id || 'No ID'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Description */}
            {(entity.description || entity.summary) && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {entity.description || entity.summary}
                </p>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {entity.type && (
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Type</div>
                    <Badge variant="outline">{entity.type}</Badge>
                  </CardContent>
                </Card>
              )}

              {entity.created && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Created</div>
                      <div className="text-sm font-medium">{entity.created}</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {entity.location && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Location</div>
                      <div className="text-xs font-mono truncate">{entity.location}</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {entity.file_path && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">File Path</div>
                      <div className="text-xs font-mono truncate">{entity.file_path}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Tags */}
            {entity.tags && entity.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {entity.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Purposes */}
            {entity.purposes && entity.purposes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Compass className="h-4 w-4" />
                  Purposes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {entity.purposes.map((purpose: string, index: number) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => onEntityClick?.(purpose, 'purposes')}
                    >
                      <Link className="h-3 w-3 mr-1" />
                      {purpose}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Embodies (Values) */}
            {entity.embodies && entity.embodies.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Embodies Values
                </h4>
                <div className="flex flex-wrap gap-2">
                  {entity.embodies.map((value: string, index: number) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => onEntityClick?.(value, 'values')}
                    >
                      <Link className="h-3 w-3 mr-1" />
                      {value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Enables */}
            {entity.enables && entity.enables.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Enables</h4>
                <div className="space-y-1">
                  {entity.enables.map((item: string, index: number) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requires */}
            {entity.requires && entity.requires.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Requires</h4>
                <div className="space-y-1">
                  {entity.requires.map((item: string, index: number) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parts */}
            {entity.parts && entity.parts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Parts</h4>
                <div className="flex flex-wrap gap-2">
                  {entity.parts.map((part: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {part}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Part Of */}
            {entity.part_of && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Part Of</h4>
                <Badge variant="outline">{entity.part_of}</Badge>
              </div>
            )}

            {/* Understandings */}
            {entity.understandings && entity.understandings.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Understandings ({entity.understandings.length})
                </h4>
                <div className="space-y-3">
                  {entity.understandings.map((understanding: any, index: number) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="font-medium text-sm">{understanding.id || `Understanding ${index + 1}`}</div>
                          {understanding.type && (
                            <Badge variant="outline" className="text-xs">
                              {understanding.type}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{understanding.insight}</p>
                        {understanding.context && (
                          <p className="text-xs text-muted-foreground italic">{understanding.context}</p>
                        )}
                        {understanding.learned && (
                          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {understanding.learned}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Coherence */}
            {entity.coherence && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Coherence Metrics</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(entity.coherence).map(([key, value]) => (
                    <Card key={key}>
                      <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground mb-1">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </div>
                        <div className="text-lg font-bold">
                          {typeof value === 'number' ? (value * 100).toFixed(0) + '%' : String(value)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
