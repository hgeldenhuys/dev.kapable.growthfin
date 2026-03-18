import { motion } from 'framer-motion';
import { Brain, Target, Zap } from 'lucide-react';

export function FeaturesAlt5() {
  const features = [
    {
      id: 1,
      title: 'Neural Intelligence',
      description: 'Not just a database. A brain.',
      details: 'Our AI doesn\'t just list leads; it understands them. By analyzing hiring patterns, tech stack changes, and funding news, it predicts intent before the prospect even knows they need you.',
      icon: Brain,
      color: 'from-orange-400 to-pink-600'
    },
    {
      id: 2,
      title: 'Omnichannel Swarm',
      description: 'Everywhere, all at once.',
      details: 'Email is crowded. ACME CORP orchestrates a symphony of touchpoints across LinkedIn, Email, and even SMS, ensuring your message is seen, not just delivered.',
      icon: Zap,
      color: 'from-blue-400 to-purple-600'
    },
    {
      id: 3,
      title: 'Precision Targeting',
      description: 'Zero waste. 100% relevance.',
      details: 'Filter by over 50+ custom variables including "Recently Hired VP of Sales" or "Using Competitor X". Build the perfect list in seconds, not days.',
      icon: Target,
      color: 'from-green-400 to-emerald-600'
    }
  ];

  return (
    <section className="py-32 bg-black text-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="mb-20">
          <h2 className="text-5xl md:text-7xl font-black mb-6">
            WE BUILT A <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-purple-600">
              REVENUE ENGINE.
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl border-l-2 border-orange-500 pl-6">
            This isn't a tool. It's an unfair advantage.
          </p>
        </div>

        <div className="space-y-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 to-black transform scale-[0.99] group-hover:scale-100 transition-transform duration-500 rounded-2xl border border-zinc-800 group-hover:border-orange-500/50 z-0"></div>
              
              <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row gap-8 md:gap-20 items-start md:items-center cursor-default">
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${feature.color} opacity-80 group-hover:opacity-100 transition-opacity shadow-lg`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-3xl font-bold mb-2 group-hover:text-orange-500 transition-colors">{feature.title}</h3>
                  <p className="text-xl text-gray-400 group-hover:text-gray-300 transition-colors">{feature.description}</p>
                </div>

                <div className="md:w-1/3 opacity-0 max-h-0 md:group-hover:opacity-100 md:group-hover:max-h-40 transition-all duration-500 overflow-hidden">
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {feature.details}
                  </p>
                </div>

                <div className="md:hidden opacity-100 text-gray-400 text-sm mt-4">
                   {feature.details}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
