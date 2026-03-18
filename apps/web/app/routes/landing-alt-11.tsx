import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSection } from '~/components/landing/HeroSection';
import { ProblemSection } from '~/components/landing/ProblemSection';
import { SolutionSection } from '~/components/landing/SolutionSection';
import { FeaturesSection } from '~/components/landing/FeaturesSection';
import { PricingSection } from '~/components/landing/PricingSection';
import { DemoFormSection } from '~/components/landing/DemoFormSection';
import { Footer } from '~/components/landing/Footer';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP - AI-Powered Sales Development Platform | Scale Outbound 10x' },
    {
      name: 'description',
      content: 'Book more qualified meetings with AI SDR teams. 60% cost reduction, 15% conversion rates. POPIA-compliant. Book a demo today.'
    },
    { property: 'og:title', content: 'ACME CORP - Scale Your Outbound 10x Without Adding Headcount' },
    { property: 'og:description', content: 'AI-powered SDR teams that book qualified meetings while you sleep' },
    { property: 'og:type', content: 'website' },
  ];
}

export default function LandingAlt11() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-11');
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <NavigationBar />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <PricingSection />
      <DemoFormSection />
      <Footer />
    </div>
  );
}
