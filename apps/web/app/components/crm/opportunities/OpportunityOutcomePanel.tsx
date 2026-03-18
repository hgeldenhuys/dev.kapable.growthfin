/**
 * Opportunity Outcome Panel
 * Displays opportunity stage/outcome and provides actions for advancing and closing
 * US-CRM-STATE-MACHINE T-023
 */

import { useState } from 'react';
import type { CrmOpportunity } from '@agios/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  ChevronRight,
  Trophy,
  XCircle,
  DollarSign,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import {
  useAdvanceStage,
  useCloseOpportunity,
} from '~/hooks/useOpportunityOutcome';

interface OpportunityOutcomePanelProps {
  opportunity: CrmOpportunity;
  workspaceId: string;
  userId: string;
}

const STAGES = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed', label: 'Closed' },
];

const LOST_REASONS = [
  { value: 'price', label: 'Price Too High' },
  { value: 'competition', label: 'Lost to Competition' },
  { value: 'timing', label: 'Bad Timing' },
  { value: 'no_budget', label: 'No Budget' },
  { value: 'no_decision', label: 'No Decision' },
  { value: 'other', label: 'Other' },
];

export function OpportunityOutcomePanel({
  opportunity,
  workspaceId,
  userId,
}: OpportunityOutcomePanelProps) {
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [closeWonDialogOpen, setCloseWonDialogOpen] = useState(false);
  const [closeLostDialogOpen, setCloseLostDialogOpen] = useState(false);
  const [nextStage, setNextStage] = useState('');
  const [wonAmount, setWonAmount] = useState(
    opportunity.amount?.toString() || ''
  );
  const [lostReason, setLostReason] = useState('price');
  const [closeNotes, setCloseNotes] = useState('');

  const advanceStage = useAdvanceStage();
  const closeOpportunity = useCloseOpportunity();

  const outcomeLabels = {
    open: 'Open',
    won: 'Won',
    lost: 'Lost',
  };

  const outcomeVariants = {
    open: 'default',
    won: 'success',
    lost: 'secondary',
  } as const;

  // Get current stage index
  const currentStageIndex = STAGES.findIndex(
    (s) => s.value === opportunity.stage
  );

  // Get next stage
  const getNextStage = () => {
    if (currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1) {
      return STAGES[currentStageIndex + 1];
    }
    return null;
  };

  const nextStageOption = getNextStage();

  const handleAdvanceStage = async () => {
    if (!nextStage) return;

    await advanceStage.mutateAsync({
      opportunityId: opportunity.id,
      workspaceId,
      stage: nextStage,
      userId,
    });

    setNextStage('');
    setAdvanceDialogOpen(false);
  };

  const handleCloseWon = async () => {
    const amount = parseFloat(wonAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    await closeOpportunity.mutateAsync({
      opportunityId: opportunity.id,
      workspaceId,
      outcome: 'won',
      amount,
      notes: closeNotes || undefined,
      userId,
    });

    setWonAmount('');
    setCloseNotes('');
    setCloseWonDialogOpen(false);
  };

  const handleCloseLost = async () => {
    await closeOpportunity.mutateAsync({
      opportunityId: opportunity.id,
      workspaceId,
      outcome: 'lost',
      lostReason,
      notes: closeNotes || undefined,
      userId,
    });

    setLostReason('price');
    setCloseNotes('');
    setCloseLostDialogOpen(false);
  };

  const isOpen = opportunity.outcome === 'open';
  const isWon = opportunity.outcome === 'won';
  const isLost = opportunity.outcome === 'lost';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Opportunity Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Stage */}
          <div>
            <Label className="text-muted-foreground">Stage</Label>
            <div className="mt-2">
              <Badge variant="default" className="capitalize">
                {opportunity.stage.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {/* Pipeline Visualization */}
          <div>
            <Label className="text-muted-foreground">Pipeline Progress</Label>
            <div className="mt-2 flex items-center gap-1">
              {STAGES.map((stage, index) => {
                const isPast = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;

                return (
                  <div
                    key={stage.value}
                    className="flex items-center flex-1"
                    title={stage.label}
                  >
                    <div
                      className={`h-2 rounded-full flex-1 ${
                        isPast
                          ? 'bg-green-500'
                          : isCurrent
                            ? 'bg-blue-500'
                            : 'bg-gray-200'
                      }`}
                    />
                    {index < STAGES.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-gray-400 mx-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Prospecting</span>
              <span>Closed</span>
            </div>
          </div>

          {/* Outcome */}
          <div>
            <Label className="text-muted-foreground">Outcome</Label>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={outcomeVariants[opportunity.outcome || 'open']}>
                {outcomeLabels[opportunity.outcome || 'open']}
              </Badge>
            </div>
          </div>

          {/* Amount */}
          {opportunity.amount && (
            <div>
              <Label className="text-muted-foreground">Amount</Label>
              <div className="mt-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-semibold">
                  ${opportunity.amount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Close Date */}
          {opportunity.expectedCloseDate && (
            <div>
              <Label className="text-muted-foreground">Expected Close</Label>
              <div className="mt-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(opportunity.expectedCloseDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          {/* Won Info */}
          {isWon && opportunity.actualCloseDate && (
            <div className="border-t pt-4">
              <Label className="text-muted-foreground">Won!</Label>
              <div className="mt-2 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  Closed: {new Date(opportunity.actualCloseDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          {/* Lost Info */}
          {isLost && (
            <div className="border-t pt-4">
              <Label className="text-muted-foreground">Lost Reason</Label>
              <p className="mt-2 text-sm capitalize">
                {opportunity.lostReason?.replace('_', ' ')}
              </p>
              {opportunity.lostNotes && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {opportunity.lostNotes}
                </p>
              )}
              {opportunity.actualCloseDate && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Closed: {new Date(opportunity.actualCloseDate).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          {isOpen && (
            <div className="flex flex-col gap-2 pt-4 border-t">
              {nextStageOption && (
                <Button
                  onClick={() => {
                    setNextStage(nextStageOption.value);
                    setAdvanceDialogOpen(true);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Advance to {nextStageOption.label}
                </Button>
              )}
              <Button
                onClick={() => setCloseWonDialogOpen(true)}
                variant="default"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Trophy className="mr-2 h-4 w-4" />
                Close as Won
              </Button>
              <Button
                onClick={() => setCloseLostDialogOpen(true)}
                variant="secondary"
                className="w-full"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Close as Lost
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advance Stage Dialog */}
      <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance Opportunity Stage</DialogTitle>
            <DialogDescription>
              Move this opportunity to the next stage in the pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nextStage">Next Stage</Label>
              <Select value={nextStage} onValueChange={setNextStage}>
                <SelectTrigger id="nextStage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.filter(
                    (_, index) => index > currentStageIndex
                  ).map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdvanceDialogOpen(false)}
              disabled={advanceStage.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdvanceStage}
              disabled={advanceStage.isPending || !nextStage}
            >
              {advanceStage.isPending ? 'Advancing...' : 'Advance Stage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Won Dialog */}
      <Dialog open={closeWonDialogOpen} onOpenChange={setCloseWonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close as Won</DialogTitle>
            <DialogDescription>
              Congratulations! Record the final deal amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wonAmount">
                Final Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="wonAmount"
                type="number"
                value={wonAmount}
                onChange={(e) => setWonAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="wonNotes">Notes (Optional)</Label>
              <Textarea
                id="wonNotes"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Add any relevant notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseWonDialogOpen(false)}
              disabled={closeOpportunity.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCloseWon}
              disabled={
                closeOpportunity.isPending ||
                !wonAmount ||
                parseFloat(wonAmount) <= 0
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {closeOpportunity.isPending ? 'Closing...' : 'Close as Won'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Lost Dialog */}
      <Dialog open={closeLostDialogOpen} onOpenChange={setCloseLostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close as Lost</DialogTitle>
            <DialogDescription>
              Record why this opportunity was lost for future analysis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lostReason">Reason</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger id="lostReason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lostNotes">Notes (Optional)</Label>
              <Textarea
                id="lostNotes"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Add details about why this opportunity was lost..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseLostDialogOpen(false)}
              disabled={closeOpportunity.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCloseLost}
              disabled={closeOpportunity.isPending}
              variant="secondary"
            >
              {closeOpportunity.isPending ? 'Closing...' : 'Close as Lost'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
