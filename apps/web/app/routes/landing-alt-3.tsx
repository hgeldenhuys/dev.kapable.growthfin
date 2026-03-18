import { useEffect } from 'react';
import type { Route } from './+types/landing';
import { initPostHog, trackPageView } from '~/lib/posthog';
import { NavigationBar } from '~/components/landing/NavigationBar';
import { HeroSectionAlt3 } from '~/components/landing-alt-3/HeroSectionAlt3';
import { HiringPainSectionAlt3 } from '~/components/landing-alt-3/HiringPainSectionAlt3';
import { TransparentProcessAlt3 } from '~/components/landing-alt-3/TransparentProcessAlt3';
import { GuaranteeSectionAlt3 } from '~/components/landing-alt-3/GuaranteeSectionAlt3';
import { CaseStudiesSectionAlt3 } from '~/components/landing-alt-3/CaseStudiesSectionAlt3';
import { DemoFormAlt3 } from '~/components/landing-alt-3/DemoFormAlt3';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'ACME CORP - Performance-Based SDRs | Pay Only for Results' },
    {
      name: 'description',
      content: 'Zero hiring risk with AI SDRs. 15% conversion rate guaranteed. 60% cost reduction. Only pay for qualified meetings you keep. 24-hour setup.'
    },
    { property: 'og:title', content: 'ACME CORP - Pay Only for Qualified Meetings You Keep' },
    { property: 'og:description', content: 'Performance-based AI SDRs with guarantees. No setup fees. Transparent pricing. 24-48 hour setup.' },
    { property: 'og:type', content: 'website' },
  ];
}

export default function LandingAlt3() {
  useEffect(() => {
    initPostHog();
    trackPageView('landing-alt-3');
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <NavigationBar />
      <HeroSectionAlt3 />
      <HiringPainSectionAlt3 />
      <TransparentProcessAlt3 />
      <GuaranteeSectionAlt3 />
      <CaseStudiesSectionAlt3 />
      <DemoFormAlt3 />
    </div>
  );
}