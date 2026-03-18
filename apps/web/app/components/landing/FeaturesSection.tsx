import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Brain, Workflow, PhoneCall, BarChart3, CheckCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { trackEvent } from '~/lib/posthog';

const features = [
  {
    id: 'intelligence',
    icon: Brain,
    title: 'Lead Intelligence',
    description: 'AI-powered research and qualification that understands your ideal customer profile',
    benefits: [
      'Deep company & contact research',
      'Propensity-to-buy scoring',
      'Intent signal detection',
      'ICP matching algorithms'
    ]
  },
  {
    id: 'orchestration',
    icon: Workflow,
    title: 'Multi-Channel Orchestration',
    description: 'Reach prospects where they are with perfectly timed, personalized outreach',
    benefits: [
      'Email sequences',
      'LinkedIn automation',
      'WhatsApp messaging',
      'Voice calling'
    ]
  },
  {
    id: 'hybrid',
    icon: PhoneCall,
    title: 'AI-Human Hybrid Calling',
    description: 'Intelligent handoffs between AI and human SDRs for maximum efficiency',
    benefits: [
      'AI handles initial outreach',
      'Warm lead qualification',
      'Smart handoff logic',
      'Real-time notifications'
    ]
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Analytics & Reporting',
    description: 'Real-time dashboards and insights to optimize your sales development process',
    benefits: [
      'Campaign performance tracking',
      'Conversion funnel analysis',
      'ROI reporting',
      'Predictive insights'
    ]
  }
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackEvent('section_viewed', {
              section: 'features',
              scroll_depth: Math.round((window.scrollY / document.body.scrollHeight) * 100)
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 sm:py-32 bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-growthfin-dark dark:text-white">
            Everything You Need to Scale
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            A complete platform built for modern B2B sales development
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.id}
                className="border-2 hover:border-growthfin-primary transition-all hover:shadow-xl group dark:bg-gray-800 dark:border-gray-700"
              >
                <CardHeader>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-growthfin-primary to-growthfin-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-growthfin-dark dark:text-white">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {feature.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-growthfin-success flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Integration Logos */}
        <div className="mt-20 text-center">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-8">
            Powered By Industry Leaders
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 text-gray-400 dark:text-gray-500 dark:bg-gray-800 rounded-2xl py-8">
            <div className="font-bold text-2xl">Telnyx</div>
            <div className="font-bold text-2xl">OpenAI</div>
            <div className="font-bold text-2xl">Anthropic</div>
            <div className="font-bold text-2xl">Clerk</div>
          </div>
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
            POPIA-Compliant • Enterprise Security • 99.9% Uptime SLA
          </p>
        </div>
      </div>
    </section>
  );
}
