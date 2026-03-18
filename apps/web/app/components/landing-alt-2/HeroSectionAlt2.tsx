import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { trackEvent } from '~/lib/posthog';

export function HeroSectionAlt2() {
  const [showROIDialog, setShowROIDialog] = useState(false);

  const handlePrimaryCTA = () => {
    trackEvent('cta_clicked', { location: 'hero', variant: 'primary', test_variant: 'alt-2' });
    document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSecondaryCTA = () => {
    trackEvent('cta_clicked', { location: 'hero', variant: 'secondary', test_variant: 'alt-2' });
    setShowROIDialog(true);
  };

  return (
    <>
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-teal-50 dark:from-slate-950 dark:via-gray-950 dark:to-teal-950/20">
        {/* Accent elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-teal-200 dark:bg-teal-900/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-200 dark:bg-emerald-900/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="flex flex-col justify-center">
              <div className="inline-block mb-4">
                <span className="inline-block px-4 py-2 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-full text-sm font-semibold">
                  AI-Powered Sales Development
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-gray-950 dark:text-white leading-tight mb-6">
                10x Your <span className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">Outbound</span> Sales
              </h1>

              <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 mb-8 leading-relaxed max-w-lg">
                Book more qualified meetings without hiring. Our AI SDR team works 24/7, handling prospect research, multi-channel outreach, and qualification.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button
                  onClick={handlePrimaryCTA}
                  className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white font-bold py-6 text-lg min-h-[44px]"
                >
                  Book Your Strategy Call
                </Button>
                <Button
                  onClick={handleSecondaryCTA}
                  variant="outline"
                  className="border-2 border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 font-bold py-6 text-lg min-h-[44px]"
                >
                  Calculate Your ROI
                </Button>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                ✓ No credit card required • ✓ Demo in 5 minutes • ✓ POPIA compliant
              </p>
            </div>

            {/* Right Side - Stats Grid */}
            <div className="grid grid-cols-2 gap-4 lg:gap-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-4xl font-black text-teal-600 dark:text-teal-400 mb-2">60%</div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold">Cost Reduction</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Per qualified lead</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-2">15%</div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold">Conv. Rate</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">vs 2-5% industry</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:shadow-lg transition-shadow lg:col-span-2">
                <div className="text-3xl font-black text-teal-600 dark:text-teal-400 mb-2">24 Hours</div>
                <p className="text-gray-700 dark:text-gray-300 font-semibold">Setup Time</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">vs 4-6 weeks for manual teams</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Dialog */}
      <Dialog open={showROIDialog} onOpenChange={setShowROIDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ROI Calculator</DialogTitle>
            <DialogDescription>
              Our interactive ROI calculator is currently in development. We'll have it ready soon!
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              setShowROIDialog(false);
              handlePrimaryCTA();
            }}
            className="w-full bg-teal-600 hover:bg-teal-700"
          >
            Book Strategy Call Instead
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
