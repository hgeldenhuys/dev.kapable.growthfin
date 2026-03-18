import { useEffect, useRef } from 'react';
import { Card } from '~/components/ui/card';
import { Star } from 'lucide-react';
import { trackEvent } from '~/lib/posthog';

const testimonials = [
  {
    id: 1,
    quote: "We increased our qualified meetings from 50 to 500 per month in 90 days. ACME CORP cut our cost per lead by 65%.",
    author: "Sarah Chen",
    title: "VP Sales",
    company: "TechCorp",
    metric: "+900% ROI",
    color: "from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30"
  },
  {
    id: 2,
    quote: "The AI-to-human handoffs are seamless. Our SDRs spend less time on research and more time on selling.",
    author: "Marcus Johnson",
    title: "Sales Manager",
    company: "Growth Agency",
    metric: "2.5x Productivity",
    color: "from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30"
  },
  {
    id: 3,
    quote: "We tried other platforms. ACME CORP's compliance is built-in, not bolted on. POPIA compliance out of the box.",
    author: "Amelia Okafor",
    title: "Chief Revenue Officer",
    company: "Professional Services",
    metric: "Zero Compliance Risk",
    color: "from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30"
  }
];

export function ProofSectionAlt1() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackEvent('section_viewed', {
              section: 'proof',
              scroll_depth: Math.round((window.scrollY / document.body.scrollHeight) * 100),
              test_variant: 'alt-1'
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="proof-section" ref={sectionRef} className="py-20 sm:py-32 bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Customers See Results Immediately
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Real results from real companies using ACME CORP
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className={`bg-gradient-to-br ${testimonial.color} border-0 p-8 hover:shadow-lg transition-shadow`}>
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-6">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="border-t border-gray-300 dark:border-gray-700 pt-6">
                <div className="font-semibold text-gray-900 dark:text-white">{testimonial.author}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{testimonial.title}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">{testimonial.company}</div>
                <div className="inline-block bg-green-500/20 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-sm font-semibold">
                  {testimonial.metric}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Trust Bar */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-8 border border-blue-200 dark:border-blue-800/50">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Trusted by Industry Leaders
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-center justify-center">
              {['TechCorp', 'Growth Inc', 'Sales Pro', 'Enterprise Co', 'Scale Up Ltd'].map((name) => (
                <div key={name} className="text-gray-600 dark:text-gray-400 font-medium">
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
