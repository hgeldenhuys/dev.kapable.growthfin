/**
 * Feature Documentation Content Renderer
 * Renders YAML documentation in a user-friendly format
 */

import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Separator } from '~/components/ui/separator';
import {
  Lightbulb,
  TrendingUp,
  Users,
  Workflow,
  Plug,
  HelpCircle,
  CheckCircle,
  Code,
  Key,
} from 'lucide-react';
import type { FeatureDocumentation } from '~/lib/docs-loader';
import { cn } from '~/lib/utils';

interface FeatureDocContentProps {
  doc: FeatureDocumentation;
}

export function FeatureDocContent({ doc }: FeatureDocContentProps) {
  return (
    <div className="docs-content space-y-8">
      {/* Overview Section */}
      <section id="overview" className="scroll-mt-20">
        <h2 className="text-3xl font-bold tracking-tight mb-4">Overview</h2>
        <p className="text-xl text-muted-foreground mb-6">{doc.overview.headline}</p>
        <p className="text-base leading-7">{doc.overview.description}</p>
      </section>

      <Separator />

      {/* Business Value Section */}
      <section id="business-value" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Business Value</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {doc.overview.businessValue.map((value, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">{value.metric}</CardTitle>
                <CardDescription className="text-2xl font-bold text-primary">
                  {value.impact}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{value.explanation}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Target Users Section */}
      <section className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-6 w-6 text-primary" />
          <h3 className="text-xl font-semibold tracking-tight">Target Users</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {doc.overview.targetUsers.map((user, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-base">{user.role}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{user.useCase}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Capabilities Section */}
      <section id="capabilities" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-6">
          <Workflow className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Capabilities</h2>
        </div>

        <div className="space-y-8">
          {doc.capabilities.map((capability) => (
            <Card key={capability.id} id={`capability-${capability.id}`} className="scroll-mt-20">
              <CardHeader>
                <CardTitle>{capability.name}</CardTitle>
                <CardDescription>{capability.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Workflow Steps */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Workflow
                  </h4>
                  <ol className="space-y-3">
                    {capability.workflow.steps.map((step, index) => (
                      <li key={index} className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="font-medium">{step.action}</p>
                          <p className="text-sm text-muted-foreground">
                            Expected: {step.expectedResult}
                          </p>
                          {step.screenshot && (
                            <p className="text-xs text-muted-foreground italic">
                              Screenshot: {step.screenshot}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Demo Talking Points */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Demo Talking Points
                  </h4>
                  <div className="space-y-2">
                    {capability.demoTalkingPoints.map((point, index) => (
                      <Alert
                        key={index}
                        className={cn(
                          point.emphasis === 'key' && 'border-primary',
                          point.emphasis === 'supporting' && 'border-blue-500',
                          point.emphasis === 'optional' && 'border-muted'
                        )}
                      >
                        <AlertDescription className="flex items-start gap-2">
                          <Badge
                            variant={point.emphasis === 'key' ? 'default' : 'outline'}
                            className="mt-0.5"
                          >
                            {point.emphasis}
                          </Badge>
                          <span className="flex-1">{point.point}</span>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>

                {/* Technical Details */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Technical Details
                  </h4>
                  <div className="bg-muted rounded-lg p-4 space-y-2 text-sm font-mono">
                    <div>
                      <span className="text-muted-foreground">API Endpoint:</span>{' '}
                      <code className="text-primary">{capability.technicalDetails.api}</code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Real-time:</span>{' '}
                      <Badge variant={capability.technicalDetails.realtime ? 'default' : 'outline'}>
                        {capability.technicalDetails.realtime ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">
                        <Key className="h-3 w-3 inline mr-1" />
                        Permissions:
                      </span>
                      {capability.technicalDetails.permissions.map((perm) => (
                        <Badge key={perm} variant="secondary">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Integrations Section */}
      <section id="integrations" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <Plug className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Integrations</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {doc.integrations.map((integration, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-base capitalize">{integration.feature}</CardTitle>
                <CardDescription>{integration.touchpoint}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge>{integration.dataFlow}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* FAQ Section */}
      <section id="faq" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-4">
          {doc.faq.map((item, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{item.question}</CardTitle>
                  <Badge variant="outline">{item.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
                {item.relatedWorkflow && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Related workflow: {item.relatedWorkflow}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
