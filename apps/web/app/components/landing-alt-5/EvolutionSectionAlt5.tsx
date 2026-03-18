import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';

export function EvolutionSectionAlt5() {
  const variants = {
    hidden: { opacity: 0, x: -50 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <section className="py-32 bg-zinc-950 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          
          {/* Left: The Old Way */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-red-500/5 rounded-xl blur-xl group-hover:bg-red-500/10 transition-all duration-700"></div>
            <div className="relative p-8 border border-red-900/30 rounded-xl bg-black/50 backdrop-blur-sm">
              <h3 className="text-3xl font-bold text-gray-500 mb-6 flex items-center gap-3">
                <span className="line-through decoration-red-500 decoration-4">Yesterday</span>
                <span className="text-xs font-mono bg-red-900/30 text-red-400 px-2 py-1 rounded">DEPRECATED</span>
              </h3>
              
              <ul className="space-y-6">
                <li className="flex items-start gap-4 text-gray-400 group-hover:text-gray-300 transition-colors">
                  <X className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="block text-white text-lg">Spray & Pray</strong>
                    <span className="text-sm">Sending 1,000 generics emails hoping for 1 reply.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4 text-gray-400 group-hover:text-gray-300 transition-colors">
                  <X className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="block text-white text-lg">Manual Data Entry</strong>
                    <span className="text-sm">hours wasted updating Salesforce fields manually.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4 text-gray-400 group-hover:text-gray-300 transition-colors">
                  <X className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="block text-white text-lg">Guesswork</strong>
                    <span className="text-sm">"I think they might be interested?"</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Right: The New Way */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            variants={variants}
            className="relative"
          >
            <div className="absolute -inset-4 bg-orange-500/20 rounded-xl blur-xl animate-pulse"></div>
            <div className="relative p-10 border border-orange-500/50 rounded-2xl bg-zinc-900/90 shadow-2xl shadow-orange-900/20">
              <h3 className="text-4xl font-black text-white mb-8 flex items-center gap-3">
                Tomorrow
                <span className="text-xs font-mono bg-orange-500 text-black px-2 py-1 rounded font-bold">LIVE NOW</span>
              </h3>
              
              <ul className="space-y-8">
                <li className="flex items-start gap-4">
                  <div className="bg-orange-500 rounded-full p-1 mt-1">
                    <Check className="w-4 h-4 text-black font-bold" />
                  </div>
                  <div>
                    <strong className="block text-white text-xl mb-1">Surgical Precision</strong>
                    <span className="text-gray-400">15% conversion rates on cold outreach. Proven in the SA market.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="bg-orange-500 rounded-full p-1 mt-1">
                    <Check className="w-4 h-4 text-black font-bold" />
                  </div>
                  <div>
                    <strong className="block text-white text-xl mb-1">Autonomous Execution</strong>
                    <span className="text-gray-400">Reduce costs by 60%. No hiring, training, or management overhead.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="bg-orange-500 rounded-full p-1 mt-1">
                    <Check className="w-4 h-4 text-black font-bold" />
                  </div>
                  <div>
                    <strong className="block text-white text-xl mb-1">Predictive Revenue</strong>
                    <span className="text-gray-400">Generate R2M+ pipeline automatically. Fully POPIA compliant.</span>
                  </div>
                </li>
              </ul>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
