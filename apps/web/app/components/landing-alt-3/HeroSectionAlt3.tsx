import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { ArrowRight, Sparkles, CheckCircle, Star } from 'lucide-react';
import { trackEvent } from '~/lib/posthog';

export function HeroSectionAlt3() {
  const [showVideoDialog, setShowVideoDialog] = useState(false);

  const handlePrimaryCTA = () => {
    trackEvent('cta_clicked', {
      location: 'hero',
      variant: 'primary',
      text: 'Get Your Performance Analysis',
      test_variant: 'alt-3'
    });
    document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSecondaryCTA = () => {
    trackEvent('cta_clicked', {
      location: 'hero',
      variant: 'secondary',
      text: 'Watch 90-Second Demo',
      test_variant: 'alt-3'
    });
    setShowVideoDialog(true);
  };

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-900 dark:to-indigo-900 pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="text-white">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-4 py-2 mb-6 w-fit">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-semibold">Customer Verified Results</span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                Pay Only for Qualified
                <br />
                <span className="text-yellow-300">Meetings You Keep</span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl sm:text-2xl text-blue-50 mb-8 max-w-2xl leading-relaxed">
                Zero hiring risk. 15% conversion rate. Live dashboard showing real results. If we don't deliver, you don't pay.
              </p>

              {/* Real-time Social Proof */}
              <div className="grid grid-cols-3 gap-4 mb-10 py-6 border-y border-white/20">
                <div className="text-center">
                  <div className="text-3xl font-bold">500+</div>
                  <div className="text-sm text-blue-100">Teams Trust Us</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    <span className="animate-pulse">→</span>95%
                  </div>
                  <div className="text-sm text-blue-100">Keep First Meeting</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">15%</div>
                  <div className="text-sm text-blue-100">Avg. Conversion</div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={handlePrimaryCTA}
                  className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 font-bold px-8 py-6 text-lg min-h-[44px] w-full sm:w-auto"
                >
                  Get Your Performance Analysis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleSecondaryCTA}
                  className="border-2 border-white bg-transparent text-white hover:bg-white hover:text-purple-600 font-semibold px-8 py-6 text-lg min-h-[44px] w-full sm:w-auto transition-colors"
                >
                  <Star className="mr-2 h-5 w-5" />
                  Watch 90-Second Demo
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="mt-8 flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
                  <CheckCircle className="h-4 w-4 text-green-300" />
                  <span className="text-sm text-blue-50">No Setup Fees</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
                  <CheckCircle className="h-4 w-4 text-green-300" />
                  <span className="text-sm text-blue-50">Cancel Anytime</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
                  <CheckCircle className="h-4 w-4 text-green-300" />
                  <span className="text-sm text-blue-50">Live Dashboard</span>
                </div>
              </div>
            </div>

            {/* Right: Performance Card */}
            <div className="hidden lg:block">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
                <div className="text-white">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-300" />
                    Performance Commitment
                  </h3>

                  <div className="space-y-6">
                    <div className="border-b border-white/20 pb-6">
                      <div className="text-sm text-blue-100 mb-2">Qualified Meetings per Month</div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold">Guaranteed:</span>
                        <span className="text-3xl font-bold text-yellow-300">20-30+</span>
                      </div>
                    </div>

                    <div className="border-b border-white/20 pb-6">
                      <div className="text-sm text-blue-100 mb-2">Cost per Meeting</div>
                      <div className="flex items-end gap-4">
                        <div>
                          <div className="text-xs text-blue-100 mb-1">Traditional Process</div>
                          <div className="text-2xl font-bold">R800-1200</div>
                        </div>
                        <div className="text-white/50 text-2xl">→</div>
                        <div>
                          <div className="text-xs text-blue-100 mb-1">ACME CORP</div>
                          <div className="text-2xl font-bold text-green-300">R400-600</div>
                        </div>
                      </div>
                    </div>

                    <div className="pb-6">
                      <div className="text-sm text-blue-100 mb-2">Quality Guarantee</div>
                      <div className="text-green-300 text-2xl font-bold">95% Acceptance</div>
                      <div className="text-xs text-blue-100 mt-1">You can reject 5% of meetings (no charge)</div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-yellow-400/20 rounded-lg border border-yellow-400/40">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-yellow-300" />
                      <div className="text-sm font-semibold text-yellow-100">Transparent Pricing</div>
                    </div>
                    <div className="text-yellow-300 text-3xl font-bold">R8,000-12,000</div>
                    <div className="text-xs text-yellow-100 mt-1">Per qualified meeting (only pay for kept meetings)</div>
                    <div className="text-xs text-yellow-100">No retainer or setup fees</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Simplified Demo Overview</DialogTitle>
            <DialogDescription>
              Watch a quick 90-second demo of how ACME CORP generates qualified meetings for your business.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl h-96 flex items-center justify-center">
            <div className="text-center">
              <Star className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">
                Demo video placeholder. In production, this would show the actual ACME CORP platform demo.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowVideoDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowVideoDialog(false);
                handlePrimaryCTA();
              }}
            >
              Book Performance Analysis
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
