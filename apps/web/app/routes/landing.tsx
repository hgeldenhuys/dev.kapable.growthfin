import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBarResend } from '~/components/landing-resend/NavigationBarResend';
import { HeroResend } from '~/components/landing-resend/HeroResend';
import { ProductPreviewResend } from '~/components/landing-resend/ProductPreviewResend';
import { FeaturesResend } from '~/components/landing-resend/FeaturesResend';
import { Button } from '~/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'GrowthFin - Modern Sales Infrastructure' },
    {
      name: 'description',
      content: 'The modern platform for high-growth sales teams. Book more qualified meetings with AI SDR teams.'
    },
  ];
}

export default function LandingPage() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-resend');
  }, []);

  return (
    <div className="min-h-screen bg-black font-sans selection:bg-zinc-800 selection:text-white">
      <NavigationBarResend />
      
      <main>
        <HeroResend />
        <ProductPreviewResend />
        <FeaturesResend />
        
        {/* CTA Section */}
        <section className="bg-black py-32">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">
              Ready to scale your outbound?
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="bg-white text-black hover:bg-zinc-200 h-12 px-8 text-base font-medium">
                Get Started for Free
              </Button>
              <Button size="lg" variant="ghost" className="text-white hover:bg-zinc-900 h-12 px-8 text-base font-medium group">
                Talk to Sales
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-black border-t border-zinc-900 py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-black rounded-sm" />
            </div>
            <span className="text-white font-semibold tracking-tight">GrowthFin</span>
          </div>
          
          <div className="flex gap-8 text-sm text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Status</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
          </div>
          
          <div className="text-sm text-zinc-500">
            © 2026 GrowthFin. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
