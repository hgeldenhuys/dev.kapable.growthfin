import { motion } from 'framer-motion';
import { Button } from '~/components/ui/button';
import { ArrowRight, Zap } from 'lucide-react';

export function HeroSectionAlt5() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(255,87,34,0.15),transparent_70%)]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-600/20 blur-[100px] rounded-full mix-blend-screen animate-pulse" />
        <div className="absolute top-20 left-20 w-[300px] h-[300px] bg-purple-600/20 blur-[100px] rounded-full mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400"
        >
          <Zap className="w-4 h-4" />
          <span className="text-sm font-bold uppercase tracking-wider">Trusted by 500+ SA B2B Teams</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-8 leading-none"
        >
          SCALE
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-purple-600">
            10X FASTER.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-12 font-light"
        >
          The "headcount game" is dead. ACME CORP replaces traditional SDR teams with autonomous AI agents.
          Book qualified meetings while you sleep—fully <span className="text-white font-semibold">POPIA-compliant</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button 
            size="lg" 
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg px-8 py-6 rounded-full w-full sm:w-auto transition-all hover:scale-105"
            onClick={() => document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Start the Revolution
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="lg"
            className="text-gray-400 hover:text-white text-lg px-8 py-6 rounded-full w-full sm:w-auto"
          >
            Watch the Manifest
          </Button>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500"
      >
        <span className="text-xs uppercase tracking-widest">Scroll to Evolve</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-orange-500 to-transparent" />
      </motion.div>
    </section>
  );
}
