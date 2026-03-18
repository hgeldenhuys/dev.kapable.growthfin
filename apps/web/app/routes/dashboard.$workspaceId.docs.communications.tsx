/**
 * Communications Features Documentation
 * Reference guide for Sandbox Mode, Email, SMS, Voice, and AI Calling
 *
 * This page provides comprehensive documentation for all communication features
 * available in GrowthFin, helping users understand setup, usage, and best practices.
 */

import { useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { AlertCircle, CheckCircle, DollarSign, Settings, Zap } from 'lucide-react';

export default function CommunicationsDocumentation() {
  const { workspaceId } = useParams();

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Communications Features</h1>
        <p className="text-muted-foreground text-lg">
          Complete reference guide for all customer engagement and outreach capabilities
        </p>
      </div>

      {/* Quick Navigation */}
      <Tabs defaultValue="sandbox" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sandbox">Sandbox Mode</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="ai-calling">AI Calling</TabsTrigger>
        </TabsList>

        {/* SANDBOX MODE */}
        <TabsContent value="sandbox" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Sandbox Mode</CardTitle>
                  <CardDescription>Test campaigns safely without sending to real customers</CardDescription>
                </div>
                <Badge>Testing</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* What Is It */}
              <div>
                <h3 className="font-semibold mb-2 text-base">What Is Sandbox Mode?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sandbox Mode allows you to test your campaigns, messages, and workflows without actually
                  reaching your customers. All outbound communications are simulated, and responses are mocked
                  to help you validate campaign logic, timing, and personalization.
                </p>
              </div>

              {/* When to Use */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  When to Use Sandbox Mode
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Before launching a campaign:</strong> Test message templates, dynamic fields, and personalization</li>
                  <li>• <strong>Testing workflows:</strong> Verify campaign sequences and conditional logic without affecting real data</li>
                  <li>• <strong>Training and demos:</strong> Show stakeholders how campaigns work without using real customer data</li>
                  <li>• <strong>A/B testing setup:</strong> Validate variants and rules before activating with real audiences</li>
                  <li>• <strong>API integration testing:</strong> Test webhooks and callbacks without side effects</li>
                </ul>
              </div>

              {/* How to Enable */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  How to Enable Sandbox Mode
                </h3>
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li>1. Open any campaign or workflow</li>
                  <li>2. Toggle the <Badge variant="outline" className="inline ml-1">Sandbox Mode</Badge> switch in the top-right corner</li>
                  <li>3. The interface will turn <Badge className="inline bg-blue-100 text-blue-700">blue</Badge> to indicate sandbox is active</li>
                  <li>4. Send test messages to your test audience</li>
                  <li>5. All sends, delivery reports, and responses are simulated and logged separately from production</li>
                </ol>
              </div>

              {/* Key Behaviors */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Sandbox mode simulations do NOT incur billable costs. However, real sends
                  in sandbox still consume message credits if sent to actual customer numbers.
                </AlertDescription>
              </Alert>

              {/* Data Isolation */}
              <div>
                <h3 className="font-semibold mb-2 text-base">Data Isolation in Sandbox</h3>
                <div className="bg-muted p-3 rounded text-sm space-y-1 font-mono">
                  <div>✓ Sandbox sends do NOT affect customer segments</div>
                  <div>✓ Sandbox responses are NOT stored in production analytics</div>
                  <div>✓ Sandbox webhooks trigger test versions of your integrations</div>
                  <div>✓ Sandbox logs are cleared after 30 days</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMAIL */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Email Campaigns</CardTitle>
                  <CardDescription>Deliver personalized email campaigns at scale</CardDescription>
                </div>
                <Badge>Built-in</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overview */}
              <div>
                <h3 className="font-semibold mb-2 text-base">Overview</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  GrowthFin's email engine supports rich HTML templates, dynamic personalization, A/B testing,
                  and detailed delivery reporting. Emails are sent via our trusted infrastructure with built-in
                  DKIM, SPF, and DMARC compliance.
                </p>
              </div>

              {/* Setup */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Setup & Configuration
                </h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    <strong className="text-foreground">1. Sender Identity</strong>
                    <p>Configure your email sender address in Workspace Settings → Email. We recommend using a dedicated domain
                    (e.g., <code className="bg-muted px-1 rounded">campaigns@yourdomain.com</code>) for better deliverability.</p>
                  </div>
                  <div>
                    <strong className="text-foreground">2. DKIM Records</strong>
                    <p>Add the provided DKIM record to your DNS to enable email authentication. This improves inbox placement
                    and prevents spoofing.</p>
                  </div>
                  <div>
                    <strong className="text-foreground">3. Templates</strong>
                    <p>Build templates using our drag-and-drop editor or upload HTML. Support for Handlebars syntax for
                    dynamic personalization (e.g., <code className="bg-muted px-1 rounded">Hello {"{{firstName}}"}</code>).</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Core Features
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>✓ Rich HTML editor with responsive design</li>
                  <li>✓ Dynamic field insertion (first name, custom properties, etc.)</li>
                  <li>✓ A/B testing (subject line, content, send time)</li>
                  <li>✓ Scheduled sends with timezone support</li>
                  <li>✓ Bounce handling and list cleaning</li>
                  <li>✓ Open and click tracking (optional)</li>
                  <li>✓ Unsubscribe links and list management</li>
                </ul>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing & Limits
                </h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">Hobby Plan:</strong> 1,000 emails/month included, $0.01 per additional</p>
                  <p><strong className="text-foreground">Pro Plan:</strong> 50,000 emails/month included, $0.001 per additional</p>
                  <p><strong className="text-foreground">Enterprise:</strong> Custom limits and dedicated IP pool</p>
                </div>
              </div>

              {/* Best Practices */}
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong>Best Practice:</strong> Always test with a small segment first. Use A/B testing to optimize subject lines
                  and send times for higher engagement.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS */}
        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>SMS Campaigns</CardTitle>
                  <CardDescription>Send text messages via Twilio integration</CardDescription>
                </div>
                <Badge>Twilio-powered</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overview */}
              <div>
                <h3 className="font-semibold mb-2 text-base">Overview</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  SMS campaigns reach customers instantly on their phones. GrowthFin integrates with Twilio to provide
                  reliable, carrier-backed SMS delivery with support for two-way messaging, shortcodes, and detailed
                  delivery metrics.
                </p>
              </div>

              {/* Setup */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Setup & Configuration
                </h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    <strong className="text-foreground">1. Twilio Account</strong>
                    <p>Create or link an existing Twilio account in Workspace Settings → Integrations. You'll need your
                    Account SID and Auth Token.</p>
                  </div>
                  <div>
                    <strong className="text-foreground">2. Phone Number / Shortcode</strong>
                    <p>Provision a Twilio phone number or shortcode to use as the sender ID. Shortcodes (5-6 digits) have higher
                    deliverability for marketing but require additional registration.</p>
                  </div>
                  <div>
                    <strong className="text-foreground">3. Opt-In Compliance</strong>
                    <p>All SMS campaigns require prior opt-in from customers. Maintain an updated opt-out list and include
                    compliance text in messages.</p>
                  </div>
                </div>
              </div>

              {/* SMS vs Shortcode */}
              <div className="border rounded p-3 space-y-2 text-sm">
                <strong>Phone Number vs Shortcode:</strong>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <strong className="text-foreground">Long Number (Phone)</strong>
                    <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                      <li>• Setup: 1-2 minutes</li>
                      <li>• Deliverability: Good (not marked as commercial)</li>
                      <li>• Cost: Lower ($1/month)</li>
                      <li>• Best for: Transactional, low volume</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-foreground">Shortcode (5-6 digits)</strong>
                    <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                      <li>• Setup: 2-4 weeks (carrier approval)</li>
                      <li>• Deliverability: Excellent (whitelisted)</li>
                      <li>• Cost: Higher ($500-1000/month)</li>
                      <li>• Best for: Marketing campaigns, high volume</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Core Features
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>✓ Scheduled SMS sends with timezone support</li>
                  <li>✓ Dynamic personalization (name, custom fields)</li>
                  <li>✓ Link shortening and click tracking</li>
                  <li>✓ Two-way messaging for customer replies</li>
                  <li>✓ Delivery reports (sent, delivered, failed)</li>
                  <li>✓ Keyword-based auto-responses</li>
                  <li>✓ Opt-out management</li>
                </ul>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing & Limits
                </h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">Twilio Cost:</strong> Typical cost is $0.0075 per SMS (US domestic)</p>
                  <p><strong className="text-foreground">Hobby Plan:</strong> 500 SMS/month included, Twilio charges apply after</p>
                  <p><strong className="text-foreground">Pro Plan:</strong> 10,000 SMS/month included, Twilio charges apply after</p>
                  <p><strong className="text-foreground">International rates:</strong> $0.01-0.50 per SMS depending on country</p>
                </div>
              </div>

              {/* Compliance */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>IMPORTANT:</strong> SMS is heavily regulated (TCPA, GDPR). You must have explicit opt-in consent,
                  include accurate sender identification, and provide clear opt-out instructions. Violations can result in fines.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VOICE */}
        <TabsContent value="voice" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Voice Campaigns</CardTitle>
                  <CardDescription>Outbound calling and IVR automation</CardDescription>
                </div>
                <Badge>Twilio Voice</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overview */}
              <div>
                <h3 className="font-semibold mb-2 text-base">Overview</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Voice campaigns enable outbound calling, interactive voice response (IVR), and voice message delivery.
                  Use cases include appointment reminders, surveys, emergency notifications, and multi-language customer support.
                </p>
              </div>

              {/* Use Cases */}
              <div>
                <h3 className="font-semibold mb-2 text-base">Common Use Cases</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li><strong className="text-foreground">Appointment Reminders:</strong> Auto-call customers 24 hours before appointments with press-1 to confirm option</li>
                  <li><strong className="text-foreground">Surveys:</strong> Call customers to collect feedback via IVR menu selection</li>
                  <li><strong className="text-foreground">Emergency Alerts:</strong> Broadcast urgent notifications (power outage, weather, etc.)</li>
                  <li><strong className="text-foreground">Payment Collections:</strong> Automated payment reminder calls with dial-to-pay options</li>
                  <li><strong className="text-foreground">Support Escalation:</strong> Route calls to live agents based on IVR selection</li>
                </ul>
              </div>

              {/* Technical Setup */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Setup & Configuration
                </h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    <strong className="text-foreground">1. Twilio Phone Number</strong>
                    <p>Provision a Twilio caller ID number (the phone number that will appear when you call customers).</p>
                  </div>
                  <div>
                    <strong className="text-foreground">2. IVR Script</strong>
                    <p>Define the call flow: greeting, menu options, recording playback, digit collection, and routing to agents or webhooks.</p>
                  </div>
                  <div>
                    <strong className="text-foreground">3. Recording & Transcription</strong>
                    <p>Enable call recording for compliance and transcription for searchable logs (additional cost).</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Core Features
                </h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>✓ Outbound calling with configurable caller ID</li>
                  <li>✓ Interactive Voice Response (IVR) with menu prompts</li>
                  <li>✓ DTMF digit collection (press 1 for yes, 2 for no)</li>
                  <li>✓ Call recording and transcription</li>
                  <li>✓ Text-to-speech (TTS) for dynamic prompts</li>
                  <li>✓ Call routing to live agents or webhooks</li>
                  <li>✓ Do Not Call (DNC) list compliance</li>
                </ul>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing & Limits
                </h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">Twilio Voice Cost:</strong> $0.013 per minute (US domestic)</p>
                  <p><strong className="text-foreground">International calls:</strong> $0.05-0.50 per minute depending on country</p>
                  <p><strong className="text-foreground">Transcription:</strong> $0.0001 per second ($0.36 per hour)</p>
                  <p><strong className="text-foreground">No included minutes:</strong> All voice calls are billed at Twilio rates</p>
                </div>
              </div>

              {/* Compliance */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Legal Requirements:</strong> Outbound calling is regulated by TCPA. You must have prior express written
                  consent, maintain DNC lists, include caller identification, and respect called party preferences.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI CALLING */}
        <TabsContent value="ai-calling" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>AI Calling</CardTitle>
                  <CardDescription>Autonomous voice conversations powered by Claude AI</CardDescription>
                </div>
                <Badge className="bg-purple-600">Claude AI</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overview */}
              <div>
                <h3 className="font-semibold mb-2 text-base">What Is AI Calling?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  AI Calling combines voice delivery (via Twilio) with conversational AI (Claude) to enable realistic,
                  context-aware phone conversations. Customers hear a natural-sounding voice, can interrupt and ask questions,
                  and the AI agent responds intelligently without human involvement.
                </p>
              </div>

              {/* How It Works */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  How It Works
                </h3>
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li>
                    <strong className="text-foreground">1. Outbound Call Initiated</strong>
                    <p className="ml-4">You create an AI Calling campaign and select your audience. GrowthFin initiates outbound calls
                    using Twilio, connecting to your customers' phones.</p>
                  </li>
                  <li>
                    <strong className="text-foreground">2. Claude AI Greets</strong>
                    <p className="ml-4">When the customer answers, Claude AI delivers your configured greeting (e.g., "Hello, this is
                    Jane from ABC Corp calling about your recent purchase. How can I help?").</p>
                  </li>
                  <li>
                    <strong className="text-foreground">3. Live Conversation</strong>
                    <p className="ml-4">The customer can speak naturally, ask questions, and the AI listens, understands context,
                    and responds conversationally. Speech-to-text converts customer voice to text; text-to-speech converts AI responses to voice.</p>
                  </li>
                  <li>
                    <strong className="text-foreground">4. Intelligent Routing</strong>
                    <p className="ml-4">If the customer requests to speak with a human, the AI can transfer to a live agent.
                    Otherwise, the call concludes naturally.</p>
                  </li>
                  <li>
                    <strong className="text-foreground">5. Call Summary & Logging</strong>
                    <p className="ml-4">After the call, Claude generates a summary of the conversation, logged customer responses,
                    and any actions taken (e.g., appointment booked, question answered).</p>
                  </li>
                </ol>
              </div>

              {/* Setup */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Setup & Configuration
                </h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div>
                    <strong className="text-foreground">1. Define the AI Persona</strong>
                    <p>Write a system prompt that defines the AI's behavior, tone, and knowledge. Example: "You are a helpful
                    customer service agent for a dental practice. You help patients reschedule appointments and answer common questions."</p>
                  </div>
                  <div>
                    <strong className="text-foreground">2. Configure Greeting & Fallback</strong>
                    <p>Set the opening greeting and a fallback message for when the AI can't understand or needs clarification.</p>
                  </div>
                  <div>
                    <strong className="text-foreground">3. Enable Webhooks (Optional)</strong>
                    <p>Configure webhooks to trigger actions during the call (e.g., book an appointment, update CRM, send follow-up email).</p>
                  </div>
                  <div>
                    <strong className="text-foreground">4. Set Time Constraints</strong>
                    <p>Define max call duration, timeout for silence, and business hours (don't call customers at 2 AM).</p>
                  </div>
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h3 className="font-semibold mb-2 text-base">AI Capabilities</h3>
                <div className="grid gap-3 text-sm">
                  <div className="border rounded p-3">
                    <strong className="text-foreground">Natural Language Understanding</strong>
                    <p className="text-muted-foreground text-xs mt-1">Understands context, follow-up questions, and colloquialisms.
                    "Yeah, Tuesday works for me" is understood as appointment confirmation.</p>
                  </div>
                  <div className="border rounded p-3">
                    <strong className="text-foreground">Dynamic Information</strong>
                    <p className="text-muted-foreground text-xs mt-1">Access to customer data (previous purchases, account balance,
                    appointment history) to provide personalized responses.</p>
                  </div>
                  <div className="border rounded p-3">
                    <strong className="text-foreground">Action Execution</strong>
                    <p className="text-muted-foreground text-xs mt-1">Can trigger actions: book appointments, process refunds,
                    schedule follow-ups, or open support tickets without transferring to human.</p>
                  </div>
                  <div className="border rounded p-3">
                    <strong className="text-foreground">Transcripts & Summaries</strong>
                    <p className="text-muted-foreground text-xs mt-1">Complete conversation transcripts and AI-generated summaries
                    logged in your CRM for analysis and compliance.</p>
                  </div>
                </div>
              </div>

              {/* Use Cases */}
              <div>
                <h3 className="font-semibold mb-2 text-base">Ideal Use Cases</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li><strong className="text-foreground">Appointment Confirmations:</strong> "I'm calling to confirm your appointment tomorrow at 2 PM. Does that still work?"</li>
                  <li><strong className="text-foreground">Reactivation Campaigns:</strong> "We noticed you haven't visited us in 6 months. Can we schedule a time to reconnect?"</li>
                  <li><strong className="text-foreground">Customer Surveys:</strong> Interactive questions with conversational follow-ups based on responses</li>
                  <li><strong className="text-foreground">Upsell/Cross-sell:</strong> "Based on your recent purchase, we thought you might be interested in..."</li>
                  <li><strong className="text-foreground">Payment Collections:</strong> Discuss past-due invoices with decision-making authority</li>
                </ul>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing & Limits
                </h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">Twilio Voice Cost:</strong> $0.013/minute (billed for actual call duration)</p>
                  <p><strong className="text-foreground">Claude API Cost:</strong> $0.003 per 1K input tokens, $0.015 per 1K output tokens
                  (typical 5-minute call = $0.15-0.30 in AI cost)</p>
                  <p><strong className="text-foreground">Speech-to-Text:</strong> $0.0001 per 15 seconds</p>
                  <p><strong className="text-foreground">Text-to-Speech:</strong> $0.015 per 1M characters</p>
                  <p><strong className="text-foreground">Total Cost Per Call:</strong> ~$0.20-0.50 depending on call duration and complexity</p>
                </div>
              </div>

              {/* Best Practices */}
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong>Best Practice:</strong> Start with simple use cases (confirmations, surveys). The AI learns from
                  interactions, so monitor transcripts and refine the system prompt based on real conversations.
                </AlertDescription>
              </Alert>

              {/* Compliance Note */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Always disclose that you're calling from an automated system early in the conversation.
                  Comply with TCPA and local regulations regarding robocalls and AI disclosure.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-2 font-semibold">Feature</th>
                  <th className="pb-2 font-semibold">Email</th>
                  <th className="pb-2 font-semibold">SMS</th>
                  <th className="pb-2 font-semibold">Voice</th>
                  <th className="pb-2 font-semibold">AI Calling</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                <tr>
                  <td className="py-2"><strong>Setup Time</strong></td>
                  <td>5 min</td>
                  <td>10 min</td>
                  <td>15 min</td>
                  <td>30 min</td>
                </tr>
                <tr>
                  <td className="py-2"><strong>Cost/Contact</strong></td>
                  <td>$0.001-0.01</td>
                  <td>$0.0075-0.50</td>
                  <td>$0.013/min</td>
                  <td>$0.20-0.50</td>
                </tr>
                <tr>
                  <td className="py-2"><strong>Engagement Rate</strong></td>
                  <td>2-5%</td>
                  <td>15-30%</td>
                  <td>30-50%</td>
                  <td>40-60%</td>
                </tr>
                <tr>
                  <td className="py-2"><strong>Best For</strong></td>
                  <td>Newsletters, marketing</td>
                  <td>Transactional, urgent</td>
                  <td>Confirmations, alerts</td>
                  <td>Conversations, retention</td>
                </tr>
                <tr>
                  <td className="py-2"><strong>Compliance Complexity</strong></td>
                  <td>Low</td>
                  <td>High (TCPA)</td>
                  <td>High (TCPA)</td>
                  <td>High (TCPA + AI)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-1 text-sm">Can I combine these channels in one campaign?</h4>
            <p className="text-sm text-muted-foreground">
              Yes! Multi-channel campaigns send email first, then SMS, then voice calls to non-responders.
              This increases conversion rates significantly. However, be mindful of frequency caps to avoid customer fatigue.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1 text-sm">What happens if a customer opts out?</h4>
            <p className="text-sm text-muted-foreground">
              GrowthFin automatically respects opt-outs across all channels. Customers who unsubscribe from email
              receive no further email, SMS, or voice communications unless they explicitly re-opt-in.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1 text-sm">How do I ensure compliance with GDPR / CCPA?</h4>
            <p className="text-sm text-muted-foreground">
              Maintain explicit opt-in consent for all channels, provide easy opt-out mechanisms, honor do-not-call lists,
              and keep records of customer preferences. Contact your legal team to review compliance before launching campaigns.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1 text-sm">What's the difference between Sandbox and production?</h4>
            <p className="text-sm text-muted-foreground">
              Sandbox is for testing. Sends in sandbox are simulated and don't reach real customers. Disable sandbox mode
              before sending real campaigns. The toggle switch in the top-right makes this explicit.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          <strong>Need Help?</strong> For questions about setup, compliance, or best practices, contact our support team
          or check the knowledge base in your workspace.
        </AlertDescription>
      </Alert>
    </div>
  );
}
