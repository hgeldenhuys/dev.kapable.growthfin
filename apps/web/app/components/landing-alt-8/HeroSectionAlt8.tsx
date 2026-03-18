import { Button } from '~/components/ui/button';
import { ArrowRight, Zap } from 'lucide-react';

export function HeroSectionAlt8() {
  return (
    <section className="pt-32 pb-20 overflow-hidden bg-yellow-400">
      <div className="container mx-auto px-4 relative">
        {/* Motion Elements */}
        <div className="absolute -right-20 top-0 opacity-20 transform rotate-12">
           <div className="text-[20rem] font-black italic leading-none tracking-tighter">FAST</div>
        </div>

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-black text-yellow-400 px-3 py-1 font-bold uppercase text-xs tracking-widest mb-6 skew-x-[-10deg]">
            <Zap className="w-4 h-4 fill-current" />
            <span>Speed Matters</span>
          </div>
          
          <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter leading-[0.85] mb-8">
            SCALE 10X. <br/>
            CUT COSTS. <br/>
            BOOK. <br/>
            <span className="text-white text-shadow-sm">NOW.</span>
          </h1>
          
          <p className="text-xl md:text-3xl font-bold leading-tight max-w-2xl mb-10">
            Deploy an AI sales team in <span className="underline decoration-black decoration-4">minutes</span>.
            60% cheaper. 15% conversion. R2M+ pipeline.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg"
              className="bg-black hover:bg-zinc-900 text-yellow-400 font-black text-xl px-10 py-8 h-auto rounded-none skew-x-[-10deg] transition-transform hover:translate-x-2"
              onClick={() => document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <span className="skew-x-[10deg] inline-flex items-center">
                START NOW <ArrowRight className="ml-2 w-6 h-6" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
