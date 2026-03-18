import { Button } from '~/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export function HeroSectionAlt7() {
  return (
    <section className="pt-32 pb-20 bg-stone-50 dark:bg-stone-950 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-200 dark:bg-stone-900 rounded-full mb-8">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Reclaim your humanity</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-serif text-stone-900 dark:text-stone-50 mb-8 leading-tight">
              Scale your outbound 10x. <br />
              <span className="italic text-stone-500">Without the headcount.</span>
            </h1>
            
            <p className="text-xl text-stone-600 dark:text-stone-400 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
              AI-powered SDR teams that book qualified meetings while you sleep.
              Reduce costs by 60% and generate R2M+ in pipeline revenue.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button 
                size="lg"
                className="bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-900 rounded-full h-14 px-8 text-lg shadow-xl shadow-stone-900/10"
                onClick={() => document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Start Connecting
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="lg"
                className="text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-900 rounded-full h-14 px-8 text-lg"
              >
                See How It Works
              </Button>
            </div>
          </div>

          <div className="flex-1 relative">
            <div className="relative z-10 bg-white dark:bg-stone-900 p-2 rounded-3xl shadow-2xl shadow-stone-500/20 transform rotate-2 hover:rotate-0 transition-transform duration-700">
               <div className="aspect-[4/3] bg-stone-200 dark:bg-stone-800 rounded-2xl overflow-hidden relative">
                 {/* Abstract organic shape placeholder since we don't have images */}
                 <div className="absolute inset-0 bg-gradient-to-br from-amber-200/50 to-stone-200/50 dark:from-amber-900/20 dark:to-stone-800"></div>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl animate-pulse"></div>
                 
                 <div className="absolute bottom-6 left-6 right-6 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md p-4 rounded-xl">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                       <span className="text-green-600 text-xs font-bold">AI</span>
                     </div>
                     <div>
                       <div className="text-sm font-bold text-stone-900 dark:text-stone-100">Meeting Booked</div>
                       <div className="text-xs text-stone-500">Just now • Sarah from Acme Inc.</div>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
            
            {/* Decorative blob */}
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-stone-200 dark:bg-stone-800 rounded-full mix-blend-multiply filter blur-3xl opacity-50 z-0"></div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
