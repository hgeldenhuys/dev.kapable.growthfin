import { Users, Clock, DollarSign, TrendingDown, ShieldAlert, Brain } from 'lucide-react';

export function HiringPainSectionAlt3() {
  const problems = [
    {
      icon: DollarSign,
      title: 'Massive Upfront Costs',
      description: 'R50K-80K monthly for an SDR team (R25K base + commission per rep). Plus recruitment fees, onboarding costs, and benefits. Ongoing overhead regardless of performance.'
    },
    {
      icon: Clock,
      title: '6-12 Months to Profitability',
      description: '4-6 weeks hiring, 8-12 weeks training, 3-6 months to ramp. By month 6, you\'ve spent R250K+ per SDR before seeing consistent results. 35% quit within year 1.'
    },
    {
      icon: TrendingDown,
      title: 'Performance is Unpredictable',
      description: '20-50% of hires underperform despite interviewing and testing. One bad SDR hire can cost R120K+ in lost pipeline and sunk costs. No guarantees, no refunds.'
    },
    {
      icon: ShieldAlert,
      title: 'POPIA Compliance Risk',
      description: 'Building compliant outreach systems takes months. Each SDR training session creates risk. One violation = fines up to R10M + reputation damage. You carry all liability.'
    },
    {
      icon: Users,
      title: 'Impossible to Scale Fast',
      description: 'Need 2x meetings next quarter? Hire 2x more SDRs. Takes 3-4 months. Market shifts? You\'re stuck with overhead. Miss targets because you couldn\'t scale fast enough.'
    },
    {
      icon: Brain,
      title: 'Expertise is Rare & Expensive',
      description: 'Great SDRs cost R30K-40K base. They want career paths to AE. You pay premium rates for entry-level work. Then they leave for better opportunities.'
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            Why Traditional SDR Hiring is Broken
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Companies spend R250K-400K per SDR annually, yet 60% miss targets. You're paying for effort, not results.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {problems.map((problem, idx) => {
            const Icon = problem.icon;
            return (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 p-8 hover:shadow-xl transition-all duration-300"
              >
                {/* Failed attempt accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-orange-500 opacity-70"></div>

                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <Icon className="h-6 w-6 text-red-600 dark:text-orange-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-950 dark:text-white transition-colors">
                    {problem.title}
                  </h3>
                </div>

                <p className="text-gray-700 dark:text-gray-400 leading-relaxed">
                  {problem.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Cost comparison */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-purple-900 dark:to-indigo-900 text-white rounded-2xl p-8 sm:p-12 border border-white/20">
          <div className="text-center mb-8">
            <h3 className="text-2xl sm:text-3xl font-bold mb-2">The Real Cost of an SDR Team</h3>
            <p className="text-white/90">What you actually pay vs. what you think you pay</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <h4 className="text-lg font-semibold mb-4">Per SDR Position (1 Year)</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Base salary</span>
                  <span>R240,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Commission/bonus</span>
                  <span>R60,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Recruitment fees (12% avg)</span>
                  <span>R36,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Training & onboarding</span>
                  <span>R25,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Benefits & equipment</span>
                  <span>R30,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Mgmt overhead (10%):</span>
                  <span>R30,000</span>
                </div>
                <div className="border-t border-white/30 pt-3 flex justify-between font-bold">
                  <span>Total Cost</span>
                  <span>R421,000</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-400/20 backdrop-blur rounded-xl p-6 border border-yellow-400/40">
              <h4 className="text-lg font-semibold mb-4">ACME CORP Alternative</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Setup cost</span>
                  <span>R0</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly retainer</span>
                  <span>R0</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost per qualified meeting</span>
                  <span>R400-600</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated meetings/year</span>
                  <span>300-400</span>
                </div>
                <div className="flex justify-between">
                  <span>Total cost for 350 meetings</span>
                  <span>R175,000</span>
                </div>
                <div className="border-t border-yellow-400/40 pt-3 flex justify-between font-bold">
                  <span>Annual Savings</span>
                  <span className="text-yellow-300">R246,000</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-white/90 text-sm">
              <strong>Risk difference:</strong>  With SDRs, you pay R421K regardless of results. With ACME CORP,
              you only pay when we deliver qualified meetings you actually want.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
