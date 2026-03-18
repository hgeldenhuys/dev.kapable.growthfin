import { Card } from '~/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export function ProcessSectionAlt1() {
  const steps = [
    { num: '1', title: 'AI Research', desc: '3-tier system identifies best prospects' },
    { num: '2', title: 'Multi-Channel Outreach', desc: 'Email, LinkedIn, WhatsApp, Voice' },
    { num: '3', title: 'Qualification', desc: '24/7 AI handles initial conversations' },
    { num: '4', title: 'Handoff', desc: 'Qualified leads to your sales team' },
  ];

  return (
    <section className="py-20 sm:py-32 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white text-center mb-16">
          How It Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {steps.map((step, idx) => (
            <div key={step.num} className="flex flex-col">
              <div className="flex items-center mb-6">
                <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg">
                  {step.num}
                </div>
                {idx < steps.length - 1 && <div className="hidden md:block flex-1 h-1 bg-blue-200 dark:bg-blue-800 ml-4" />}
              </div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{step.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-8 border border-blue-200 dark:border-blue-800/50">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
                Result: Qualified Meetings Without the Headcount
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                You get the results of a full SDR team, without hiring, training, or managing them. Scale up or down instantly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
