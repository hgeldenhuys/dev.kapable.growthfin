/**
 * SDLC Knowledge Graph Component
 * Displays entities and their relations
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { useKnowledgeGraph } from "../../hooks/useSDLC";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import { Package, Lightbulb, Target, Heart, Compass, ArrowRight, Network } from "lucide-react";
import { EntityDetailDialog } from "./EntityDetailDialog";
import { GraphVisualization } from "./GraphVisualization";
import { ReactFlowProvider } from 'reactflow';
import { SkeletonLoader } from "./SkeletonLoader";
import { ErrorState } from "./ErrorState";

const entityIcons = {
  components: Package,
  decisions: Lightbulb,
  understandings: Target,
  values: Heart,
  purposes: Compass,
};

export function KnowledgeGraph() {
  const { entities, relations, isLoading, error, refetch } = useKnowledgeGraph();
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEntityClick = (entity: any, entityType: string) => {
    setSelectedEntity(entity);
    setSelectedEntityType(entityType);
    setDialogOpen(true);
  };

  // Find entity by ID across all entity types
  const findEntityById = (entityId: string): { entity: any; type: string } | null => {
    for (const [type, items] of Object.entries(entities)) {
      const found = items.find((item: any) =>
        item.id === entityId || item.name === entityId
      );
      if (found) {
        return { entity: found, type };
      }
    }
    return null;
  };

  if (isLoading) {
    return <SkeletonLoader variant="graph" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Error Loading Knowledge Graph"
        message={error instanceof Error ? error.message : String(error)}
        onRetry={() => refetch()}
      />
    );
  }

  const totalEntities = Object.values(entities).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEntities}</div>
          </CardContent>
        </Card>

        {Object.entries(entities).map(([type, items]) => {
          const Icon = entityIcons[type as keyof typeof entityIcons] || Package;
          return (
            <Card key={type}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{items.length}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Entities Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Graph Entities</CardTitle>
          <CardDescription>Captured knowledge organized by type</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="graph" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="graph">
                <Network className="h-4 w-4 mr-2" />
                Graph View
              </TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="decisions">Decisions</TabsTrigger>
              <TabsTrigger value="understandings">Understandings</TabsTrigger>
              <TabsTrigger value="values">Values</TabsTrigger>
              <TabsTrigger value="purposes">Purposes</TabsTrigger>
            </TabsList>

            {/* Graph View Tab */}
            <TabsContent value="graph" className="mt-4">
              <ReactFlowProvider>
                <GraphVisualization
                  entities={entities}
                  relations={relations}
                  onEntityClick={handleEntityClick}
                />
              </ReactFlowProvider>
            </TabsContent>

            {Object.entries(entities).map(([type, items]) => {
              const Icon = entityIcons[type as keyof typeof entityIcons] || Package;
              return (
                <TabsContent key={type} value={type} className="mt-4">
                  <ScrollArea className="h-[500px] pr-4">
                    {items.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No {type} found
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {items.map((item: any, index: number) => (
                          <Card
                            key={index}
                            className="cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => handleEntityClick(item, type)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Icon className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium mb-1 hover:text-primary transition-colors">
                                    {item.name || item.id || item.title || `${type.slice(0, -1)} ${index + 1}`}
                                  </div>
                                  {item.description && (
                                    <div className="text-sm text-muted-foreground mb-2">
                                      {item.description}
                                    </div>
                                  )}
                                  {item.summary && (
                                    <div className="text-sm text-muted-foreground mb-2">
                                      {item.summary}
                                    </div>
                                  )}
                                  {item.tags && item.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {item.tags.map((tag: string, tagIndex: number) => (
                                        <Badge key={tagIndex} variant="outline" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {item.file_path && (
                                    <div className="text-xs text-muted-foreground mt-2 font-mono">
                                      {item.file_path}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Relations */}
      {relations && relations.length > 0 && (() => {
        // Flatten all relation types into a single array
        const flattenedRelations = relations.flatMap((relationGroup: any) => {
          const relationEntries: any[] = [];
          // Iterate through all relation types in the group
          for (const key of Object.keys(relationGroup)) {
            if (Array.isArray(relationGroup[key])) {
              const relationType = key.replace('_relations', '').replace(/_/g, '-');
              for (const rel of relationGroup[key]) {
                relationEntries.push({
                  ...rel,
                  relationType,
                });
              }
            }
          }
          return relationEntries;
        });

        return (
          <Card>
            <CardHeader>
              <CardTitle>Entity Relations ({flattenedRelations.length})</CardTitle>
              <CardDescription>Connections between knowledge graph entities</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {flattenedRelations.map((relation: any, index: number) => {
                    const fromEntity = findEntityById(relation.from);
                    const toEntity = findEntityById(relation.to);
                    const fromName = fromEntity?.entity?.name || relation.from;
                    const toName = toEntity?.entity?.name || relation.to;

                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex-1 flex items-center gap-2">
                          {fromEntity && (
                            <Badge variant="outline" className="text-xs">
                              {fromEntity.type.slice(0, -1)}
                            </Badge>
                          )}
                          <span
                            className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => fromEntity && handleEntityClick(fromEntity.entity, fromEntity.type)}
                          >
                            "{fromName}"
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium whitespace-nowrap">
                            {relation.relationType || 'relates-to'}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 flex items-center gap-2 justify-end">
                          <span
                            className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => toEntity && handleEntityClick(toEntity.entity, toEntity.type)}
                          >
                            "{toName}"
                          </span>
                          {toEntity && (
                            <Badge variant="outline" className="text-xs">
                              {toEntity.type.slice(0, -1)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })()}

      {/* Entity Detail Dialog */}
      <EntityDetailDialog
        entity={selectedEntity}
        entityType={selectedEntityType}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onEntityClick={handleEntityClick}
      />
    </div>
  );
}
