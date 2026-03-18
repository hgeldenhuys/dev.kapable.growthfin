import { useState, useRef, useEffect } from 'react';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { trackEvent } from '~/lib/posthog';

export function PricingSectionAlt2() {
  const sectionRef = useRef<HTMLElement>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackEvent('section_viewed', { section: 'pricing', test_variant: 'alt-2' });
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
      desc: 'Perfect for testing the platform',
      leads: '500/month',
      features: ['Email outreach', 'Basic prospect research', 'Email support'],
      popular: false
    },
    {
      name: 'Growth',
      price: 'R45,000',
      desc: 'Most popular for scaling',
      leads: '2,000/month',
      features: ['All channels (Email, LinkedIn, WhatsApp, Voice)', 'Advanced AI research', 'Real-time analytics', 'Priority support', 'CRM integrations'],
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      desc: 'Unlimited everything',
      leads: 'Unlimited',
      features: ['White-label solution', 'Dedicated account team', 'Custom integrations', 'SLA guarantee', 'Training & onboarding'],
      popular: false
    }
  ];

  return (
    <section ref={sectionRef} className="py-20 sm:py-32 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            Simple, Predictable Pricing
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Pay for meetings you generate, not licenses. No setup fees, no long-term contracts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tier) => (
            <div key={tier.name} className="relative group">
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-emerald-600 text-white px-4 py-1 font-semibold">Recommended</Badge>
                </div>
              )}
              <Card className={`h-full flex flex-col overflow-hidden transition-all duration-300 ${
                tier.popular
                  ? 'border-2 border-teal-500 dark:border-teal-400 shadow-xl scale-105 lg:scale-110 bg-gradient-to-br from-white to-teal-50 dark:from-gray-800 dark:to-gray-900'
                  : 'border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}>
                <div className="p-8 flex-1 flex flex-col">
                  <h3 className="text-2xl font-black text-gray-950 dark:text-white mb-2">{tier.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{tier.desc}</p>

                  <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-5xl font-black text-gray-950 dark:text-white">{tier.price}</span>
                    {tier.price !== 'Custom' && <span className="text-gray-600 dark:text-gray-400">/month</span>}
                  </div>

                  <div className="mb-8 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800/40">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Up to</p>
                    <p className="text-lg font-black text-teal-600 dark:text-teal-400">{tier.leads} Qualified Leads</p>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full py-6 text-lg font-bold min-h-[44px] ${
                      tier.popular
                        ? 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white'
                        : 'border-2 border-gray-300 dark:border-gray-600 text-gray-950 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => {
                      trackEvent('cta_clicked', { location: 'pricing', tier: tier.name, test_variant: 'alt-2' });
                      if (tier.name === 'Enterprise') {
                        setShowDialog(true);
                      } else {
                        document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    {tier.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                  </Button>
                </div>
              </Card>
            </div>
          ))}
        </div>

        <div className="text-center mt-12 space-y-2">
          <p className="text-gray-600 dark:text-gray-400">
            ✓ No setup fees • ✓ Cancel anytime • ✓ POPIA compliant
          </p>
        </div>
      </div>

      {/* Enterprise Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enterprise Contact</DialogTitle>
            <DialogDescription>
              Our sales team will reach out to discuss a custom solution for your needs.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              setShowDialog(false);
              document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full bg-teal-600 hover:bg-teal-700"
          >
            Book a Demo Call
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
