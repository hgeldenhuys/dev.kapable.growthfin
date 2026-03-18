import { Users, Clock, TrendingDown } from 'lucide-react';

export function ProblemSectionAlt2() {
  const problems = [
    {
      icon: Users,
      title: 'Hiring Is Expensive & Slow',
      description: 'Recruiting SDRs costs $50K-100K per year, plus 4-6 weeks of training before they\'re productive. High turnover means constant replacement costs.'
    },
    {
      icon: Clock,
      title: 'Manual Outreach Doesn\'t Scale',
      description: 'Your team can only handle so many touches per day. Growth plateaus at your headcount. Scaling means more hiring, which means more costs.'
    },
    {
      icon: TrendingDown,
      title: 'Poor Lead Quality Kills Deals',
      description: 'Generic, untargeted outreach gets ignored. Without proper research and personalization, conversion rates stay stuck at 2-5%.'
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            The Sales Development Challenge
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Every B2B company faces the same problem: how to generate qualified meetings without breaking the bank
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {problems.map((problem, idx) => {
            const Icon = problem.icon;
            return (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 p-8 hover:shadow-xl transition-all duration-300"
              >
                {/* Accent line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                      <Icon className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-950 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
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
      </div>
    </section>
  );
}
