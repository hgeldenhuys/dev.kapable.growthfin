import { Badge } from '~/components/ui/badge';
import { Brain, MessageSquare, Users, ArrowRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { trackEvent } from '~/lib/posthog';

const solutionSteps = [
  {
    id: 'intelligence',
    icon: Brain,
    step: '01',
    title: 'AI Lead Intelligence',
    description: 'Our AI researches each lead comprehensively, gathering insights from multiple sources and scoring propensity to buy.',
    features: ['Deep research automation', 'Propensity scoring', 'Intent signal detection']
  },
  {
    id: 'orchestration',
    icon: MessageSquare,
    step: '02',
    title: 'Multi-Channel Orchestration',
    description: 'Engage leads across email, LinkedIn, WhatsApp, and voice with perfectly timed, personalized messages.',
    features: ['Email sequences', 'LinkedIn automation', 'WhatsApp & SMS']
  },
  {
    id: 'hybrid',
    icon: Users,
    step: '03',
    title: 'AI-Human Hybrid Calling',
    description: 'AI handles initial outreach and qualification, seamlessly handing off warm leads to your human sales team.',
    features: ['Intelligent handoffs', 'Warm lead delivery', 'Real-time notifications']
  }
];

const metrics = [
  { value: '60%', label: 'Cost Reduction' },
  { value: '15%', label: 'Conversion Rate' },
  { value: '10x', label: 'Scale Increase' }
];

export function SolutionSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackEvent('section_viewed', {
              section: 'solution',
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
    <section ref={sectionRef} className="py-20 sm:py-32 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-growthfin-primary text-white">How It Works</Badge>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-growthfin-dark dark:text-white">
            How ACME CORP Solves It
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            A complete AI-powered SDR platform that scales with your business
          </p>
        </div>

        {/* Solution Steps */}
        <div className="space-y-12 mb-20">
          {solutionSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className="flex flex-col md:flex-row items-center gap-8"
              >
                {/* Icon and Step Number */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-growthfin-primary to-growthfin-secondary flex items-center justify-center shadow-lg">
                      <Icon className="h-12 w-12 text-white" />
                    </div>
                    <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-growthfin-dark text-white flex items-center justify-center font-bold text-lg">
                      {step.step}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl sm:text-3xl font-bold text-growthfin-dark dark:text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                    {step.description}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    {step.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-sm dark:bg-gray-800 dark:border-gray-700">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Arrow (not on last item) */}
                {index < solutionSteps.length - 1 && (
                  <div className="hidden lg:block flex-shrink-0">
                    <ArrowRight className="h-8 w-8 text-growthfin-primary" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Metrics Showcase */}
        <div className="bg-gradient-to-br from-growthfin-primary to-growthfin-secondary rounded-3xl p-12 text-center">
          <h3 className="text-3xl font-bold text-white mb-12">
            The Results Speak for Themselves
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-white/10 dark:bg-gray-800 backdrop-blur-sm rounded-2xl p-8">
                <div className="text-5xl sm:text-6xl font-bold text-white mb-2">
                  {metric.value}
                </div>
                <div className="text-xl text-white/90">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
