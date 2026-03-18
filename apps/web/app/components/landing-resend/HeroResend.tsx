import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ChevronRight, ArrowRight } from "lucide-react";

export function HeroResend() {
  return (
    <div className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-black text-white">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-zinc-800/20 to-transparent pointer-events-none" />
      
      <div className="container relative z-10 mx-auto px-4 text-center">
        <div className="flex justify-center mb-6">
          <Badge variant="outline" className="bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer py-1 px-3">
            <span className="flex items-center gap-2">
              Introducing AI SDR Teams
              <ChevronRight className="w-3 h-3" />
            </span>
          </Badge>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
          Scale your outbound <br />
          without the noise.
        </h1>
        
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
          Book more qualified meetings with AI SDR teams that work 24/7. 
          The modern platform for high-growth sales teams.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="bg-white text-black hover:bg-zinc-200 h-12 px-8 text-base font-medium">
            Get Started
          </Button>
          <Button size="lg" variant="ghost" className="text-white hover:bg-zinc-900 h-12 px-8 text-base font-medium group">
            Book a Demo
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </div>
  );
}
