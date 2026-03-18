import { Button } from '~/components/ui/button';

export function HeroSectionAlt6() {
  return (
    <section className="pt-32 pb-20 bg-white dark:bg-zinc-950">
      <div className="container mx-auto px-4 max-w-5xl text-center">
        <div className="inline-block mb-8 px-3 py-1 border border-zinc-200 dark:border-zinc-800 rounded-full">
          <span className="text-xs font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            Trusted by 500+ B2B Teams
          </span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-medium tracking-tighter text-zinc-900 dark:text-zinc-50 mb-8 leading-[0.9]">
          Scale 10x. <br />
          <span className="text-zinc-400 dark:text-zinc-600">Zero Headcount.</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
          AI-powered SDR teams that book qualified meetings while you sleep.
          60% cost reduction. 15% conversion rates. POPIA-compliant.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            size="lg"
            className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-none h-14 px-8 text-base tracking-wide"
            onClick={() => document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Request Access
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-none h-14 px-8 text-base tracking-wide"
          >
            Read the Thesis
          </Button>
        </div>
      </div>
    </section>
  );
}
