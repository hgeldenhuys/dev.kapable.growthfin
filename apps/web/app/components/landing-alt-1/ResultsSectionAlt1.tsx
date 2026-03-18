import { Card } from '~/components/ui/card';

export function ResultsSectionAlt1() {
  const results = [
    { label: 'Cost Reduction', value: '60%', subtext: 'Per qualified lead' },
    { label: 'Conversion Rate', value: '15%', subtext: 'Industry average 2-5%' },
    { label: 'Pipeline Generated', value: 'R2M+', subtext: 'First year typical' },
    { label: 'Implementation Time', value: '24 hrs', subtext: 'vs 4-6 weeks' },
  ];

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Measurable Results, Guaranteed
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
            These aren't projections. These are real numbers from real customers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {results.map((result) => (
            <Card key={result.label} className="p-8 text-center bg-white/50 dark:bg-gray-800/50 border-0">
              <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
                {result.value}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{result.label}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{result.subtext}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
