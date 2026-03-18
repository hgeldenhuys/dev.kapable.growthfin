import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt6 } from '~/components/landing-alt-6/HeroSectionAlt6';
import { MinimalGridAlt6 } from '~/components/landing-alt-6/MinimalGridAlt6';
import { StatsAlt6 } from '~/components/landing-alt-6/StatsAlt6';
import { DemoFormAlt6 } from '~/components/landing-alt-6/DemoFormAlt6';
import { FooterAlt6 } from '~/components/landing-alt-6/FooterAlt6';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP. Pure Performance.' },
    {
      name: 'description',
      content: 'Growth, simplified. Enterprise-grade sales development without the noise.'
    },
    { property: 'og:title', content: 'ACME CORP.' },
    { property: 'og:description', content: 'Pure performance.' },
    { property: 'og:type', content: 'website' },
  ];
}

export default function LandingAlt6() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-6');
    // Force HMR update
  }, []);

  return (
    <div className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 font-sans tracking-tight antialiased">
      <NavigationBar />
      <HeroSectionAlt6 />
      <StatsAlt6 />
      <MinimalGridAlt6 />
      <DemoFormAlt6 />
      <FooterAlt6 />
    </div>
  );
}
