/**
 * VariantEditor Component
 * Editor for individual A/B test variant configuration
 */

import { useState } from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Slider } from '~/components/ui/slider';
import { Copy, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '~/lib/utils';

export interface ABVariant {
  id?: string;
  name: string;
  trafficPct: number;
  subjectLine: string;
  emailContent: string;
}

interface VariantEditorProps {
  variant: ABVariant;
  variantIndex: number;
  totalVariants: number;
  onUpdate: (updates: Partial<ABVariant>) => void;
  onClone: () => void;
  onDelete: () => void;
  readOnly?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function VariantEditor({
  variant,
  variantIndex,
  totalVariants,
  onUpdate,
  onClone,
  onDelete,
  readOnly = false,
  isExpanded = true,
  onToggleExpand,
}: VariantEditorProps) {
  const variantLetter = String.fromCharCode(65 + variantIndex); // A, B, C, D

  return (
    <Card className={cn('relative', !isExpanded && 'bg-muted/50')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Variant {variantLetter}
            {variant.name && variant.name !== `Variant ${variantLetter}` && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({variant.name})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {!readOnly && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClone}
                  title="Clone variant"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {totalVariants > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    title="Delete variant"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {onToggleExpand && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Variant Name */}
          <div className="space-y-2">
            <Label htmlFor={`variant-${variantIndex}-name`}>
              Variant Name
            </Label>
            <Input
              id={`variant-${variantIndex}-name`}
              value={variant.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder={`Variant ${variantLetter}`}
              disabled={readOnly}
            />
          </div>

          {/* Traffic Allocation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`variant-${variantIndex}-traffic`}>
                Traffic Allocation
              </Label>
              <span className="text-sm font-semibold text-primary">
                {variant.trafficPct}%
              </span>
            </div>
            <Slider
              id={`variant-${variantIndex}-traffic`}
              value={[variant.trafficPct]}
              onValueChange={([value]) => onUpdate({ trafficPct: value })}
              min={0}
              max={100}
              step={1}
              disabled={readOnly}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Percentage of recipients who will receive this variant
            </p>
          </div>

          {/* Subject Line */}
          <div className="space-y-2">
            <Label htmlFor={`variant-${variantIndex}-subject`}>
              Subject Line
            </Label>
            <Input
              id={`variant-${variantIndex}-subject`}
              value={variant.subjectLine}
              onChange={(e) => onUpdate({ subjectLine: e.target.value })}
              placeholder="Enter email subject line"
              disabled={readOnly}
            />
          </div>

          {/* Email Content */}
          <div className="space-y-2">
            <Label htmlFor={`variant-${variantIndex}-content`}>
              Email Content
            </Label>
            <Textarea
              id={`variant-${variantIndex}-content`}
              value={variant.emailContent}
              onChange={(e) => onUpdate({ emailContent: e.target.value })}
              placeholder="Enter email content (supports HTML or Markdown)"
              rows={6}
              disabled={readOnly}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              HTML and Markdown supported. Use {'{{variable_name}}'} for personalization.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
