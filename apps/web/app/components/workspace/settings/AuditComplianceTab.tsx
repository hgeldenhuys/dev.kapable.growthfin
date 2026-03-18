/**
 * Audit & Compliance Tab
 * Merges AuditLogTab and Compliance section into a single tab
 */

import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { AuditLogTab } from "./AuditLogTab";

interface AuditComplianceTabProps {
  workspaceId: string;
}

export function AuditComplianceTab({ workspaceId }: AuditComplianceTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Audit Log */}
      <AuditLogTab workspaceId={workspaceId} />

      {/* Compliance & Consent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Compliance & Consent Management
          </CardTitle>
          <CardDescription>
            Manage consent records, KYC verification, and regulatory compliance settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            View and manage consent records, POPIA compliance, and KYC verification
            status for your contacts and leads.
          </p>
          <Button
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance`)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Compliance Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
