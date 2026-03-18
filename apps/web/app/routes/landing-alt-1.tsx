import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt1 } from '~/components/landing-alt-1/HeroSectionAlt1';
import { ProofSectionAlt1 } from '~/components/landing-alt-1/ProofSectionAlt1';
import { ComparisonSectionAlt1 } from '~/components/landing-alt-1/ComparisonSectionAlt1';
import { ResultsSectionAlt1 } from '~/components/landing-alt-1/ResultsSectionAlt1';
import { ProcessSectionAlt1 } from '~/components/landing-alt-1/ProcessSectionAlt1';
import { PricingAlt1 } from '~/components/landing-alt-1/PricingAlt1';
import { DemoFormAlt1 } from '~/components/landing-alt-1/DemoFormAlt1';
import { FooterAlt1 } from '~/components/landing-alt-1/FooterAlt1';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP - Increase Sales Pipeline by 60% | AI Sales Development' },
    {
      name: 'description',
      content: 'See exactly how much revenue you can generate. AI-powered SDaaS proven to deliver 60% cost reduction and 15% conversion rates. Free ROI calculator.'
    },
    { property: 'og:title', content: 'ACME CORP - Increase Pipeline 60% Less Cost' },
    { property: 'og:description', content: 'Proven results: 60% cost reduction, 15% conversion, R2M+ pipeline. See your potential ROI in 2 minutes.' },
    { property: 'og:type', content: 'website' },
  ];
}

export default function LandingAlt1() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-1');
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <NavigationBar />
      <HeroSectionAlt1 />
      <ProofSectionAlt1 />
      <ComparisonSectionAlt1 />
      <ResultsSectionAlt1 />
      <ProcessSectionAlt1 />
      <PricingAlt1 />
      <DemoFormAlt1 />
      <FooterAlt1 />
    </div>
  );
}
