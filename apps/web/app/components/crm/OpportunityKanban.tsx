/**
 * OpportunityKanban Component
 * Drag-and-drop kanban board for opportunities
 */

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { ScrollArea } from '~/components/ui/scroll-area';
import { OpportunityCard } from './OpportunityCard';
import { OPPORTUNITY_STAGES, type Opportunity } from '~/types/crm';
import { Loader2 } from 'lucide-react';

// Droppable Column Component
function DroppableColumn({
  id,
  children,
  isDragging,
}: {
  id: string;
  children: React.ReactNode;
  isDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 min-h-[100px] p-2 rounded-lg transition-colors ${
        isOver ? 'bg-muted/50 ring-2 ring-primary/30' : ''
      } ${isDragging ? 'bg-muted/20' : ''}`}
    >
      {children}
    </div>
  );
}

interface OpportunityKanbanProps {
  opportunities: Opportunity[];
  onStageChange: (opportunityId: string, newStage: string, probability: number) => Promise<void>;
  onEdit: (opportunity: Opportunity) => void;
  onDelete: (opportunity: Opportunity) => void;
  onClick: (opportunity: Opportunity) => void;
  isLoading?: boolean;
  accountNames?: Map<string, string>;
  contactNames?: Map<string, string>;
}

export function OpportunityKanban({
  opportunities,
  onStageChange,
  onEdit,
  onDelete,
  onClick,
  isLoading,
  accountNames,
  contactNames,
}: OpportunityKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter out closed stages from main columns
  const activeStages = OPPORTUNITY_STAGES.filter(
    s => s.value !== 'closed_won' && s.value !== 'closed_lost'
  );

  // Group opportunities by stage
  const columns = activeStages.map(stage => {
    const stageOpportunities = opportunities.filter(
      opp => opp.stage === stage.value && opp.status === 'open'
    );

    const totalValue = stageOpportunities.reduce(
      (sum, opp) => sum + parseFloat(opp.amount || '0'),
      0
    );

    const weightedValue = stageOpportunities.reduce(
      (sum, opp) => sum + (parseFloat(opp.amount || '0') * opp.probability / 100),
      0
    );

    return {
      id: stage.value,
      title: stage.label,
      color: stage.color,
      probability: stage.probability,
      opportunities: stageOpportunities,
      count: stageOpportunities.length,
      totalValue,
      weightedValue,
    };
  });

  // Closed opportunities
  const closedOpportunities = opportunities.filter(
    opp => opp.stage === 'closed_won' || opp.stage === 'closed_lost'
  );

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get active opportunity
  const activeOpportunity = activeId
    ? opportunities.find(opp => opp.id === activeId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setIsDragging(false);

    if (!over) return;

    // Get the opportunity
    const opportunity = opportunities.find(opp => opp.id === active.id);
    if (!opportunity) return;

    // Determine the target stage
    let targetStage: string | null = null;

    // Check if dropped directly on a column id (the container)
    const targetColumn = columns.find(col => col.id === over.id);
    if (targetColumn) {
      targetStage = targetColumn.id;
    } else {
      // Dropped on another opportunity, find which column it's in
      const targetOpportunity = opportunities.find(opp => opp.id === over.id);
      if (targetOpportunity) {
        targetStage = targetOpportunity.stage;
      }
    }

    // If no stage change, don't do anything
    if (!targetStage || targetStage === opportunity.stage) return;

    // Get the probability for the new stage
    const stageConfig = columns.find(col => col.id === targetStage);
    if (!stageConfig) return;

    const opportunityId = active.id as string;
    const probability = stageConfig.probability;

    // Call the stage change handler
    await onStageChange(opportunityId, targetStage, probability);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Active Pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((column) => (
            <SortableContext
              key={column.id}
              items={column.opportunities.map(opp => opp.id)}
              strategy={verticalListSortingStrategy}
            >
              <Card
                className={`${
                  isDragging ? 'ring-2 ring-primary/20' : ''
                } transition-all`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>{column.title}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {column.count}
                    </span>
                  </CardTitle>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>Total: {formatCurrency(column.totalValue)}</div>
                    <div>Weighted: {formatCurrency(column.weightedValue)}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    <DroppableColumn id={column.id} isDragging={isDragging}>
                      {column.opportunities.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          No opportunities
                        </div>
                      ) : (
                        column.opportunities.map((opportunity) => (
                          <OpportunityCard
                            key={opportunity.id}
                            opportunity={opportunity}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onClick={onClick}
                            accountName={opportunity.accountId ? accountNames?.get(opportunity.accountId) : undefined}
                            contactName={opportunity.contactId ? contactNames?.get(opportunity.contactId) : undefined}
                          />
                        ))
                      )}
                    </DroppableColumn>
                  </ScrollArea>
                </CardContent>
              </Card>
            </SortableContext>
          ))}
        </div>

        {/* Closed Opportunities Section */}
        {closedOpportunities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Closed Opportunities ({closedOpportunities.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {closedOpportunities.map((opportunity) => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onClick={onClick}
                    accountName={opportunity.accountId ? accountNames?.get(opportunity.accountId) : undefined}
                    contactName={opportunity.contactId ? contactNames?.get(opportunity.contactId) : undefined}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <DragOverlay>
        {activeOpportunity ? (
          <div className="rotate-3 scale-105 opacity-90">
            <OpportunityCard
              opportunity={activeOpportunity}
              onEdit={onEdit}
              onDelete={onDelete}
              onClick={onClick}
              accountName={activeOpportunity.accountId ? accountNames?.get(activeOpportunity.accountId) : undefined}
              contactName={activeOpportunity.contactId ? contactNames?.get(activeOpportunity.contactId) : undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
