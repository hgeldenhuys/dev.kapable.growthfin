import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt5 } from '~/components/landing-alt-5/HeroSectionAlt5';
import { EvolutionSectionAlt5 } from '~/components/landing-alt-5/EvolutionSectionAlt5';
import { FeaturesAlt5 } from '~/components/landing-alt-5/FeaturesAlt5';
import { DemoFormAlt5 } from '~/components/landing-alt-5/DemoFormAlt5';
import { FooterAlt5 } from '~/components/landing-alt-5/FooterAlt5';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP - The Evolution of Sales | AI Intelligence' },
    {
      name: 'description',
      content: 'Stop playing the numbers game. Start playing the intelligence game. The future of sales development is here.'
    },
    { property: 'og:title', content: 'ACME CORP - The Evolution of Sales' },
    { property: 'og:description', content: 'Experience the next generation of sales development.' },
    { property: 'og:type', content: 'website' },
  ];
}

export default function LandingAlt5() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-5');
    // Force HMR update
  }, []);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-orange-500 selection:text-white overflow-x-hidden">
      <NavigationBar />
      <HeroSectionAlt5 />
      <EvolutionSectionAlt5 />
      <FeaturesAlt5 />
      <DemoFormAlt5 />
      <FooterAlt5 />
    </div>
  );
}
