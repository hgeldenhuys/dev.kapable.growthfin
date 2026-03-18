/**
 * FeedbackDialog Component
 * Phase M: AI Call Training/Feedback
 *
 * Modal dialog for rating AI calls and providing feedback.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiCallId: string;
  workspaceId: string;
  existingFeedback?: {
    rating: number | null;
    feedbackText: string | null;
    feedbackTags: string[];
  };
}

// Feedback tags with labels
const FEEDBACK_TAGS = [
  { value: 'good_opening', label: 'Good Opening', positive: true },
  { value: 'poor_opening', label: 'Poor Opening', positive: false },
  { value: 'clear_objective', label: 'Clear Objective', positive: true },
  { value: 'unclear_objective', label: 'Unclear Objective', positive: false },
  { value: 'handled_objections', label: 'Handled Objections', positive: true },
  { value: 'missed_objections', label: 'Missed Objections', positive: false },
  { value: 'good_closing', label: 'Good Closing', positive: true },
  { value: 'poor_closing', label: 'Poor Closing', positive: false },
  { value: 'got_meeting', label: 'Got Meeting', positive: true },
  { value: 'missed_opportunity', label: 'Missed Opportunity', positive: false },
  { value: 'natural_conversation', label: 'Natural Conversation', positive: true },
  { value: 'robotic_sounding', label: 'Robotic Sounding', positive: false },
];

export function FeedbackDialog({
  open,
  onOpenChange,
  aiCallId,
  workspaceId,
  existingFeedback,
}: FeedbackDialogProps) {
  const queryClient = useQueryClient();

  const [rating, setRating] = useState<number>(existingFeedback?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState(existingFeedback?.feedbackText || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(existingFeedback?.feedbackTags || []);

  const submitFeedback = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/crm/ai-calls/${aiCallId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          rating: rating || null,
          feedbackText: feedbackText || null,
          feedbackTags: selectedTags,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success(data.updated ? 'Feedback Updated' : 'Feedback Submitted', { description: 'Thank you for your feedback!' });
      queryClient.invalidateQueries({ queryKey: ['ai-calls', aiCallId] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to submit feedback' });
    },
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Rate This Call</DialogTitle>
          <DialogDescription>
            Your feedback helps improve AI call quality
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">How did this call go?</label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="focus:outline-none transition-transform hover:scale-110"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(0)}
                >
                  <Star
                    className={`h-8 w-8 ${
                      value <= displayRating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {displayRating === 0 && 'Click to rate'}
              {displayRating === 1 && 'Poor'}
              {displayRating === 2 && 'Below Average'}
              {displayRating === 3 && 'Average'}
              {displayRating === 4 && 'Good'}
              {displayRating === 5 && 'Excellent'}
            </p>
          </div>

          {/* Feedback Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_TAGS.map((tag) => (
                <Badge
                  key={tag.value}
                  variant={selectedTags.includes(tag.value) ? 'default' : 'outline'}
                  className={`cursor-pointer transition-all ${
                    selectedTags.includes(tag.value)
                      ? tag.positive
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleTag(tag.value)}
                >
                  {tag.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Additional Feedback */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Feedback</label>
            <Textarea
              placeholder="What went well? What could be improved?"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => submitFeedback.mutate()}
            disabled={submitFeedback.isPending}
          >
            {submitFeedback.isPending ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
