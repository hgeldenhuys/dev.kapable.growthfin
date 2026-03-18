/**
 * Compliance Dashboard
 * Overview of POPIA and FICA compliance status
 */

import { Shield, Users, CheckCircle2, AlertCircle, TrendingUp, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { useNavigate } from 'react-router';
import { useConsentRecords } from '~/hooks/useConsent';
import { useKYCRecords } from '~/hooks/useKYC';
import { useContacts } from '~/hooks/useContacts';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { Badge } from '~/components/ui/badge';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ComplianceDashboard() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  // Fetch data
  const { data: consentRecords = [], isLoading: loadingConsent } = useConsentRecords({ workspaceId });
  const { data: kycRecords = [], isLoading: loadingKYC } = useKYCRecords({ workspaceId });
  const { data: contacts = [], isLoading: loadingContacts } = useContacts({ workspaceId });

  // Calculate metrics
  const metrics = {
    totalContacts: contacts.length,
    contactsWithConsent: new Set(consentRecords.filter(c => c.status === 'granted').map(c => c.contactId)).size,
    consentGrantRate: contacts.length > 0
      ? Math.round((new Set(consentRecords.filter(c => c.status === 'granted').map(c => c.contactId)).size / contacts.length) * 100)
      : 0,
    pendingKYC: kycRecords.filter(k => k.status === 'pending' || k.status === 'in_review').length,
    verifiedKYC: kycRecords.filter(k => k.status === 'verified').length,
    kycCompletionRate: contacts.length > 0
      ? Math.round((kycRecords.filter(k => k.status === 'verified').length / contacts.length) * 100)
      : 0,
    highRiskContacts: kycRecords.filter(k => k.riskRating === 'high').length,
  };

  // Get expiring consents (next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiringConsents = consentRecords.filter(c => {
    if (!c.expiresAt || c.status !== 'granted') return false;
    const expiryDate = new Date(c.expiresAt);
    return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
  });

  // Get expired KYC records (based on nextReviewDate)
  const expiredKYC = kycRecords.filter(k => {
    if (!k.nextReviewDate || k.status !== 'verified') return false;
    return new Date(k.nextReviewDate) < new Date();
  });

  const isLoading = loadingConsent || loadingKYC || loadingContacts;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Compliance Dashboard
          </h1>
          <p className="text-muted-foreground">
            POPIA & FICA compliance monitoring and management
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacts with Consent</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.contactsWithConsent}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.consentGrantRate}% of total contacts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consent Grant Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.consentGrantRate}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalContacts} total contacts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending KYC</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingKYC}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting verification
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KYC Completion</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.kycCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.verifiedKYC} verified
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(expiringConsents.length > 0 || expiredKYC.length > 0 || metrics.highRiskContacts > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Compliance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expiringConsents.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">
                    Consents Expiring Soon
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {expiringConsents.length} consent record(s) expiring in the next 30 days
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance/consent`)}
                >
                  Review
                </Button>
              </div>
            )}

            {expiredKYC.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">
                    KYC Reviews Overdue
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {expiredKYC.length} KYC record(s) require review
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance/kyc`)}
                >
                  Review
                </Button>
              </div>
            )}

            {metrics.highRiskContacts > 0 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div>
                  <p className="font-medium text-orange-900 dark:text-orange-100">
                    High-Risk Contacts
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {metrics.highRiskContacts} contact(s) with high risk rating
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance/kyc`)}
                >
                  View
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance/consent`)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Consent Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Manage POPIA consent records and track data processing permissions
            </p>
            <div className="flex gap-2">
              <Badge variant="outline">{consentRecords.length} total</Badge>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                {consentRecords.filter(c => c.status === 'granted').length} granted
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance/kyc`)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              KYC Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Track FICA KYC verification status and risk assessments
            </p>
            <div className="flex gap-2">
              <Badge variant="outline">{kycRecords.length} total</Badge>
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                {metrics.pendingKYC} pending
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compliance Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Export audit logs and compliance reports for regulatory purposes
            </p>
            <Button variant="outline" size="sm" className="w-full">
              Generate Report
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Consent Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { status: 'granted', label: 'Granted', count: consentRecords.filter(c => c.status === 'granted').length, color: 'bg-green-500' },
                { status: 'pending', label: 'Pending', count: consentRecords.filter(c => c.status === 'pending').length, color: 'bg-yellow-500' },
                { status: 'revoked', label: 'Revoked', count: consentRecords.filter(c => c.status === 'revoked').length, color: 'bg-red-500' },
                { status: 'expired', label: 'Expired', count: consentRecords.filter(c => c.status === 'expired').length, color: 'bg-gray-500' },
              ].map((item) => (
                <div key={item.status} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-sm">{item.label}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KYC Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { status: 'verified', label: 'Verified', count: kycRecords.filter(k => k.status === 'verified').length, color: 'bg-green-500' },
                { status: 'in_review', label: 'In Review', count: kycRecords.filter(k => k.status === 'in_review').length, color: 'bg-blue-500' },
                { status: 'pending', label: 'Pending', count: kycRecords.filter(k => k.status === 'pending').length, color: 'bg-yellow-500' },
                { status: 'rejected', label: 'Rejected', count: kycRecords.filter(k => k.status === 'rejected').length, color: 'bg-red-500' },
              ].map((item) => (
                <div key={item.status} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-sm">{item.label}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
