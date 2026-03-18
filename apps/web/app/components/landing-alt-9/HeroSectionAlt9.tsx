import { Button } from '~/components/ui/button';

export function HeroSectionAlt9() {
  return (
    <section className="pt-32 pb-20 relative overflow-hidden bg-[#0a192f] text-[#64ffda]">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-10" 
           style={{ backgroundImage: 'linear-gradient(#64ffda 1px, transparent 1px), linear-gradient(90deg, #64ffda 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl">
          <div className="font-mono text-sm mb-6 text-[#64ffda] opacity-80">
            {'// SYSTEMATIC_REVENUE_ARCHITECTURE_V2.0'}
          </div>
          
          <h1 className="text-5xl md:text-7xl font-mono font-bold mb-8 leading-tight text-white">
            Scale Outbound <span className="text-[#64ffda]">10x</span> <br/>
            Zero Headcount.
          </h1>
          
          <div className="bg-[#112240] border border-[#233554] p-6 rounded mb-10 font-mono text-sm md:text-base text-gray-300 max-w-2xl shadow-xl">
            <div className="flex gap-2 mb-4 border-b border-[#233554] pb-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <p><span className="text-[#c792ea]">const</span> <span className="text-[#82aaff]">growthEngine</span> = <span className="text-[#c792ea]">new</span> <span className="text-[#ffcb6b]">AcmeCorp</span>({'{'}</p>
            <p className="pl-4">pipeline_target: <span className="text-[#c3e88d]">'R2M+'</span>,</p>
            <p className="pl-4">cost_reduction: <span className="text-[#f78c6c]">0.60</span>,</p>
            <p className="pl-4">compliance: <span className="text-[#c3e88d]">'POPIA_STRICT'</span></p>
            <p>{'}'});</p>
            <p className="mt-2"><span className="text-[#c792ea]">await</span> growthEngine.<span className="text-[#82aaff]">scale</span>(<span className="text-[#f78c6c]">10</span>);</p>
            <p className="text-[#64ffda] mt-2">{'>'} Booking qualified meetings... OK</p>
            <p className="text-[#64ffda]">{'>'} Generating revenue... OK</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg"
              className="bg-[#64ffda] text-[#0a192f] hover:bg-[#64ffda]/90 font-mono font-bold h-14 px-8 rounded-none border border-[#64ffda]"
              onClick={() => document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' })}
            >
              [ EXECUTE_STRATEGY ]
            </Button>
            
            <Button 
              variant="outline"
              size="lg"
              className="bg-transparent text-[#64ffda] border-[#64ffda] hover:bg-[#64ffda]/10 font-mono font-bold h-14 px-8 rounded-none"
            >
              [ VIEW_SCHEMATICS ]
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
