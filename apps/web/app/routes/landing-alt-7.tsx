import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt7 } from '~/components/landing-alt-7/HeroSectionAlt7';
import { HarmonySectionAlt7 } from '~/components/landing-alt-7/HarmonySectionAlt7';
import { TestimonialAlt7 } from '~/components/landing-alt-7/TestimonialAlt7';
import { DemoFormAlt7 } from '~/components/landing-alt-7/DemoFormAlt7';
import { FooterAlt7 } from '~/components/landing-alt-7/FooterAlt7';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP - Reclaim the Human Connection' },
    {
      name: 'description',
      content: 'Let AI handle the data. You handle the handshake. The human-centric approach to automated sales.'
    },
    { property: 'og:title', content: 'ACME CORP - Human Connection' },
    { property: 'og:description', content: 'Reclaim your time for what matters.' },
    { property: 'og:type', content: 'website' },
  ];
}

export default function LandingAlt7() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-7');
    // Force HMR update
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100 font-sans">
      <NavigationBar />
      <HeroSectionAlt7 />
      <HarmonySectionAlt7 />
      <TestimonialAlt7 />
      <DemoFormAlt7 />
      <FooterAlt7 />
    </div>
  );
}
