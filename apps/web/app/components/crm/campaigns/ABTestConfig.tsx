/**
 * ABTestConfig Component
 * Configuration interface for creating and editing A/B tests
 */

import { useState, useEffect, useMemo } from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Checkbox } from '~/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { VariantEditor, type ABVariant } from './VariantEditor';
import { TrafficSplitVisualizer } from './TrafficSplitVisualizer';
import { Plus, AlertCircle } from 'lucide-react';

interface ABTestConfigProps {
  campaignId: string;
  onSave: (config: ABTestConfiguration) => void;
  onCancel: () => void;
  initialConfig?: Partial<ABTestConfiguration>;
  isSubmitting?: boolean;
}

export interface ABTestConfiguration {
  name: string;
  evaluationMetric: 'open_rate' | 'click_rate' | 'conversion_rate';
  minSampleSize: number;
  controlGroupPct: number;
  autoPromoteWinner: boolean;
  autoPromotePct: number;
  variants: ABVariant[];
}

const EVALUATION_METRICS = [
  { value: 'open_rate', label: 'Open Rate' },
  { value: 'click_rate', label: 'Click Rate' },
  { value: 'conversion_rate', label: 'Conversion Rate' },
] as const;

const DEFAULT_VARIANT: ABVariant = {
  name: '',
  trafficPct: 50,
  subjectLine: '',
  emailContent: '',
};

