import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { trackEvent } from '~/lib/posthog';

export function HeroSectionAlt1() {
  const [showCalculator, setShowCalculator] = useState(false);

  const handlePrimaryCTA = () => {
    trackEvent('cta_clicked', {
      location: 'hero',
      variant: 'primary',
      text: 'Get Your Free ROI Analysis',
      test_variant: 'alt-1'
    });
    document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSecondaryLink = () => {
    trackEvent('cta_clicked', {
      location: 'hero',
      variant: 'secondary',
      text: 'See Proof',
      test_variant: 'alt-1'
    });
    document.getElementById('proof-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-600 to-blue-500 dark:from-blue-900 dark:to-blue-800 pt-16">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <div className="text-white">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 mb-6 w-fit">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold">Proven Results</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Increase Pipeline
              <br />
              <span className="text-blue-100">60% Less Cost</span>
            </h1>

            {/* Subheadline - specific metrics */}
            <p className="text-xl sm:text-2xl text-blue-50 mb-8 max-w-2xl leading-relaxed">
              See exactly how much revenue you can generate. ACME CORP customers achieve 15% conversion rates and 60% cost reduction.
            </p>

            {/* Social Proof */}
            <div className="grid grid-cols-3 gap-4 mb-10 py-6 border-t border-b border-white/20">
              <div>
                <div className="text-3xl font-bold">500+</div>
                <div className="text-sm text-blue-100">Sales Teams</div>
              </div>
              <div>
                <div className="text-3xl font-bold">R2M+</div>
                <div className="text-sm text-blue-100">Pipeline</div>
              </div>
              <div>
                <div className="text-3xl font-bold">15%</div>
                <div className="text-sm text-blue-100">Conversion</div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button
                size="lg"
                onClick={handlePrimaryCTA}
                className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-8 py-6 text-lg min-h-[44px] w-full sm:w-auto"
              >
                Get Your Free ROI Analysis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleSecondaryLink}
                className="border-2 border-white bg-transparent text-white hover:bg-white hover:text-blue-600 font-semibold px-8 py-6 text-lg min-h-[44px] w-full sm:w-auto transition-colors"
              >
                See Proof
              </Button>
            </div>

            {/* Trust message */}
            <p className="text-blue-100 text-sm">
              ✓ No credit card required • ✓ Takes 2 minutes • ✓ See your specific numbers
            </p>
          </div>

          {/* Right: Stats Card */}
          <div className="hidden lg:block">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <div className="text-white">
                <h3 className="text-lg font-semibold mb-6">Average Customer Results</h3>

                <div className="space-y-6">
                  <div className="border-b border-white/20 pb-6">
                    <div className="text-sm text-blue-100 mb-2">Cost per Qualified Lead</div>
                    <div className="flex items-end gap-4">
                      <div>
                        <div className="text-xs text-blue-100 mb-1">Before</div>
                        <div className="text-2xl font-bold">R100+</div>
                      </div>
                      <div className="text-white/50 text-2xl">→</div>
                      <div>
                        <div className="text-xs text-blue-100 mb-1">After</div>
                        <div className="text-2xl font-bold text-green-300">R40</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-white/20 pb-6">
                    <div className="text-sm text-blue-100 mb-2">Monthly Qualified Meetings</div>
                    <div className="flex items-end gap-4">
                      <div>
                        <div className="text-xs text-blue-100 mb-1">Manual SDRs</div>
                        <div className="text-2xl font-bold">50-100</div>
                      </div>
                      <div className="text-white/50 text-2xl">→</div>
                      <div>
                        <div className="text-xs text-blue-100 mb-1">With ACME CORP</div>
                        <div className="text-2xl font-bold text-green-300">500+</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-blue-100 mb-2">Time to First Lead</div>
                    <div className="flex items-end gap-4">
                      <div>
                        <div className="text-xs text-blue-100 mb-1">Traditional</div>
                        <div className="text-2xl font-bold">4-6 weeks</div>
                      </div>
                      <div className="text-white/50 text-2xl">→</div>
                      <div>
                        <div className="text-xs text-blue-100 mb-1">ACME CORP</div>
                        <div className="text-2xl font-bold text-green-300">24 hours</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-green-500/20 rounded-lg border border-green-500/30">
                  <div className="text-sm font-semibold text-green-100">Average First Year Savings</div>
                  <div className="text-3xl font-bold text-green-300 mt-2">R960,000+</div>
                  <div className="text-xs text-green-100 mt-1">Per $1M annual pipeline</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 via-blue-400 to-purple-400" />
    </section>
  );
}
