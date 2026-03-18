/**
 * Campaign Edit Wizard
 * Multi-step wizard for editing campaigns
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { WizardProgress } from '~/components/campaigns/WizardProgress';
import { CampaignBasicInfo } from '~/components/campaigns/CampaignBasicInfo';
import { AudienceBuilder } from '~/components/campaigns/AudienceBuilder';
import { MessageComposer } from '~/components/campaigns/MessageComposer';
import {
  useCampaign,
  useCampaignMessages,
  useUpdateCampaign,
  useCreateMessage,
  useCalculateAudience,
  usePreviewMessage,
} from '~/hooks/useCampaigns';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import type { FilterCondition } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

const WIZARD_STEPS = [
  { title: 'Basic Info', description: 'Campaign details' },
  { title: 'Audience', description: 'Select recipients' },
  { title: 'Message', description: 'Compose email' },
];

export default function EditCampaignPage() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Fetch existing campaign and messages
  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useCampaign(
    campaignId || '',
    workspaceId
  );
  const { data: messages = [] } = useCampaignMessages(campaignId || '', workspaceId);

  // Mutations
  const updateCampaign = useUpdateCampaign();
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
  });
  const [basicInfoErrors, setBasicInfoErrors] = useState<Record<string, string>>({});

  // Step 2: Audience
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [audienceSize, setAudienceSize] = useState<number | null>(null);

  // Step 3: Message
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [messagePreview, setMessagePreview] = useState<{ subject: string; body: string } | null>(null);
  const [existingMessageId, setExistingMessageId] = useState<string | null>(null);

  // Load campaign data into state
  useEffect(() => {
    if (campaign) {
      setBasicInfo({
        name: campaign.name,
        description: campaign.description || '',
        objective: campaign.objective,
        type: campaign.type,
        tags: campaign.tags?.join(', ') || '',
      });

      if (campaign.audienceDefinition?.conditions) {
        setFilters(campaign.audienceDefinition.conditions);
      }

      if (campaign.calculatedAudienceSize) {
        setAudienceSize(campaign.calculatedAudienceSize);
      }
    }
  }, [campaign]);

  // Load message data
  useEffect(() => {
    const emailMessage = messages.find((m) => m.channel === 'email');
    if (emailMessage) {
      setSubject(emailMessage.subject || '');
      setBody(emailMessage.body || '');
      setExistingMessageId(emailMessage.id);
    }
  }, [messages]);

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
    if (!campaignId) return;

    try {
      const result = await calculateAudience.mutateAsync({
        campaignId,
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
  };

  const handlePreviewMessage = async (contactId: string) => {
    if (!campaignId) return;

    try {
      const preview = await previewMessage.mutateAsync({
        campaignId,
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

    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSaveChanges = async () => {
    if (!validateBasicInfo()) {
      return;
    }

    if (!campaignId) return;

    try {
      // Update campaign
      await updateCampaign.mutateAsync({
        campaignId,
        workspaceId,
        data: {
          name: basicInfo.name,
          description: basicInfo.description || undefined,
          objective: basicInfo.objective as any,
          type: basicInfo.type as any,
          tags: basicInfo.tags ? basicInfo.tags.split(',').map((t) => t.trim()) : [],
          audienceDefinition: { conditions: filters },
          updatedById: userId,
        },
      });

      // Create message if it doesn't exist
      // Note: Message updates not supported yet - would need to delete and recreate
      if (subject.trim() && body.trim() && !existingMessageId) {
        await createMessage.mutateAsync({
          workspaceId,
          data: {
            campaignId,
            workspaceId,
            name: basicInfo.name,
            channel: 'email',
            subject,
            bodyText: body,
            sendFromName: 'NewLeads',
            sendFromEmail: 'noreply@newleads.co.za',
          },
        });
      }

      toast.success('Campaign Updated', { description: 'Your changes have been saved successfully' });

      navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-destructive">Error loading campaign: {String(campaignError)}</p>
        <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns`)} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Campaigns
        </Button>
      </div>
    );
  }

  // Only allow editing draft campaigns
  if (campaign.status !== 'draft') {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Only draft campaigns can be edited</p>
        <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`)} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Campaign
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Campaign</h1>
          <p className="text-muted-foreground">{campaign.name}</p>
        </div>
      </div>

      {/* Progress Indicator */}
      <WizardProgress currentStep={currentStep} steps={WIZARD_STEPS} />

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {WIZARD_STEPS[currentStep - 1].title}: {WIZARD_STEPS[currentStep - 1].description}
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
            <AudienceBuilder
              filters={filters}
              onFiltersChange={setFilters}
              audienceSize={audienceSize}
              isCalculating={calculateAudience.isPending}
              onCalculate={handleCalculateAudience}
            />
          )}

          {currentStep === 3 && (
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
          {currentStep < WIZARD_STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSaveChanges}
              disabled={updateCampaign.isPending || createMessage.isPending}
            >
              {updateCampaign.isPending || createMessage.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
