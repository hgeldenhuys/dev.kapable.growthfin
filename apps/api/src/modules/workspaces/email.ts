/**
 * Workspace Email Notification Service
 * Handles sending emails for workspace invitations and other notifications
 */

import { getResendProvider } from '../../lib/providers/resend';

export interface InvitationEmailParams {
  email: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  token: string;
}

/**
 * Send invitation email to a new workspace member
 * This is a fire-and-forget operation - errors are logged but don't block the invitation
 *
 * @param params - Email parameters
 */
export async function sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
  try {
    const frontendUrl = process.env.WEB_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const acceptUrl = `${frontendUrl}/invitations/${params.token}`;

    const resend = getResendProvider();

    // Generate HTML email template
    const html = generateInvitationEmailTemplate({
      workspaceName: params.workspaceName,
      inviterName: params.inviterName,
      role: params.role,
      acceptUrl,
    });

    await resend.sendEmail({
      to: params.email,
      subject: `You've been invited to join ${params.workspaceName} on NewLeads`,
      html,
      tags: {
        type: 'workspace_invitation',
        // Sanitize workspace name for tags (only ASCII letters, numbers, underscores, dashes)
        workspace: params.workspaceName.replace(/[^a-zA-Z0-9_-]/g, '_'),
        role: params.role,
      },
    });

    console.log(`[Email] Invitation sent to ${params.email} for workspace ${params.workspaceName}`);
  } catch (error) {
    // Log error but don't throw - email failure shouldn't block the invitation
    console.error('[Email] Failed to send invitation email:', error, params);
  }
}

/**
 * Generate HTML template for invitation email
 */
function generateInvitationEmailTemplate(params: {
  workspaceName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workspace Invitation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      color: #4F46E5;
      font-size: 28px;
      margin: 0;
    }
    h2 {
      color: #1a1a1a;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .invitation-details {
      background-color: #f8f9fa;
      border-left: 4px solid #4F46E5;
      padding: 15px;
      margin: 20px 0;
    }
    .invitation-details p {
      margin: 5px 0;
    }
    .invitation-details strong {
      color: #4F46E5;
    }
    .cta-button {
      display: inline-block;
      background-color: #4F46E5;
      color: #ffffff;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .cta-button:hover {
      background-color: #4338CA;
    }
    .expiry-notice {
      color: #666;
      font-size: 14px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      color: #666;
      font-size: 14px;
    }
    .alt-link {
      color: #4F46E5;
      word-break: break-all;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>NewLeads</h1>
    </div>

    <h2>You've been invited!</h2>

    <p>Hi there,</p>

    <div class="invitation-details">
      <p><strong>${params.inviterName}</strong> has invited you to join:</p>
      <p><strong>${params.workspaceName}</strong> as a <strong>${params.role}</strong></p>
    </div>

    <p>Accept your invitation to start collaborating with your team on NewLeads.</p>

    <div style="text-align: center;">
      <a href="${params.acceptUrl}" class="cta-button">Accept Invitation</a>
    </div>

    <p class="expiry-notice">⏰ This invitation expires in 7 days.</p>

    <div class="footer">
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p class="alt-link">${params.acceptUrl}</p>

      <p style="margin-top: 20px;">
        Best regards,<br/>
        The NewLeads Team
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
