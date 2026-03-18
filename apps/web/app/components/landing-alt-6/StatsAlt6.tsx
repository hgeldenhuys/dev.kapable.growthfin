export function StatsAlt6() {
  const stats = [
    { label: 'Cost Reduction', value: '60%' },
    { label: 'Pipeline Generated', value: 'R2M+' },
    { label: 'Conversion Rate', value: '15%' },
    { label: 'B2B Teams', value: '500+' },
  ];

  return (
    <section className="py-20 border-y border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center">
              <div className="text-4xl md:text-5xl font-light tracking-tighter text-zinc-900 dark:text-white mb-2">
                {stat.value}
              </div>
              <div className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
