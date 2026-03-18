/**
 * Channels Settings Tab
 * Consolidates Email, SMS, and Enrichment settings into collapsible sections
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../ui/collapsible";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { ChevronDown, Mail, MessageSquare, Sparkles, ExternalLink } from "lucide-react";
import { EnrichmentSettingsTab } from "./EnrichmentSettingsTab";
import { SmsRateLimitSettingsTab } from "./SmsRateLimitSettingsTab";
import { cn } from "~/lib/utils";

interface ChannelsSettingsTabProps {
  workspaceId: string;
  userRole: string;
}

export function ChannelsSettingsTab({
  workspaceId,
  userRole,
}: ChannelsSettingsTabProps) {
  const navigate = useNavigate();
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Email Section */}
      <Collapsible
        open={emailOpen}
        onOpenChange={setEmailOpen}
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">Email Deliverability & Compliance</CardTitle>
                    <CardDescription>
                      Suppression lists, bounce handling, rate limits, and CAN-SPAM compliance
                    </CardDescription>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform",
                    emailOpen && "rotate-180"
                  )}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-4">
                Configure email deliverability settings to protect your sender reputation
                and ensure compliance. Manage suppressed emails, set sending rate limits,
                and configure compliance requirements.
              </p>
              <Button
                onClick={() =>
                  navigate(`/dashboard/${workspaceId}/settings/email-deliverability`)
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Email Deliverability Settings
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* SMS Section */}
      <Collapsible
        open={smsOpen}
        onOpenChange={setSmsOpen}
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">SMS Rate Limits</CardTitle>
                    <CardDescription>
                      Configure rate limits for bulk SMS campaigns
                    </CardDescription>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform",
                    smsOpen && "rotate-180"
                  )}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <SmsRateLimitSettingsTab
                workspaceId={workspaceId}
                userRole={userRole}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Enrichment Section */}
      <Collapsible
        open={enrichmentOpen}
        onOpenChange={setEnrichmentOpen}
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">Enrichment Settings</CardTitle>
                    <CardDescription>
                      Lead enrichment provider, rate limits, and budget configuration
                    </CardDescription>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform",
                    enrichmentOpen && "rotate-180"
                  )}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <EnrichmentSettingsTab
                workspaceId={workspaceId}
                userRole={userRole}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