export function ABTestConfig({
  campaignId: _campaignId,
  onSave,
  onCancel,
  initialConfig,
  isSubmitting = false,
}: ABTestConfigProps) {
  const [testName, setTestName] = useState(initialConfig?.name || '');
  const [evaluationMetric, setEvaluationMetric] = useState<ABTestConfiguration['evaluationMetric']>(
    initialConfig?.evaluationMetric || 'open_rate'
  );
  const [minSampleSize, setMinSampleSize] = useState(
    initialConfig?.minSampleSize || 100
  );
  const [controlGroupPct, setControlGroupPct] = useState(
    initialConfig?.controlGroupPct || 0
  );
  const [autoPromoteWinner, setAutoPromoteWinner] = useState(
    initialConfig?.autoPromoteWinner ?? false
  );
  const [autoPromotePct, setAutoPromotePct] = useState(
    initialConfig?.autoPromotePct || 90
  );
  const [variants, setVariants] = useState<ABVariant[]>(
    initialConfig?.variants || [
      { ...DEFAULT_VARIANT, name: 'Variant A', trafficPct: 50 },
      { ...DEFAULT_VARIANT, name: 'Variant B', trafficPct: 50 },
    ]
  );
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(
    new Set([0, 1])
  );
  const [errors, setErrors] = useState<string[]>([]);

  // Calculate total traffic allocation
  const totalTraffic = useMemo(() => {
    const variantTotal = variants.reduce((sum, v) => sum + v.trafficPct, 0);
    return variantTotal + controlGroupPct;
  }, [variants, controlGroupPct]);

  // Validate configuration
  const validate = (): string[] => {
    const validationErrors: string[] = [];

    if (!testName.trim()) {
      validationErrors.push('Test name is required');
    }

    if (variants.length < 2) {
      validationErrors.push('At least 2 variants are required');
    }

    if (variants.length > 4) {
      validationErrors.push('Maximum 4 variants allowed');
    }

    if (totalTraffic !== 100) {
      validationErrors.push('Traffic allocation must total 100%');
    }

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (!variant.subjectLine.trim()) {
        validationErrors.push(
          `Variant ${String.fromCharCode(65 + i)} requires a subject line`
        );
      }
      if (!variant.emailContent.trim()) {
        validationErrors.push(
          `Variant ${String.fromCharCode(65 + i)} requires email content`
        );
      }
    }

    return validationErrors;
  };

  // Auto-adjust traffic when control group changes
  useEffect(() => {
    if (controlGroupPct > 0 && variants.length > 0) {
      const remainingTraffic = 100 - controlGroupPct;
      const perVariant = Math.floor(remainingTraffic / variants.length);
      const remainder = remainingTraffic % variants.length;

      setVariants((prev) =>
        prev.map((v, i) => ({
          ...v,
          trafficPct: perVariant + (i === 0 ? remainder : 0),
        }))
      );
    }
  }, [controlGroupPct]);

  const handleAddVariant = () => {
    if (variants.length >= 4) return;

    const newVariantLetter = String.fromCharCode(65 + variants.length);
    const newTraffic = Math.floor(100 / (variants.length + 1));

    setVariants((prev) => {
      // Redistribute traffic evenly
      const updated = prev.map((v) => ({ ...v, trafficPct: newTraffic }));
      return [
        ...updated,
        {
          ...DEFAULT_VARIANT,
          name: `Variant ${newVariantLetter}`,
          trafficPct: newTraffic,
        },
      ];
    });

    setExpandedVariants((prev) => new Set([...prev, variants.length]));
  };

  const handleCloneVariant = (index: number) => {
    if (variants.length >= 4) return;

    const variantToClone = variants[index];
    if (!variantToClone) return;

    setVariants((prev) => [
      ...prev,
      {
        name: `${variantToClone.name} (Copy)`,
        trafficPct: variantToClone.trafficPct,
        subjectLine: variantToClone.subjectLine,
        emailContent: variantToClone.emailContent,
      },
    ]);

    setExpandedVariants((prev) => new Set([...prev, variants.length]));
  };

  const handleDeleteVariant = (index: number) => {
    if (variants.length <= 2) return;

    setVariants((prev) => prev.filter((_, i) => i !== index));
    setExpandedVariants((prev) => {
      const updated = new Set(prev);
      updated.delete(index);
      return updated;
    });
  };

  const handleUpdateVariant = (index: number, updates: Partial<ABVariant>) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...updates } : v))
    );
  };

  const toggleExpandVariant = (index: number) => {
    setExpandedVariants((prev) => {
      const updated = new Set(prev);
      if (updated.has(index)) {
        updated.delete(index);
      } else {
        updated.add(index);
      }
      return updated;
    });
  };

  const handleSubmit = () => {
    const validationErrors = validate();
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      return;
    }

    const config: ABTestConfiguration = {
      name: testName,
      evaluationMetric,
      minSampleSize,
      controlGroupPct,
      autoPromoteWinner,
      autoPromotePct,
      variants,
    };

    onSave(config);
  };

  const isValid = errors.length === 0 && totalTraffic === 100;

  return (
    <div className="space-y-6">
      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Name */}
          <div className="space-y-2">
            <Label htmlFor="test-name">Test Name</Label>
            <Input
              id="test-name"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g., Subject Line Test"
              disabled={isSubmitting}
            />
          </div>

          {/* Evaluation Metric */}
          <div className="space-y-2">
            <Label htmlFor="evaluation-metric">Evaluation Metric</Label>
            <Select
              value={evaluationMetric}
              onValueChange={(value) =>
                setEvaluationMetric(value as ABTestConfiguration['evaluationMetric'])
              }
              disabled={isSubmitting}
            >
              <SelectTrigger id="evaluation-metric">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVALUATION_METRICS.map((metric) => (
                  <SelectItem key={metric.value} value={metric.value}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Min Sample Size */}
          <div className="space-y-2">
            <Label htmlFor="min-sample">Minimum Sample Size (per variant)</Label>
            <Input
              id="min-sample"
              type="number"
              min="10"
              max="10000"
              value={minSampleSize}
              onChange={(e) => setMinSampleSize(Number(e.target.value))}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Minimum recipients per variant before evaluating winner
            </p>
          </div>

          {/* Control Group */}
          <div className="space-y-2">
            <Label htmlFor="control-group">Control Group (%)</Label>
            <Input
              id="control-group"
              type="number"
              min="0"
              max="20"
              value={controlGroupPct}
              onChange={(e) => setControlGroupPct(Number(e.target.value))}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Percentage of recipients who receive no email (optional, max 20%)
            </p>
          </div>

          {/* Auto-Promote Winner */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-promote"
                checked={autoPromoteWinner}
                onCheckedChange={(checked) =>
                  setAutoPromoteWinner(checked === true)
                }
                disabled={isSubmitting}
              />
              <Label htmlFor="auto-promote" className="font-normal">
                Automatically promote winner to remaining audience
              </Label>
            </div>

            {autoPromoteWinner && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="auto-promote-pct">
                  Promote to (% of remaining audience)
                </Label>
                <Input
                  id="auto-promote-pct"
                  type="number"
                  min="50"
                  max="100"
                  value={autoPromotePct}
                  onChange={(e) => setAutoPromotePct(Number(e.target.value))}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Traffic Split Visualizer */}
      <TrafficSplitVisualizer
        variants={variants.map((v) => ({ name: v.name, trafficPct: v.trafficPct }))}
        controlGroupPct={controlGroupPct}
      />

      {/* Variants */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Variants ({variants.length}/4)</h3>
          {variants.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddVariant}
              disabled={isSubmitting}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Variant
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {variants.map((variant, index) => (
            <VariantEditor
              key={index}
              variant={variant}
              variantIndex={index}
              totalVariants={variants.length}
              onUpdate={(updates) => handleUpdateVariant(index, updates)}
              onClone={() => handleCloneVariant(index)}
              onDelete={() => handleDeleteVariant(index)}
              readOnly={isSubmitting}
              isExpanded={expandedVariants.has(index)}
              onToggleExpand={() => toggleExpandVariant(index)}
            />
          ))}
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-2 text-destructive">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Please fix the following errors:</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Launch Test'}
        </Button>
      </div>
    </div>
  );
}
