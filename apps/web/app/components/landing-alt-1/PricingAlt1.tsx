import { useState, useRef, useEffect } from 'react';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { trackEvent } from '~/lib/posthog';

export function PricingAlt1() {
  const sectionRef = useRef<HTMLElement>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackEvent('section_viewed', { section: 'pricing', test_variant: 'alt-1' });
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

  const tiers = [
    {
      name: 'Starter',
      price: 'R15,000',
      desc: 'For testing the platform',
      leads: '500/month',
      features: ['Email + LinkedIn', 'Basic AI research', 'Standard reporting'],
      popular: false
    },
    {
      name: 'Growth',
      price: 'R45,000',
      desc: 'Most popular for scaling',
      leads: '2,000/month',
      features: ['All channels', 'Advanced AI', 'Real-time analytics', 'Priority support'],
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      desc: 'Unlimited everything',
      leads: 'Unlimited',
      features: ['White-label', 'Dedicated team', 'Custom integration', 'SLA guarantee'],
      popular: false
    }
  ];

  return (
    <section ref={sectionRef} className="py-20 sm:py-32 bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Simple, Predictable Pricing
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
            Pay for leads you process, not users. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div key={tier.name} className="relative">
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-blue-600 text-white px-4 py-1">Most Popular</Badge>
                </div>
              )}
              <Card className={`p-8 ${tier.popular ? 'border-2 border-blue-600 shadow-2xl scale-105' : 'border-gray-200 dark:border-gray-700'} dark:bg-gray-800`}>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{tier.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{tier.desc}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">{tier.price}</span>
                  {tier.price !== 'Custom' && <span className="text-gray-600 dark:text-gray-400">/month</span>}
                </div>

                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Up to {tier.leads}</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">Qualified Leads</div>
                </div>

                <ul className="mb-8 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={tier.popular ? 'default' : 'outline'}
                  onClick={() => {
                    trackEvent('cta_clicked', { location: 'pricing', tier: tier.name, test_variant: 'alt-1' });
                    document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Get Started
                </Button>
              </Card>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-400">
            ✓ No setup fees • ✓ Cancel anytime • ✓ POPIA compliant
          </p>
        </div>
      </div>
    </section>
  );
}
