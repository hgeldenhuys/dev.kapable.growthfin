import { ArrowUpRight, Globe, Zap, Shield } from 'lucide-react';

export function MinimalGridAlt6() {
  return (
    <section className="py-32 bg-white dark:bg-zinc-950">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-100 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-900">
          
          {/* Card 1 */}
          <div className="bg-white dark:bg-zinc-950 p-12 aspect-square flex flex-col justify-between group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
              <Globe className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
            </div>
            <div>
              <h3 className="text-xl font-medium mb-2 text-zinc-900 dark:text-white">Market Dominance</h3>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Trusted by 500+ B2B sales teams to generate millions in pipeline revenue.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-zinc-950 p-12 aspect-square flex flex-col justify-between group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
              <Zap className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
            </div>
            <div>
              <h3 className="text-xl font-medium mb-2 text-zinc-900 dark:text-white">Instant Scale</h3>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Deploy AI agents instantly. Scale outbound 10x without adding headcount.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-zinc-950 p-12 aspect-square flex flex-col justify-between group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
              <Shield className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
            </div>
            <div>
              <h3 className="text-xl font-medium mb-2 text-zinc-900 dark:text-white">POPIA Compliant</h3>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Built specifically for South African compliance requirements. Secure by default.
              </p>
            </div>
          </div>
          
        </div>

        <div className="mt-12 text-center">
          <a href="#" className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-zinc-900 dark:text-white hover:underline decoration-zinc-400 underline-offset-4">
            View Full Capabilities <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
