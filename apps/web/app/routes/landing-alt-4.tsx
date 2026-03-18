import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt4 } from '~/components/landing-alt-4/HeroSectionAlt4';
import { AIIntelligenceSectionAlt4 } from '~/components/landing-alt-4/AIIntelligenceSectionAlt4';
import { EnterpriseProofAlt4 } from '~/components/landing-alt-4/EnterpriseProofAlt4';
import { SpeedToValueAlt4 } from '~/components/landing-alt-4/SpeedToValueAlt4';
import { TechnicalFeaturesAlt4 } from '~/components/landing-alt-4/TechnicalFeaturesAlt4';
import { DemoFormAlt4 } from '~/components/landing-alt-4/DemoFormAlt4';
import { FooterAlt4 } from '~/components/landing-alt-4/FooterAlt4';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP - Enterprise AI SDR Intelligence | Neural Prospect Matching' },
    {
      name: 'description',
      content: 'Enterprise-grade AI with 3-tier neural architecture. 99.9% uptime, 24/7 learning, 7-day setup. Built for Fortune 500 companies.'
    },
    { property: 'og:title', content: 'ACME CORP - Enterprise AI SDR Intelligence Platform' },
    { property: 'og:description', content: 'Advanced neural networks, real-time optimization, multi-channel orchestration. See live AI in action.' },
    { property: 'og:type', content: 'website' },
  ];
}

export default function LandingAlt4() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-4');
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <NavigationBar />
      <HeroSectionAlt4 />
      <AIIntelligenceSectionAlt4 />
      <EnterpriseProofAlt4 />
      <SpeedToValueAlt4 />
      <TechnicalFeaturesAlt4 />
      <DemoFormAlt4 />
      <FooterAlt4 />
    </div>
  );
}