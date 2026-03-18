import { Zap, Clock, TrendingUp, CheckCircle2, ArrowRight, Rocket } from 'lucide-react';

export function SpeedToValueAlt4() {
  const timeline = [
    {
      day: 'Day 1',
      title: 'AI Setup & Integration',
      description: 'Connect your CRM, define ICP, and configure neural architecture. Takes 2-4 hours, not weeks.',
      status: 'complete',
      metrics: '99.9% setup success rate'
    },
    {
      day: 'Day 2-3',
      title: 'Neural Training',
      description: 'AI analyzes your ideal customer profile, historical data, and market signals. Creates custom prospect intelligence.',
      status: 'in-progress',
      metrics: '500M+ data points processed'
    },
    {
      day: 'Day 4-5',
      title: 'Prospect Research',
      description: 'AI identifies and scores prospects using neural matching. Human verification ensures quality.',
      status: 'pending',
      metrics: '2,000+ prospects evaluated per day'
    },
    {
      day: 'Day 6-7',
      title: 'First Qualified Meetings',
      description: 'Multi-channel sequences launch. AI handles conversations, qualifies leads, and schedules meetings.',
      status: 'pending',
      metrics: 'Expected: 8-15 meetings by day 7'
    }
  ];

  const speedStats = [
    {
      value: '7 Days',
      label: 'Time to First Meeting',
      sublabel: 'vs 6-12 weeks traditional',
      icon: Clock,
      color: 'blue'
    },
    {
      value: '24 Hours',
      label: 'Setup Time',
      sublabel: 'vs 4-6 weeks for SDRs',
      icon: Zap,
      color: 'indigo'
    },
    {
      value: '15x',
      label: 'Faster Ramp',
      sublabel: 'than hiring SDR team',
      icon: TrendingUp,
      color: 'purple'
    },
    {
      value: '0',
      label: 'Training Required',
      sublabel: 'No onboarding needed',
      icon: CheckCircle2,
      color: 'blue'
    }
  ];

  const comparison = [
    {
      aspect: 'Time to First Meeting',
      traditional: '6-12 weeks',
      growthfin: '7 days',
      winner: 'growthfin'
    },
    {
      aspect: 'Time to Full Capacity',
      traditional: '12-16 weeks',
      growthfin: '2-3 weeks',
      winner: 'growthfin'
    },
    {
      aspect: 'Cost to Ramp',
      traditional: 'R120K-200K',
      growthfin: 'R0',
      winner: 'growthfin'
    },
    {
      aspect: 'Performance Variance',
      traditional: '±60% month-to-month',
      growthfin: '±5% month-to-month',
      winner: 'growthfin'
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <Rocket className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">LIGHTNING-FAST DEPLOYMENT</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            From Signup to Qualified Meetings in 7 Days
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            No months of hiring, training, and ramp-up time. Our AI is ready to work from day one.
          </p>
        </div>

        {/* Speed statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {speedStats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    stat.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    stat.color === 'indigo' ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                    'bg-purple-100 dark:bg-purple-900/30'
                  }`}>
                    <Icon className={`h-6 w-6 ${
                      stat.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                      stat.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
                      'text-purple-600 dark:text-purple-400'
                    }`} />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white mb-1">
                  {stat.value}
                </div>
                <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {stat.label}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {stat.sublabel}
                </div>
              </div>
            );
          })}
        </div>

        {/* 7-day timeline */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-gray-950 dark:text-white text-center mb-12">
            Your First Week with ACME CORP AI
          </h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-500 transform md:-translate-x-0.5"></div>

            <div className="space-y-12">
              {timeline.map((item, idx) => (
                <div key={idx} className={`relative flex items-start gap-6 ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                  {/* Timeline dot */}
                  <div className="absolute left-4 md:left-1/2 w-4 h-4 rounded-full bg-white dark:bg-gray-900 border-4 border-blue-500 transform md:-translate-x-2 z-10"></div>

                  {/* Content card */}
                  <div className={`ml-12 md:ml-0 flex-1 ${idx % 2 === 0 ? 'md:mr-8 md:text-right' : 'md:ml-8'}`}>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 hover:shadow-xl transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                          item.status === 'complete' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                          item.status === 'in-progress' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                          'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}>
                          {item.day}
                        </div>
                        <h4 className="text-lg font-bold text-gray-950 dark:text-white">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-gray-700 dark:text-gray-400 mb-3">
                        {item.description}
                      </p>
                      <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {item.metrics}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Speed comparison table */}
        <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950 text-white rounded-2xl p-8 sm:p-12">
          <h3 className="text-2xl font-bold text-center mb-8">Speed Comparison: AI vs Traditional</h3>

          <div className="space-y-4">
            {comparison.map((item, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="font-semibold">{item.aspect}</div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-1">Traditional SDR Hire</div>
                    <div className="font-bold text-red-300">{item.traditional}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-1">ACME CORP AI</div>
                    <div className="font-bold text-green-300 flex items-center justify-center gap-2">
                      {item.growthfin}
                      {item.winner === 'growthfin' && <ArrowRight className="h-4 w-4" />}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <div className="inline-block bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-6 border border-blue-500/30">
              <Zap className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <div className="text-2xl font-bold mb-2">Ready to Start Today?</div>
              <p className="text-gray-300 text-sm mb-4">
                Unlike hiring SDRs, there's no "ramp period" with ACME CORP. Our AI is already trained and ready to work.
              </p>
              <div className="text-sm text-blue-300">
                <strong>Setup Time:</strong> 2-4 hours | <strong>First Results:</strong> 7 days | <strong>Full Capacity:</strong> 2-3 weeks
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}