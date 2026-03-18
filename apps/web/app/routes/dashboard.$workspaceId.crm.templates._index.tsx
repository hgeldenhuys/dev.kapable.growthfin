/**
 * Unified Templates Page
 * Consolidates Email Templates, SMS Templates, and Call Scripts into one tabbed view
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, MessageCircle, Phone, Loader2 } from 'lucide-react';
import { EmptyState } from '~/components/crm/EmptyState';
import { ContextualHelp } from '~/components/crm/ContextualHelp';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';
import { JsonExportButton } from '~/components/crm/JsonExportButton';
import { JsonImportButton } from '~/components/crm/JsonImportButton';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('email');

  // Fetch email templates
  const { data: emailTemplates = [], isLoading: emailLoading } = useQuery({
    queryKey: ['crm', 'email-templates', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/crm/email-templates?workspaceId=${workspaceId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!workspaceId,
  });

  // Fetch SMS templates
  const { data: smsTemplates = [], isLoading: smsLoading } = useQuery({
    queryKey: ['crm', 'sms-templates', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/crm/sms-templates?workspaceId=${workspaceId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!workspaceId,
  });

  // Fetch call scripts
  const { data: callScripts = [], isLoading: scriptsLoading } = useQuery({
    queryKey: ['crm', 'ai-call-scripts', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/crm/ai-call-scripts?workspaceId=${workspaceId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!workspaceId,
  });

  const getNewPath = () => {
    switch (activeTab) {
      case 'email': return `/dashboard/${workspaceId}/crm/email-templates/new`;
      case 'sms': return `/dashboard/${workspaceId}/crm/sms-templates/new`;
      case 'scripts': return `/dashboard/${workspaceId}/crm/ai-call-scripts/new`;
      default: return '#';
    }
  };

  const getNewLabel = () => {
    switch (activeTab) {
      case 'email': return 'New Email Template';
      case 'sms': return 'New SMS Template';
      case 'scripts': return 'New Call Script';
      default: return 'New Template';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">Templates <ContextualHelp topic="templates" workspaceId={workspaceId} /></h1>
          <p className="text-muted-foreground">
            Manage your email, SMS, and call script templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab !== 'scripts' && (
            <>
              <JsonExportButton
                entityType={activeTab === 'email' ? 'email-templates' : 'sms-templates'}
                data={activeTab === 'email' ? emailTemplates : smsTemplates}
                variant="outline"
                size="sm"
              />
              <JsonImportButton
                entityType={activeTab === 'email' ? 'email-templates' : 'sms-templates'}
                workspaceId={workspaceId}
                userId={userId}
                onImportComplete={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['crm', activeTab === 'email' ? 'email-templates' : 'sms-templates'],
                  })
                }
                variant="outline"
                size="sm"
              />
            </>
          )}
          <Button asChild>
            <Link to={getNewPath()}>
              <Plus className="mr-2 h-4 w-4" />
              {getNewLabel()}
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Templates</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(emailTemplates) ? emailTemplates.length : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMS Templates</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(smsTemplates) ? smsTemplates.length : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Call Scripts</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(callScripts) ? callScripts.length : 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="scripts" className="gap-2">
            <Phone className="h-4 w-4" />
            Call Scripts
          </TabsTrigger>
        </TabsList>

        {/* Email Templates Tab */}
        <TabsContent value="email" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {emailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !Array.isArray(emailTemplates) || emailTemplates.length === 0 ? (
                <EmptyState
                  icon={<Mail />}
                  title="No email templates yet"
                  description="Create reusable message templates with merge fields like {{firstName}} for your email campaigns."
                  workspaceId={workspaceId}
                  guideStep={7}
                  guideLabel="Learn how to create templates"
                  action={
                    <Button asChild>
                      <Link to={`/dashboard/${workspaceId}/crm/email-templates/new`}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Email Template
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailTemplates.map((template: any) => (
                      <TableRow
                        key={template.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/dashboard/${workspaceId}/crm/email-templates/${template.id}`)}
                      >
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{template.subject || '\u2014'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(template.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Templates Tab */}
        <TabsContent value="sms" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {smsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !Array.isArray(smsTemplates) || smsTemplates.length === 0 ? (
                <EmptyState
                  icon={<MessageCircle />}
                  title="No SMS templates yet"
                  description="Create reusable message templates for your SMS campaigns."
                  workspaceId={workspaceId}
                  guideStep={7}
                  guideLabel="Learn how to create templates"
                  action={
                    <Button asChild>
                      <Link to={`/dashboard/${workspaceId}/crm/sms-templates/new`}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create SMS Template
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Content Preview</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smsTemplates.map((template: any) => (
                      <TableRow
                        key={template.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/dashboard/${workspaceId}/crm/sms-templates/${template.id}`)}
                      >
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                          {template.content || '\u2014'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(template.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Scripts Tab */}
        <TabsContent value="scripts" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {scriptsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !Array.isArray(callScripts) || callScripts.length === 0 ? (
                <div className="text-center py-12">
                  <Phone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No call scripts yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Create scripts for AI voice calls.</p>
                  <Button asChild>
                    <Link to={`/dashboard/${workspaceId}/crm/ai-call-scripts/new`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Call Script
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callScripts.map((script: any) => (
                      <TableRow
                        key={script.id}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">{script.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                          {script.description || '\u2014'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(script.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
