import { Zap, Shield, BarChart3, Smartphone } from 'lucide-react';

export function FeaturesSectionAlt2() {
  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast Deployment',
      description: 'Set up in 24 hours instead of weeks. Connect your CRM, define your ICP, and you\'re live.'
    },
    {
      icon: Shield,
      title: 'POPIA Compliant',
      description: 'Meets South African data protection regulations. Enterprise-grade security for your prospect data.'
    },
    {
      icon: BarChart3,
      title: 'Real-Time Analytics',
      description: 'Track every metric that matters. See exactly how many qualified meetings you\'re generating per dollar spent.'
    },
    {
      icon: Smartphone,
      title: 'Multi-Channel Integration',
      description: 'Works with every major CRM, email platform, and communication channel your team uses.'
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            Built for Modern Sales Teams
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Enterprise features without the enterprise complexity or price tag
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="relative flex gap-6 p-8 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-gray-50 dark:from-gray-900 dark:to-gray-900 hover:border-teal-300 dark:hover:border-teal-700 transition-colors group"
              >
                {/* Left accent */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-teal-500 to-emerald-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex-shrink-0 mt-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-950 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
