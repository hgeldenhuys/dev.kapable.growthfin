import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { trackEvent } from '~/lib/posthog';

const pricingTiers = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small teams testing SDaaS',
    price: 'R15,000',
    period: '/month',
    setup: 'R5,000 setup fee',
    features: [
      'Up to 500 leads/month',
      'Email + LinkedIn outreach',
      'Basic AI research',
      'Standard reporting',
      'Email support'
    ],
    cta: 'Start Free Trial',
    popular: false
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'For scaling sales teams',
    price: 'R45,000',
    period: '/month',
    setup: 'R10,000 setup fee',
    features: [
      'Up to 2,000 leads/month',
      'All channels (Email, LinkedIn, WhatsApp, Voice)',
      'Advanced AI intelligence',
      'Real-time analytics',
      'Priority support',
      'Dedicated success manager'
    ],
    cta: 'Book Strategy Call',
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions at scale',
    price: 'Custom',
    period: '',
    setup: 'Custom onboarding',
    features: [
      'Unlimited leads',
      'White-label option',
      'Custom AI training',
      'API access',
      'SLA guarantees',
      'Dedicated account team'
    ],
    cta: 'Contact Sales',
    popular: false
  }
];

export function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [showEnterpriseDialog, setShowEnterpriseDialog] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackEvent('section_viewed', {
              section: 'pricing',
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

  const handlePricingCTA = (tier: string, cta: string) => {
    trackEvent('cta_clicked', {
      location: 'pricing',
      variant: 'tier',
      tier: tier,
      text: cta
    });

    if (tier === 'enterprise') {
      setShowEnterpriseDialog(true);
    } else {
      document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section ref={sectionRef} className="py-20 sm:py-32 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-growthfin-dark dark:text-white">
            Transparent Pricing
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Choose the plan that fits your growth stage. No hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.id}
              className={`relative ${
                tier.popular
                  ? 'border-2 border-growthfin-primary shadow-2xl scale-105'
                  : 'border-2 hover:border-growthfin-primary/50'
              } transition-all dark:bg-gray-800 dark:border-gray-700`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-growthfin-primary text-white px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl text-growthfin-dark dark:text-white">
                  {tier.name}
                </CardTitle>
                <CardDescription className="text-base dark:text-gray-300">
                  {tier.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-growthfin-dark dark:text-white">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-gray-500 dark:text-gray-400">{tier.period}</span>
                  )}
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {tier.setup}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-growthfin-success flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className={`w-full ${
                    tier.popular
                      ? 'bg-gradient-to-r from-growthfin-primary to-growthfin-secondary hover:opacity-90'
                      : ''
                  }`}
                  variant={tier.popular ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handlePricingCTA(tier.id, tier.cta)}
                >
                  {tier.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>All plans include POPIA compliance, data security, and regular updates.</p>
          <p className="mt-2">No contracts. Cancel anytime.</p>
        </div>
      </div>

      {/* Enterprise Contact Dialog */}
      <Dialog open={showEnterpriseDialog} onOpenChange={setShowEnterpriseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enterprise Solutions</DialogTitle>
            <DialogDescription>
              Our Enterprise tier offers custom pricing, dedicated support, and white-label options tailored to your organization's needs. Book a call with our sales team to discuss your requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowEnterpriseDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowEnterpriseDialog(false);
              document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Contact Sales
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
