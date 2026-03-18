import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt8 } from '~/components/landing-alt-8/HeroSectionAlt8';
import { SpeedMetricsAlt8 } from '~/components/landing-alt-8/SpeedMetricsAlt8';
import { DemoFormAlt8 } from '~/components/landing-alt-8/DemoFormAlt8';
import { FooterAlt8 } from '~/components/landing-alt-8/FooterAlt8';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP | Velocity' },
    { name: 'description', content: 'Deploy an AI sales team in minutes, not months.' },
  ];
}

export default function LandingAlt8() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-8');
    // Force HMR update
  }, []);

  return (
    <div className="min-h-screen bg-yellow-400 text-black font-sans selection:bg-black selection:text-yellow-400">
      <NavigationBar />
      <HeroSectionAlt8 />
      <SpeedMetricsAlt8 />
      <DemoFormAlt8 />
      <FooterAlt8 />
    </div>
  );
}
