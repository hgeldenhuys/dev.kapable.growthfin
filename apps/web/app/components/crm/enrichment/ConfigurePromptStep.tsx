/**
 * ConfigurePromptStep Component
 * Step 2: Configure enrichment job settings
 */

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
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
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Info, DollarSign, AlertCircle } from 'lucide-react';
import { AI_MODELS, DEFAULT_SCORING_PROMPT } from '~/types/crm';
import type { ContactList } from '~/types/crm';

interface ConfigurePromptStepProps {
  jobName: string;
  model: string;
  prompt: string;
  budgetLimit: number;
  contactCount: number;
  selectedList?: ContactList | null;
  onJobNameChange: (name: string) => void;
  onModelChange: (model: string) => void;
  onPromptChange: (prompt: string) => void;
  onBudgetLimitChange: (budget: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ConfigurePromptStep({
  jobName,
  model,
  prompt,
  budgetLimit,
  contactCount,
  selectedList,
  onJobNameChange,
  onModelChange,
  onPromptChange,
  onBudgetLimitChange,
  onBack,
  onNext,
}: ConfigurePromptStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedModel = AI_MODELS.find((m) => m.value === model);
  const estimatedCostPerContact = selectedModel ? selectedModel.cost / 1000 : 0.15 / 1000;
  const estimatedTotalCost = contactCount * estimatedCostPerContact;

  // Budget status calculations
  const listBudgetLimit = selectedList?.budgetLimit ? parseFloat(selectedList.budgetLimit) : null;
  const listBudgetSpent = selectedList?.totalSpent ? parseFloat(selectedList.totalSpent) : 0;
  const listBudgetRemaining = listBudgetLimit ? listBudgetLimit - listBudgetSpent : null;
  const estimateExceedsJobBudget = estimatedTotalCost > budgetLimit;
  const estimateExceedsListBudget = listBudgetRemaining && estimatedTotalCost > listBudgetRemaining;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!jobName.trim()) {
      newErrors.jobName = 'Job name is required';
    }

    if (!prompt.trim()) {
      newErrors.prompt = 'Prompt is required';
    }

    if (budgetLimit <= 0) {
      newErrors.budgetLimit = 'Budget limit must be greater than 0';
    }

    if (estimatedTotalCost > budgetLimit) {
      newErrors.budgetLimit = `Estimated cost ($${estimatedTotalCost.toFixed(2)}) exceeds budget limit`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-2">Step 2</p>
        <h2 className="text-2xl font-bold">Configure Enrichment Job</h2>
        <p className="text-muted-foreground mt-1">
          Set up the AI model, prompt, and budget for your enrichment job
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Job Settings</CardTitle>
            <CardDescription>Basic configuration for your enrichment job</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jobName">
                Job Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="jobName"
                placeholder="e.g., Q1 2025 Lead Scoring"
                value={jobName}
                onChange={(e) => onJobNameChange(e.target.value)}
              />
              {errors.jobName && (
                <p className="text-sm text-destructive">{errors.jobName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select value={model} onValueChange={onModelChange}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ${m.cost}/1k tokens
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the AI model to use for enrichment. Faster models are cheaper but may be
                less accurate.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">
                Budget Limit (USD) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetLimit}
                  onChange={(e) => onBudgetLimitChange(parseFloat(e.target.value) || 0)}
                  className="pl-9"
                />
              </div>
              {errors.budgetLimit && (
                <p className="text-sm text-destructive">{errors.budgetLimit}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Prompt</CardTitle>
            <CardDescription>
              Customize the instructions for the AI model. Use the default template or write your
              own.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">
                Prompt <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="prompt"
                placeholder={DEFAULT_SCORING_PROMPT}
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              {errors.prompt && <p className="text-sm text-destructive">{errors.prompt}</p>}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPromptChange(DEFAULT_SCORING_PROMPT)}
              >
                Use Default Template
              </Button>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                The prompt should instruct the AI to return JSON with "score", "classification",
                and "reasoning" fields.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Estimation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Contacts to process</span>
                <span className="font-medium">{contactCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cost per contact</span>
                <span className="font-medium">${estimatedCostPerContact.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Job budget limit</span>
                <span className="font-medium">${budgetLimit.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold">Estimated total cost</span>
                <span
                  className={`text-lg font-bold ${estimateExceedsJobBudget ? 'text-destructive' : 'text-green-600'}`}
                >
                  ${estimatedTotalCost.toFixed(2)}
                </span>
              </div>
            </div>

            {listBudgetLimit && (
              <div className="border-t pt-3 space-y-3">
                <div className="text-sm font-semibold">List Budget Status</div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">List budget limit</span>
                  <span className="font-medium">${listBudgetLimit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Already spent</span>
                  <span className="font-medium">${listBudgetSpent.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Remaining budget</span>
                  <span className={`font-medium ${listBudgetRemaining && listBudgetRemaining < 0 ? 'text-destructive' : 'text-green-600'}`}>
                    ${listBudgetRemaining ? listBudgetRemaining.toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
            )}

            {estimateExceedsJobBudget && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Budget Exceeded</AlertTitle>
                <AlertDescription>
                  Estimated cost (${estimatedTotalCost.toFixed(2)}) exceeds job budget limit (${budgetLimit.toFixed(2)}). Please increase the job budget or use fewer contacts.
                </AlertDescription>
              </Alert>
            )}

            {estimateExceedsListBudget && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>List Budget Exceeded</AlertTitle>
                <AlertDescription>
                  Estimated cost (${estimatedTotalCost.toFixed(2)}) exceeds remaining list budget (${listBudgetRemaining ? listBudgetRemaining.toFixed(2) : '0.00'}). This enrichment may be interrupted if budget is exceeded.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} size="lg">
          Next: Test Sample
        </Button>
      </div>
    </div>
  );
}
