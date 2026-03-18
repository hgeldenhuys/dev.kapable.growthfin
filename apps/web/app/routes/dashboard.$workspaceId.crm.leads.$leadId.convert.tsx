/**
 * Lead Conversion Wizard
 * Multi-step wizard for converting leads to contacts/accounts/opportunities
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { useState } from 'react';
import { useNavigate, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { ArrowLeft, ArrowRight, Loader2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Checkbox } from '~/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useConvertLead } from '~/hooks/useLeads';
import { toast } from 'sonner';
import type { ConvertLeadRequest } from '~/types/crm';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for lead convert page
 * Fetches lead from database for server-side rendering
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { db, crmLeads, eq, and } = await import('~/lib/db.server');

  const { workspaceId, leadId } = params;

  if (!workspaceId || !leadId) {
    throw new Response('Workspace ID and Lead ID are required', { status: 400 });
  }

  const [lead] = await db
    .select()
    .from(crmLeads)
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.workspaceId, workspaceId)))
    .limit(1);

  if (!lead) {
    throw new Response('Lead not found', { status: 404 });
  }

  return { lead };
}
export default function LeadConvertPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Get data from loader
  const { lead } = useLoaderData<typeof loader>();
  const leadId = lead.id;

  const convertLead = useConvertLead();
  const [currentStep, setCurrentStep] = useState<string>('contact');
  const [formData, setFormData] = useState({
    createContact: true,
    createAccount: false,
    createOpportunity: false,
    accountName: '',
    accountIndustry: '',
    accountWebsite: '',
    opportunityName: '',
    opportunityAmount: '',
    opportunityExpectedCloseDate: '',
  });
  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads/${leadId}`);
  };
  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleConvert = async () => {
    try {
      const convertData: ConvertLeadRequest = {
        workspaceId,
        userId,
        createContact: formData.createContact,
        createAccount: formData.createAccount,
        createOpportunity: formData.createOpportunity,
      };
      if (formData.createAccount) {
        convertData.accountData = {
          name: formData.accountName || lead.company || `${lead.firstName} ${lead.lastName}`,
          industry: formData.accountIndustry || undefined,
          website: formData.accountWebsite || undefined,
        };
      }
      if (formData.createOpportunity) {
        convertData.opportunityData = {
          name: formData.opportunityName || `${`${lead.firstName} ${lead.lastName}`} - Opportunity`,
          amount: parseFloat(formData.opportunityAmount) || 0,
          expectedCloseDate: formData.opportunityExpectedCloseDate || undefined,
          stage: 'prospecting',
        };
      }

      const result = await convertLead.mutateAsync({
        leadId,
        data: convertData,
      });
      toast.success('Lead converted successfully', { description: 'The lead has been converted to a contact.' });

      // Navigate to the new contact
      if (result.contactId) {
        navigate(`/dashboard/${workspaceId}/crm/contacts/${result.contactId}`);
      } else {
        navigate(`/dashboard/${workspaceId}/crm/leads`);
      }
    } catch (error) {
      toast.error('Conversion failed', { description: String(error) });
    }
  };

  // Loading and error states are handled by React Router's loader pattern
  // If we reach this point, lead is guaranteed to exist

  const canProceed = formData.createContact;
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Convert Lead</h1>
          <p className="text-muted-foreground">
            Convert {`${lead.firstName} ${lead.lastName}`} to Contact, Account, and Opportunity
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  formData.createContact
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {formData.createContact ? <Check className="h-4 w-4" /> : '1'}
              </div>
              <span className="text-sm font-medium">Contact</span>
            </div>
            <div className="flex-1 h-px bg-border mx-4" />
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  formData.createAccount
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {formData.createAccount ? <Check className="h-4 w-4" /> : '2'}
              </div>
              <span className="text-sm font-medium">Account</span>
            </div>
            <div className="flex-1 h-px bg-border mx-4" />
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  formData.createOpportunity
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {formData.createOpportunity ? <Check className="h-4 w-4" /> : '3'}
              </div>
              <span className="text-sm font-medium">Opportunity</span>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Conversion Form */}
      <Tabs value={currentStep} onValueChange={setCurrentStep}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="opportunity">Opportunity</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
        </TabsList>
        {/* Contact Step */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Create Contact</CardTitle>
              <CardDescription>
                A contact will be created from this lead with the following information:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createContact"
                  checked={formData.createContact}
                  onCheckedChange={(checked) =>
                    handleChange('createContact', checked === true)
                  }
                />
                <Label htmlFor="createContact">Create Contact (Required)</Label>
              </div>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{`${lead.firstName} ${lead.lastName}`}</p>
                </div>
                {lead.email && (
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p>{lead.email}</p>
                  </div>
                )}
                {lead.phone && (
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p>{lead.phone}</p>
                  </div>
                )}
                {lead.company && (
                  <div>
                    <Label className="text-muted-foreground">Company</Label>
                    <p>{lead.company}</p>
                  </div>
                )}
                {lead.title && (
                  <div>
                    <Label className="text-muted-foreground">Title</Label>
                    <p>{lead.title}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button onClick={() => setCurrentStep('account')}>
                  Next: Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Account Step */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Create Account (Optional)</CardTitle>
              <CardDescription>
                Optionally create a company account for this contact
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createAccount"
                  checked={formData.createAccount}
                  onCheckedChange={(checked) =>
                    handleChange('createAccount', checked === true)
                  }
                />
                <Label htmlFor="createAccount">Create Account</Label>
              </div>
              {formData.createAccount && (
                <div className="space-y-4 border-l-2 border-primary pl-4">
                  <div>
                    <Label htmlFor="accountName">Account Name *</Label>
                    <Input
                      id="accountName"
                      value={formData.accountName}
                      onChange={(e) => handleChange('accountName', e.target.value)}
                      placeholder={lead.company || `${lead.firstName} ${lead.lastName}`}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Defaults to: {lead.company || `${lead.firstName} ${lead.lastName}`}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="accountIndustry">Industry</Label>
                    <Input
                      id="accountIndustry"
                      value={formData.accountIndustry}
                      onChange={(e) => handleChange('accountIndustry', e.target.value)}
                      placeholder="e.g., Technology, Healthcare, Finance"
                    />
                  </div>
                  <div>
                    <Label htmlFor="accountWebsite">Website</Label>
                    <Input
                      id="accountWebsite"
                      type="url"
                      value={formData.accountWebsite}
                      onChange={(e) => handleChange('accountWebsite', e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('contact')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => setCurrentStep('opportunity')}>
                  Next: Opportunity
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Opportunity Step */}
        <TabsContent value="opportunity">
          <Card>
            <CardHeader>
              <CardTitle>Create Opportunity (Optional)</CardTitle>
              <CardDescription>
                Optionally create a sales opportunity for this lead
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createOpportunity"
                  checked={formData.createOpportunity}
                  onCheckedChange={(checked) =>
                    handleChange('createOpportunity', checked === true)
                  }
                />
                <Label htmlFor="createOpportunity">Create Opportunity</Label>
              </div>
              {formData.createOpportunity && (
                <div className="space-y-4 border-l-2 border-primary pl-4">
                  <div>
                    <Label htmlFor="opportunityName">Opportunity Name *</Label>
                    <Input
                      id="opportunityName"
                      value={formData.opportunityName}
                      onChange={(e) => handleChange('opportunityName', e.target.value)}
                      placeholder={`${`${lead.firstName} ${lead.lastName}`} - Opportunity`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="opportunityAmount">Amount ($)</Label>
                    <Input
                      id="opportunityAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.opportunityAmount}
                      onChange={(e) => handleChange('opportunityAmount', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="opportunityExpectedCloseDate">
                      Expected Close Date
                    </Label>
                    <Input
                      id="opportunityExpectedCloseDate"
                      type="date"
                      value={formData.opportunityExpectedCloseDate}
                      onChange={(e) =>
                        handleChange('opportunityExpectedCloseDate', e.target.value)
                      }
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('account')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => setCurrentStep('review')}>
                  Next: Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Review Step */}
        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle>Review & Confirm</CardTitle>
              <CardDescription>
                Review your selections before converting the lead
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="font-medium">
                    Contact will be created for {lead.firstName} {lead.lastName}
                  </span>
                </div>
                {formData.createAccount && (
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium">
                      Account will be created:{' '}
                      {formData.accountName || lead.company || `${lead.firstName} ${lead.lastName}`}
                    </span>
                  </div>
                )}
                {formData.createOpportunity && (
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium">
                      Opportunity will be created:{' '}
                      {formData.opportunityName || `${`${lead.firstName} ${lead.lastName}`} - Opportunity`}
                      {formData.opportunityAmount &&
                        ` ($${parseFloat(formData.opportunityAmount).toLocaleString()})`}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  This action will mark the lead as "Converted" and cannot be undone.
                </p>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('opportunity')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleConvert}
                  disabled={!canProceed || convertLead.isPending}
                >
                  {convertLead.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Convert Lead
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
