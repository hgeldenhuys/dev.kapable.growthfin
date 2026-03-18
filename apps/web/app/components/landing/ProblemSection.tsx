import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { TrendingUp, DollarSign, Target } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { trackEvent } from '~/lib/posthog';

const painPoints = [
  {
    id: 'scale',
    icon: TrendingUp,
    title: 'Stuck at 100 Leads/Day?',
    description: 'Manual SDR teams max out quickly. Scale to 20,000+ with AI.',
    stat: '100 → 20,000',
    color: 'text-growthfin-primary'
  },
  {
    id: 'cost',
    icon: DollarSign,
    title: 'R100+ Per Qualified Lead?',
    description: 'Cut costs by 60% with intelligent AI research and qualification.',
    stat: '60% reduction',
    color: 'text-growthfin-secondary'
  },
  {
    id: 'quality',
    icon: Target,
    title: '2-5% Conversion Rates?',
    description: 'Achieve 15% with AI-powered personalization and timing.',
    stat: '15% achievable',
    color: 'text-growthfin-success'
  }
];

export function ProblemSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackEvent('section_viewed', {
              section: 'problem',
              scroll_depth: Math.round((window.scrollY / document.body.scrollHeight) * 100)
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 sm:py-32 bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-growthfin-dark dark:text-white">
            The Challenge B2B Sales Teams Face
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Traditional SDR teams hit hard limits. ACME CORP breaks through them.
          </p>
        </div>

        {/* Pain Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {painPoints.map((point) => {
            const Icon = point.icon;
            return (
              <Card key={point.id} className="border-2 hover:border-growthfin-primary transition-all hover:shadow-lg dark:bg-gray-800 dark:border-gray-700">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-growthfin-primary to-growthfin-secondary flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-growthfin-dark dark:text-white">
                    {point.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-300 mb-4">
                    {point.description}
                  </CardDescription>
                  <div className="text-3xl font-bold bg-gradient-to-r from-growthfin-primary to-growthfin-secondary bg-clip-text text-transparent">
                    {point.stat}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
