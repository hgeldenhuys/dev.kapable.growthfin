/**
 * Campaign Creation Wizard
 * Multi-step wizard for creating campaigns
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { WizardProgress } from '~/components/campaigns/WizardProgress';
import { CampaignBasicInfo } from '~/components/campaigns/CampaignBasicInfo';
import { AudienceBuilder } from '~/components/campaigns/AudienceBuilder';
import { ListSelector } from '~/components/campaigns/ListSelector';
import { MessageComposer } from '~/components/campaigns/MessageComposer';
import { SMSCampaignComposer } from '~/components/campaigns/SMSCampaignComposer';
import {
  useCreateCampaign,
  useCreateMessage,
  useCalculateAudience,
  usePreviewMessage,
} from '~/hooks/useCampaigns';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import type { FilterCondition } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

// Wizard steps - Step 3 description is dynamic based on channel
const getWizardSteps = (channel: 'email' | 'sms') => [
  { title: 'Basic Info', description: 'Campaign details' },
  { title: 'Audience', description: 'Select recipients' },
  { title: 'Message', description: channel === 'sms' ? 'Compose SMS' : 'Compose email' },
];

export default function NewCampaignPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Mutations
  const createCampaign = useCreateCampaign();
  const createMessage = useCreateMessage();
  const calculateAudience = useCalculateAudience();
  const previewMessage = usePreviewMessage();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Basic Info
  const [basicInfo, setBasicInfo] = useState({
    name: '',
    description: '',
    objective: '',
    type: 'one_time',
    tags: '',
    channel: 'email' as 'email' | 'sms',
  });

  // Get dynamic wizard steps based on selected channel
  const wizardSteps = getWizardSteps(basicInfo.channel);
  const [basicInfoErrors, setBasicInfoErrors] = useState<Record<string, string>>({});

  // Step 2: Audience
  const [audienceMode, setAudienceMode] = useState<'list' | 'filters'>('list');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [audienceSize, setAudienceSize] = useState<number | null>(null);
  const [tempCampaignId, setTempCampaignId] = useState<string | null>(null);

  // Step 3: Message
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [messagePreview, setMessagePreview] = useState<{ subject: string; body: string } | null>(null);

  // Handlers
  const handleBasicInfoChange = (field: string, value: string) => {
    setBasicInfo((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (basicInfoErrors[field]) {
      setBasicInfoErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateBasicInfo = (): boolean => {
    const errors: Record<string, string> = {};
    if (!basicInfo.name.trim()) {
      errors.name = 'Campaign name is required';
    }
    if (!basicInfo.objective) {
      errors.objective = 'Objective is required';
    }
    if (!basicInfo.type) {
      errors.type = 'Campaign type is required';
    }
    setBasicInfoErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCalculateAudience = async () => {
    if (!tempCampaignId) {
      // Create temporary campaign first
      try {
        const campaign = await createCampaign.mutateAsync({
          workspaceId,
          name: basicInfo.name || 'Untitled Campaign',
          description: basicInfo.description || undefined,
          objective: basicInfo.objective as any,
          type: basicInfo.type as any,
          channels: [basicInfo.channel],
          tags: basicInfo.tags ? basicInfo.tags.split(',').map((t) => t.trim()) : [],
          audienceDefinition: { conditions: filters },
          listId: selectedListId || undefined,
          createdBy: userId,
          updatedBy: userId,
        });
        setTempCampaignId(campaign.id);

        // Now calculate audience
        const result = await calculateAudience.mutateAsync({
          campaignId: campaign.id,
          workspaceId,
          data: {
            workspaceId,
            userId,
            audienceDefinition: { conditions: filters },
          },
        });
        setAudienceSize(result.count);
      } catch (error) {
        toast.error('Error', { description: String(error) });
      }
    } else {
      // Campaign already exists, just calculate
      try {
        const result = await calculateAudience.mutateAsync({
          campaignId: tempCampaignId,
          workspaceId,
          data: {
            workspaceId,
            userId,
            audienceDefinition: { conditions: filters },
          },
        });
        setAudienceSize(result.count);
      } catch (error) {
        toast.error('Error', { description: String(error) });
      }
    }
  };

  const handlePreviewMessage = async (contactId: string) => {
    if (!tempCampaignId) {
      toast.error('Error', { description: 'Please complete the previous steps first' });
      return;
    }

    try {
      const preview = await previewMessage.mutateAsync({
        campaignId: tempCampaignId,
        contactId,
        workspaceId,
      });
      setMessagePreview(preview);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!validateBasicInfo()) {
        return;
      }
    }

    if (currentStep === 2) {
      if (audienceSize === null) {
        toast.error('Calculate Audience', { description: 'Please calculate the audience size before proceeding' });
        return;
      }
    }

    setCurrentStep((prev) => Math.min(prev + 1, wizardSteps.length));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSaveDraft = async () => {
    if (!validateBasicInfo()) {
      return;
    }

    try {
      let campaignId = tempCampaignId;

      // Create or update campaign
      if (!campaignId) {
        const campaign = await createCampaign.mutateAsync({
          workspaceId,
          name: basicInfo.name,
          description: basicInfo.description || undefined,
          objective: basicInfo.objective as any,
          type: basicInfo.type as any,
          channels: [basicInfo.channel],
          tags: basicInfo.tags ? basicInfo.tags.split(',').map((t) => t.trim()) : [],
          audienceDefinition: { conditions: filters },
          listId: selectedListId || undefined,
          createdBy: userId,
          updatedBy: userId,
        });
        campaignId = campaign.id;
        setTempCampaignId(campaignId);
      }

      toast.success('Draft Saved', { description: 'Your campaign has been saved as a draft' });

      navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCreateCampaign = async () => {
    // Validate based on channel type
    if (basicInfo.channel === 'email') {
      if (!subject.trim() || !body.trim()) {
        toast.error('Missing Message', { description: 'Please provide both subject and body for the email' });
        return;
      }
    } else {
      // SMS doesn't need subject
      if (!body.trim()) {
        toast.error('Missing Message', { description: 'Please provide a message body for the SMS' });
        return;
      }
    }

    try {
      let campaignId = tempCampaignId;

      // Create campaign if not already created
      if (!campaignId) {
        const campaign = await createCampaign.mutateAsync({
          workspaceId,
          name: basicInfo.name,
          description: basicInfo.description || undefined,
          objective: basicInfo.objective as any,
          type: basicInfo.type as any,
          channels: [basicInfo.channel],
          tags: basicInfo.tags ? basicInfo.tags.split(',').map((t) => t.trim()) : [],
          audienceDefinition: { conditions: filters },
          listId: selectedListId || undefined,
          createdBy: userId,
          updatedBy: userId,
        });
        campaignId = campaign.id;
      }

      // Create message
      await createMessage.mutateAsync({
        workspaceId,
        data: {
          campaignId,
          workspaceId,
          name: basicInfo.name,
          channel: basicInfo.channel,
          subject: basicInfo.channel === 'email' ? subject : undefined,
          bodyText: body,
          sendFromName: basicInfo.channel === 'email' ? 'NewLeads' : undefined,
          sendFromEmail: basicInfo.channel === 'email' ? 'noreply@newleads.co.za' : undefined,
        },
      });

      toast.success('Campaign Created', { description: 'Your campaign has been created successfully' });

      navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Campaign</h1>
          <p className="text-muted-foreground">Follow the steps to create your campaign</p>
        </div>
      </div>

      {/* Progress Indicator */}
      <WizardProgress currentStep={currentStep} steps={wizardSteps} />

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {wizardSteps[currentStep - 1].title}: {wizardSteps[currentStep - 1].description}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && (
            <CampaignBasicInfo
              data={basicInfo}
              onChange={handleBasicInfoChange}
              errors={basicInfoErrors}
            />
          )}

          {currentStep === 2 && (
            <Tabs value={audienceMode} onValueChange={(value) => setAudienceMode(value as 'list' | 'filters')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list" data-uid="tab-use-list">Use List</TabsTrigger>
                <TabsTrigger value="filters" data-uid="tab-build-filters">Build Filters</TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="space-y-4 mt-4">
                <ListSelector
                  workspaceId={workspaceId}
                  selectedListId={selectedListId}
                  onListSelect={setSelectedListId}
                  onAudienceChange={setAudienceSize}
                />
              </TabsContent>

              <TabsContent value="filters" className="space-y-4 mt-4">
                <AudienceBuilder
                  filters={filters}
                  onFiltersChange={setFilters}
                  audienceSize={audienceSize}
                  isCalculating={calculateAudience.isPending}
                  onCalculate={handleCalculateAudience}
                />
              </TabsContent>
            </Tabs>
          )}

          {currentStep === 3 && basicInfo.channel === 'email' && (
            <MessageComposer
              workspaceId={workspaceId}
              subject={subject}
              body={body}
              onSubjectChange={setSubject}
              onBodyChange={setBody}
              previewData={messagePreview}
              isPreviewLoading={previewMessage.isPending}
              onPreview={handlePreviewMessage}
            />
          )}

          {currentStep === 3 && basicInfo.channel === 'sms' && (
            <SMSCampaignComposer
              workspaceId={workspaceId}
              body={body}
              onBodyChange={setBody}
              previewData={messagePreview}
              isPreviewLoading={previewMessage.isPending}
              onPreview={handlePreviewMessage}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <div>
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={createCampaign.isPending}>
            {createCampaign.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save as Draft
              </>
            )}
          </Button>
          {currentStep < wizardSteps.length ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleCreateCampaign}
              disabled={createCampaign.isPending || createMessage.isPending}
            >
              {createCampaign.isPending || createMessage.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Campaign'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
