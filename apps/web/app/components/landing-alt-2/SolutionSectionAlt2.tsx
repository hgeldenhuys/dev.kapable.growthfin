import { CheckCircle2, Brain, Send, Handshake } from 'lucide-react';

export function SolutionSectionAlt2() {
  const steps = [
    {
      icon: Brain,
      title: 'AI Research',
      description: '3-tier system identifies best prospects based on firmographics, technographics, and behavioral signals. No more guessing.'
    },
    {
      icon: Send,
      title: 'Multi-Channel Outreach',
      description: 'Email, LinkedIn, WhatsApp, Voice calls. We orchestrate campaigns that get responses. Personalized at scale.'
    },
    {
      icon: Handshake,
      title: 'Qualification & Handoff',
      description: '24/7 AI handles initial conversations, asks qualifying questions, and schedules meetings. Only qualified leads reach your team.'
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-teal-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-teal-950/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            How ACME CORP Works
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            A complete AI-powered system for sales development that replaces your entire SDR team
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="relative">
                {/* Step number with teal accent */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 text-white font-black text-lg">
                      {idx + 1}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-950 dark:text-white mb-3 ml-0">
                  {step.title}
                </h3>
                <p className="text-gray-700 dark:text-gray-400 leading-relaxed">
                  {step.description}
                </p>

                {/* Connection line */}
                {idx < steps.length - 1 && (
                  <div className="hidden md:block absolute top-7 -right-4 w-8 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 opacity-50"></div>
                )}
              </div>
            );
          })}
        </div>

        {/* Result box */}
        <div className="mt-16 bg-white dark:bg-gray-900 border-2 border-teal-200 dark:border-teal-800 rounded-xl p-8 sm:p-12">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-950 dark:text-white mb-3">
                The Result: Predictable Pipeline Without Headcount
              </h3>
              <p className="text-gray-700 dark:text-gray-400 text-lg leading-relaxed">
                You get the results of a full SDR team, without hiring, training, or managing them. Scale up or down instantly based on your needs. One flat fee covers everything.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
