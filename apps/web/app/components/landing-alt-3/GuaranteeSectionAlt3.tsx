import { Shield, CheckCircle2, AlertCircle, Target, Zap } from 'lucide-react';

export function GuaranteeSectionAlt3() {
  const guarantees = [
    {
      title: 'Delivery Guarantee',
      description: 'We guarantee minimum delivery of 20-30 qualified meetings per month within first 90 days, or you pay nothing.',
      badge: 'SLA Backed'
    },
    {
      title: 'Quality Guarantee',
      description: 'Review and reject up to 5% of meetings at no charge. If we send unqualified leads, you keep your money.',
      badge: 'You Control Quality'
    },
    {
      title: 'Transparency Guarantee',
      description: "Access to all data, messages, and research. No black box. If you ask 'show me', we show you everything.",
      badge: 'Full Visibility'
    },
    {
      title: 'Performance Guarantee',
      description: 'If conversion rates fall below 12% for 2 consecutive months, we refund 20% of your last invoice.',
      badge: 'Skin in the Game'
    }
  ];

  const slas = [
    {
      metric: 'Setup Time',
      commitment: '24-48 hours',
      industry: '4-6 weeks'
    },
    {
      metric: 'First Meeting',
      commitment: '7-14 days',
      industry: '6-12 weeks'
    },
    {
      metric: 'Avg. Conversion Rate',
      commitment: '12-18%',
      industry: '2-5%'
    },
    {
      metric: 'Cost per Meeting',
      commitment: 'R400-600',
      industry: 'R800-1200'
    },
    {
      metric: 'Acceptance Rate',
      commitment: '>95%',
      industry: '70-80%'
    },
    {
      metric: 'Dashboard Updates',
      commitment: 'Real-time',
      industry: 'Weekly reports'
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-slate-950/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">RISK-FREE GUARANTEES</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            We Put Our Money Where Our Mouth Is
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Unlike hiring SDRs (where you pay even if they fail), we guarantee results or you don't pay.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {guarantees.map((guarantee, idx) => (
            <div
              key={idx}
              className="group relative overflow-hidden rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 p-8 hover:shadow-xl transition-all duration-300"
            >
              {/* Accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-gray-950 dark:text-white">
                      {guarantee.title}
                    </h3>
                    <span className="inline-block px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-semibold">
                      {guarantee.badge}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-400 leading-relaxed">
                    {guarantee.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SLA Comparison Table */}
        <div className="bg-white dark:bg-gray-900 border rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6" />
              <div>
                <h3 className="text-xl font-bold">Service Level Agreements</h3>
                <p className="text-white/90 text-sm">Our commitments vs. industry standard</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-gray-950 dark:text-white">Metric</h4>
                {slas.map((sla, idx) => (
                  <div key={idx} className={`py-2 ${idx < slas.length - 1 ? 'border-b border-gray-200 dark:border-gray-800' : ''}`}>
                    <div className="font-semibold">{sla.metric}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-lg text-purple-600 flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  ACME CORP SLA
                </h4>
                {slas.map((sla, idx) => (
                  <div key={idx} className={`py-2 ${idx < slas.length - 1 ? 'border-b border-gray-200 dark:border-gray-800' : ''}`}>
                    <div className="font-semibold text-gray-950 dark:text-white">{sla.commitment}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-lg text-gray-500 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Industry Standard
                </h4>
                {slas.map((sla, idx) => (
                  <div key={idx} className={`py-2 ${idx < slas.length - 1 ? 'border-b border-gray-200 dark:border-gray-800' : ''}`}>
                    <div className="text-gray-700 dark:text-gray-400">{sla.industry}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* The Bottom Line */}
        <div className="mt-16 relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-900 dark:to-indigo-900 text-white rounded-2xl p-8 sm:p-12 border border-white/20">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl font-bold mb-4">Why We Can Offer These Guarantees</h3>
            <p className="text-xl text-indigo-100 mb-8">
              We've done this 500+ times. We know exactly what works, what doesn't, and how long it takes.
              Our system is proven. We don't guess—we execute a repeatable process.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-yellow-300">500+</div>
                <div className="text-indigo-100">Successful Deployments</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-yellow-300">95%</div>
                <div className="text-indigo-100">Client Retention</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-yellow-300">15%</div>
                <div className="text-indigo-100">Avg. Conversion Rate</div>
              </div>
            </div>

            <div className="mt-8 p-6 bg-white/10 backdrop-blur rounded-xl border border-white/20">
              <p className="text-lg font-semibold">
                "We can offer these guarantees because our system works. Period. If it doesn't work for you,
                we shouldn't get paid. That's how confident we are."
              </p>
              <p className="text-sm text-indigo-200 mt-2">— ACME CORP Team</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
