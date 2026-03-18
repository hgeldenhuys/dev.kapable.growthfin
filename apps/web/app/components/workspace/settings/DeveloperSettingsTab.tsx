/**
 * Developer Settings Tab
 * Consolidates Developer tools, API Usage, and Automation links into sections
 */

import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Webhook, Activity, Workflow, ExternalLink } from "lucide-react";

interface DeveloperSettingsTabProps {
  workspaceId: string;
}

export function DeveloperSettingsTab({ workspaceId }: DeveloperSettingsTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Developer Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Developer Tools
          </CardTitle>
          <CardDescription>
            Webhook testing, API configuration, and integration tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Test webhooks, manage API keys, and configure integrations with external services.
          </p>
          <Button
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/webhook-test`)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Webhook Test Tool
          </Button>
        </CardContent>
      </Card>

      {/* API Usage Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            API Usage Monitor
          </CardTitle>
          <CardDescription>
            Track usage and credit balances across all external API providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Monitor real-time usage across Twilio, ElevenLabs, OpenAI, Anthropic, and
            other API providers. View credit balances, quota consumption, and receive
            alerts when usage thresholds are reached.
          </p>
          <Button
            onClick={() => navigate(`/dashboard/${workspaceId}/settings/api-usage`)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open API Usage Dashboard
          </Button>
        </CardContent>
      </Card>

      {/* Automation & Workflows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Automation & Workflows
          </CardTitle>
          <CardDescription>
            Configure automated workflows and triggers for your CRM processes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Set up automated workflows to streamline lead routing, follow-up sequences,
            and notification triggers.
          </p>
          <Button
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/automation/workflows`)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Workflows
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
