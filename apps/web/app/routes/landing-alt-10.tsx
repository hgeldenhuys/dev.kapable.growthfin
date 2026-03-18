import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt10 } from '~/components/landing-alt-10/HeroSectionAlt10';
import { BrutalFeaturesAlt10 } from '~/components/landing-alt-10/BrutalFeaturesAlt10';
import { DemoFormAlt10 } from '~/components/landing-alt-10/DemoFormAlt10';
import { FooterAlt10 } from '~/components/landing-alt-10/FooterAlt10';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP | NO MORE BAD LEADS' },
    { name: 'description', content: 'Stop wasting money on agencies. Get results.' },
  ];
}

export default function LandingAlt10() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-10');
    // Force HMR update
  }, []);

  return (
    <div className="min-h-screen bg-[#E0E7F1] text-black font-sans border-[20px] border-black box-border">
      <NavigationBar />
      <HeroSectionAlt10 />
      <BrutalFeaturesAlt10 />
      <DemoFormAlt10 />
      <FooterAlt10 />
    </div>
  );
}
