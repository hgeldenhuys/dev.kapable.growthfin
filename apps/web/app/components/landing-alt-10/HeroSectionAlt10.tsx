import { Button } from '~/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function HeroSectionAlt10() {
  return (
    <section className="py-20 border-b-[10px] border-black bg-[#FFD6F8]">
      <div className="container mx-auto px-4">
        <div className="bg-white border-[5px] border-black shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] p-10 max-w-5xl mx-auto transform -rotate-1">
          <h1 className="text-6xl md:text-8xl font-black mb-8 leading-none tracking-tighter text-center">
            NO HEADCOUNT. <br/>
            <span className="bg-black text-white px-6">10X SCALE.</span>
          </h1>
          
          <p className="text-2xl md:text-3xl font-bold text-center mb-12 font-mono">
            Stop lighting money on fire. <br/>
            Book qualified meetings automatically. <br/>
            <span className="bg-[#D6FFF6] px-2">Trusted by 500+ teams.</span>
          </p>

          <div className="flex justify-center">
             <Button 
              size="lg"
              className="bg-[#4D4DFF] hover:bg-[#3d3dcc] text-white font-black text-2xl px-12 py-10 h-auto border-[5px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              onClick={() => document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' })}
            >
              FIX MY PIPELINE <ArrowRight className="ml-4 w-8 h-8" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
