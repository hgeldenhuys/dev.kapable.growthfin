import { Card } from '~/components/ui/card';
import { Check, X } from 'lucide-react';

export function ComparisonSectionAlt1() {
  return (
    <section className="py-20 sm:py-32 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            ACME CORP vs Traditional SDRs
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
            Why ACME CORP is 10x more efficient
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-800">
                <th className="text-left py-4 px-6 font-bold text-gray-900 dark:text-white">Feature</th>
                <th className="text-center py-4 px-6 font-bold text-gray-900 dark:text-white">Traditional SDRs</th>
                <th className="text-center py-4 px-6 font-bold text-blue-600 dark:text-blue-400">ACME CORP</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: 'Cost per Qualified Lead', traditional: 'R100+', growthfin: 'R40' },
                { feature: 'Leads per Day', traditional: '50-100', growthfin: '20,000+' },
                { feature: 'Setup Time', traditional: '4-6 weeks', growthfin: '24 hours' },
                { feature: '24/7 Availability', traditional: 'Business hours only', growthfin: 'Always on' },
                { feature: 'Conversation Quality', traditional: 'Inconsistent', growthfin: 'Always on-brand' },
                { feature: 'POPIA Compliant', traditional: 'Manual effort', growthfin: 'Built-in' },
                { feature: 'Scale to 20,000 leads', traditional: 'Hire 200+ SDRs', growthfin: 'Click a button' },
                { feature: 'Real-time Dashboard', traditional: 'No', growthfin: 'Yes' },
              ].map((row) => (
                <tr key={row.feature} className="border-b border-gray-200 dark:border-gray-800">
                  <td className="py-4 px-6 font-medium text-gray-900 dark:text-white">{row.feature}</td>
                  <td className="py-4 px-6 text-center text-gray-600 dark:text-gray-400">{row.traditional}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      <span className="font-semibold text-green-700 dark:text-green-400">{row.growthfin}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
