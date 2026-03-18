import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { ArrowRight, Calculator } from 'lucide-react';
import { trackEvent } from '~/lib/posthog';

export function HeroSection() {
  const [showROIDialog, setShowROIDialog] = useState(false);

  const handlePrimaryCTA = () => {
    trackEvent('cta_clicked', {
      location: 'hero',
      variant: 'primary',
      text: 'Book Your Strategy Call'
    });
    // Scroll to demo form
    document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSecondaryCTA = () => {
    trackEvent('cta_clicked', {
      location: 'hero',
      variant: 'secondary',
      text: 'Calculate Your ROI'
    });
    setShowROIDialog(true);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-growthfin-primary to-growthfin-secondary pt-16">
      <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(white,transparent_80%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center">
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight">
            Scale Your Outbound 10x
            <br />
            <span className="text-white/90">Without Adding Headcount</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-xl sm:text-2xl text-white/90 max-w-3xl mx-auto">
            AI-powered SDR teams that book qualified meetings while you sleep
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              onClick={handlePrimaryCTA}
              className="bg-white text-growthfin-primary hover:bg-white/90 font-semibold px-8 py-6 text-lg min-h-[44px] w-full sm:w-auto"
            >
              Book Your Strategy Call
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleSecondaryCTA}
              className="border-2 border-white bg-transparent text-white hover:bg-white hover:text-growthfin-primary font-semibold px-8 py-6 text-lg min-h-[44px] w-full sm:w-auto transition-colors"
            >
              <Calculator className="mr-2 h-5 w-5" />
              Calculate Your ROI
            </Button>
          </div>

          {/* Trust Bar */}
          <div className="mt-16 pt-8 border-t border-white/20">
            <p className="text-white/70 text-sm font-medium mb-4">
              TRUSTED BY 500+ B2B SALES TEAMS
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 text-white/60 text-lg font-semibold">
              <div>R2M+ Pipeline Generated</div>
              <div className="hidden sm:block">•</div>
              <div>60% Cost Reduction</div>
              <div className="hidden sm:block">•</div>
              <div>15% Conversion Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
          <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" className="fill-gray-50 dark:fill-gray-900"/>
        </svg>
      </div>

      {/* ROI Calculator Dialog */}
      <Dialog open={showROIDialog} onOpenChange={setShowROIDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ROI Calculator Coming Soon</DialogTitle>
            <DialogDescription>
              Our interactive ROI calculator is currently in development. In the meantime, book a strategy call to get a personalized ROI analysis for your business.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowROIDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowROIDialog(false);
              handlePrimaryCTA();
            }}>
              Book Strategy Call
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
