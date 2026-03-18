import { Brain, Zap, Target, Layers, Network, Cpu } from 'lucide-react';

export function AIIntelligenceSectionAlt4() {
  const capabilities = [
    {
      icon: Brain,
      title: 'Neural Prospect Intelligence',
      description: 'Advanced neural networks analyze 500M+ data points to identify prospects with 89% accuracy. Not keyword matching—true understanding of business needs.',
      metrics: '89% prospect accuracy vs 23% industry average',
      color: 'blue'
    },
    {
      icon: Zap,
      title: 'Dynamic Sequence Optimization',
      description: 'AI continuously tests and optimizes message sequences in real-time. Each interaction improves performance across all campaigns simultaneously.',
      metrics: '3.2x better response rates over time',
      color: 'indigo'
    },
    {
      icon: Target,
      title: 'Predictive Qualification',
      description: 'Transformer-based language models understand context, intent, and buying signals. Predicts meeting quality with 94% accuracy before scheduling.',
      metrics: '94% meeting acceptance rate',
      color: 'purple'
    },
    {
      icon: Network,
      title: 'Multi-Channel Intelligence',
      description: 'AI coordinates across email, LinkedIn, phone, and WhatsApp. Learns which channels work best for each prospect type and adapts strategy.',
      metrics: '67% multi-channel engagement rate',
      color: 'blue'
    },
    {
      icon: Cpu,
      title: 'Real-Time Learning Engine',
      description: 'Every conversation feeds back into the neural network. The system gets smarter with every interaction across all clients.',
      metrics: 'Continuous improvement, no manual updates',
      color: 'indigo'
    },
    {
      icon: Layers,
      title: 'Enterprise Integration',
      description: 'Native integrations with Salesforce, HubSpot, Slack. Real-time synchronization, bi-directional data flow, enterprise security.',
      metrics: '99.9% uptime, SOC 2 Type II',
      color: 'purple'
    }
  ];

  const colorMap = {
    blue: {
      bg: 'from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800',
      border: 'border-blue-200 dark:border-blue-800',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      accent: 'text-blue-700 dark:text-blue-300',
      description: 'text-gray-700 dark:text-gray-300'
    },
    indigo: {
      bg: 'from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800',
      border: 'border-indigo-200 dark:border-indigo-800',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      accent: 'text-indigo-700 dark:text-indigo-300',
      description: 'text-gray-700 dark:text-gray-300'
    },
    purple: {
      bg: 'from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800',
      border: 'border-purple-200 dark:border-purple-800',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      accent: 'text-purple-700 dark:text-purple-300',
      description: 'text-gray-700 dark:text-gray-300'
    }
  };

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">ADVANCED AI CAPABILITIES</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            Why AI Beats Human SDRs
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Not just automation—actual intelligence. Our neural architecture learns, adapts, and optimizes in real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {capabilities.map((capability, idx) => {
            const Icon = capability.icon;
            const colors = colorMap[capability.color as keyof typeof colorMap];

            return (
              <div
                key={idx}
                className={`group relative overflow-hidden rounded-xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-8 hover:shadow-2xl transition-all duration-300`}
              >
                {/* Animated accent line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>

                <div className="flex items-start gap-4 mb-6">
                  <div className={`flex-shrink-0 ${colors.iconBg} rounded-lg p-3`}>
                    <Icon className={`h-6 w-6 ${colors.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-950 dark:text-white">
                    {capability.title}
                  </h3>
                </div>

                <p className={`leading-relaxed mb-4 ${colors.description}`}>
                  {capability.description}
                </p>

                <div className={`text-sm font-semibold ${colors.accent} bg-white/50 dark:bg-gray-800/50 rounded-lg px-3 py-2 inline-block`}>
                  {capability.metrics}
                </div>
              </div>
            );
          })}
        </div>

        {/* Technical superiority comparison */}
        <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950 text-white rounded-2xl p-8 sm:p-12">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">AI vs Human SDR Performance</h3>
            <p className="text-gray-300">The data is clear: AI consistently outperforms human teams</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-5xl font-black text-blue-400 mb-2">24/7</div>
              <div className="text-lg font-semibold mb-2">Always Learning</div>
              <p className="text-sm text-gray-400">
                AI processes every interaction across all clients simultaneously. Humans learn slowly, one conversation at a time.
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl font-black text-indigo-400 mb-2">0</div>
              <div className="text-lg font-semibold mb-2">Bad Days</div>
              <p className="text-sm text-gray-400">
                AI performance never degrades due to fatigue, mood, or personal issues. Consistent excellence 100% of the time.
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl font-black text-purple-400 mb-2">∞</div>
              <div className="text-lg font-semibold mb-2">Scalability</div>
              <p className="text-sm text-gray-400">
                Instantly scale to 10,000 prospects without hiring, training, or management overhead. No limits.
              </p>
            </div>
          </div>

          <div className="mt-12 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-start gap-4">
              <Brain className="h-8 w-8 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-xl font-bold mb-2">The Neural Network Advantage</h4>
                <p className="text-gray-300 mb-4">
                  While human SDRs rely on intuition and limited experience, our AI analyzes 500M+ data points in real-time,
                  identifying patterns and opportunities that humans simply can't see.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="font-semibold text-blue-300">Traditional SDR</div>
                    <div className="text-gray-400">~50 prospects evaluated per day</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="font-semibold text-indigo-300">ACME CORP AI</div>
                    <div className="text-gray-400">500M+ data points processed per hour</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}