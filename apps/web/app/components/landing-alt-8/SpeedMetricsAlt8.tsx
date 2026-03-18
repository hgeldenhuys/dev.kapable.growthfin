import { Timer, Rocket, Activity, Clock } from 'lucide-react';

export function SpeedMetricsAlt8() {
  const metrics = [
    { icon: Clock, value: '-60%', label: 'Cost Reduction' },
    { icon: Rocket, value: '15%', label: 'Conversion Rate' },
    { icon: Activity, value: 'R2M+', label: 'Pipeline Gen' },
    { icon: Timer, value: '24/7', label: 'Operations' },
  ];

  return (
    <section className="py-20 bg-black text-yellow-400">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {metrics.map((m, i) => (
            <div key={i} className="border-l-4 border-yellow-400 pl-6 group hover:bg-yellow-400/10 transition-colors p-4">
              <m.icon className="w-8 h-8 mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="text-5xl md:text-7xl font-black italic tracking-tighter mb-2">{m.value}</div>
              <div className="text-sm font-bold uppercase tracking-widest opacity-70">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
