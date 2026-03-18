import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt2 } from '~/components/landing-alt-2/HeroSectionAlt2';
import { ProblemSectionAlt2 } from '~/components/landing-alt-2/ProblemSectionAlt2';
import { SolutionSectionAlt2 } from '~/components/landing-alt-2/SolutionSectionAlt2';
import { FeaturesSectionAlt2 } from '~/components/landing-alt-2/FeaturesSectionAlt2';
import { PricingSectionAlt2 } from '~/components/landing-alt-2/PricingSectionAlt2';
import { DemoFormAlt2 } from '~/components/landing-alt-2/DemoFormAlt2';
import { FooterAlt2 } from '~/components/landing-alt-2/FooterAlt2';

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

export default function LandingAlt2() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-2');
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <NavigationBar />
      <HeroSectionAlt2 />
      <ProblemSectionAlt2 />
      <SolutionSectionAlt2 />
      <FeaturesSectionAlt2 />
      <PricingSectionAlt2 />
      <DemoFormAlt2 />
      <FooterAlt2 />
    </div>
  );
}
