import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt9 } from '~/components/landing-alt-9/HeroSectionAlt9';
import { BlueprintGridAlt9 } from '~/components/landing-alt-9/BlueprintGridAlt9';
import { DemoFormAlt9 } from '~/components/landing-alt-9/DemoFormAlt9';
import { FooterAlt9 } from '~/components/landing-alt-9/FooterAlt9';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP | The Blueprint' },
    { name: 'description', content: 'Systematic revenue architecture for modern companies.' },
  ];
}

export default function LandingAlt9() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-9');
    // Force HMR update
  }, []);

  return (
    <div className="min-h-screen bg-[#0a192f] text-[#64ffda] font-mono selection:bg-[#64ffda] selection:text-[#0a192f]">
      <NavigationBar />
      <HeroSectionAlt9 />
      <BlueprintGridAlt9 />
      <DemoFormAlt9 />
      <FooterAlt9 />
    </div>
  );
}
