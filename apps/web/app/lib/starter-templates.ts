/**
 * Starter email templates for onboarding.
 * Used when users want to quick-start with pre-built templates.
 */

export const STARTER_TEMPLATES = [
  {
    name: 'Welcome Email',
    subject: 'Welcome to {{companyName}}!',
    body: `<p>Hi {{firstName}},</p>
<p>Thank you for your interest in our services. We're excited to have you on board!</p>
<p>Here's what you can expect from us:</p>
<ul>
  <li>Regular updates on our latest offerings</li>
  <li>Exclusive insights and tips for your industry</li>
  <li>Priority support from our team</li>
</ul>
<p>If you have any questions, don't hesitate to reach out.</p>
<p>Best regards,<br/>The Team</p>`,
    category: 'marketing',
  },
  {
    name: 'Follow-up Email',
    subject: 'Following up on our conversation',
    body: `<p>Hi {{firstName}},</p>
<p>I wanted to follow up on our recent conversation and see if you had any questions about what we discussed.</p>
<p>I'd be happy to:</p>
<ul>
  <li>Walk you through a demo</li>
  <li>Send over more detailed information</li>
  <li>Schedule a call at your convenience</li>
</ul>
<p>Looking forward to hearing from you.</p>
<p>Kind regards</p>`,
    category: 'sales',
  },
  {
    name: 'Meeting Request',
    subject: "Let's schedule a quick call",
    body: `<p>Hi {{firstName}},</p>
<p>I'd love to find 15 minutes to chat about how we can help {{companyName}} achieve its goals.</p>
<p>Would any of these times work for you this week?</p>
<ul>
  <li>Tuesday at 10:00 AM</li>
  <li>Wednesday at 2:00 PM</li>
  <li>Thursday at 11:00 AM</li>
</ul>
<p>If none of these work, feel free to suggest a time that suits you better.</p>
<p>Looking forward to connecting!</p>`,
    category: 'sales',
  },
] as const;
