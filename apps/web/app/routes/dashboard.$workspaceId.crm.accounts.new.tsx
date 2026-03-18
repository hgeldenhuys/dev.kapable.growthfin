/**
 * New Account Page
 * Fullscreen form for creating new accounts
 */

import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { AccountForm } from '~/components/crm/AccountForm';
import { useCreateAccount } from '~/hooks/useAccounts';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import type { CreateAccountRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function NewAccountPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  const createAccount = useCreateAccount();

  const handleSubmit = async (data: Partial<CreateAccountRequest>) => {
    try {
      const result = await createAccount.mutateAsync(data as CreateAccountRequest);

      toast.success('Account created', { description: `${data.name} has been created successfully.` });

      // Navigate to the new account detail page
      navigate(`/dashboard/${workspaceId}/crm/accounts/${result.id}`);
    } catch (error) {
      toast.error('Failed to create account', { description: String(error) });
    }
  };

  const handleCancel = () => {
    navigate(`/dashboard/${workspaceId}/crm/accounts`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create New Account</h1>
          <p className="text-muted-foreground">
            Add a new company or organization to your CRM
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Enter the details for the new account. Required fields are marked with an asterisk (*).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountForm
            account={null}
            onSubmit={handleSubmit}
            workspaceId={workspaceId}
            userId={userId}
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="account-form"
          disabled={createAccount.isPending}
        >
          {createAccount.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Account'
          )}
        </Button>
      </div>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
