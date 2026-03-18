import { Link } from "react-router";
import { 
  Zap, 
  Sun,
  Moon,
  Mountain,
  Lock,
  Network,
  ChevronRight,
  Database
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt15() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setMounted(true);
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
    }
  }, []);

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  if (!mounted) return null;

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-1000 font-sans selection:bg-blue-600/30 overflow-x-hidden",
      theme === "dark" ? "bg-[#000000] text-slate-100" : "bg-[#ffffff] text-slate-900"
    )}>
      {/* Background: Atmospheric mesh */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-20%] left-[-10%] w-[80%] h-[80%] blur-[160px] rounded-full transition-all duration-1000 opacity-30",
          theme === "dark" ? "bg-blue-600/20" : "bg-blue-200/40"
        )} />
        <div className={cn(
          "absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] blur-[160px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-emerald-600/10" : "bg-emerald-100/30"
        )} />
      </div>

      {/* Navigation: Minimalist Float */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-4xl z-50 px-6">
        <div className={cn(
          "h-14 rounded-full border backdrop-blur-xl px-6 flex items-center justify-between transition-all duration-500",
          theme === "dark" ? "bg-black/40 border-white/10" : "bg-white/40 border-black/5"
        )}>
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="h-7 w-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:rotate-12 transition-transform">
              <Mountain className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-black tracking-tight uppercase">Agios</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
            <a href="#features" className="hover:opacity-100 transition-opacity">Core</a>
            <a href="#scale" className="hover:opacity-100 transition-opacity">Scale</a>
            <a href="#legal" className="hover:opacity-100 transition-opacity">POPIA</a>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="opacity-40 hover:opacity-100 transition-opacity">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="h-4 w-px bg-slate-500/20" />
            <Link to="/auth/sign-in">
                <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.2em] h-8 px-3">Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero: Cinematic Center */}
      <section className="relative h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        <div className="container mx-auto relative z-10 text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center"
          >
            <Badge className={cn(
              "mb-8 py-2 px-6 rounded-full font-bold tracking-[0.3em] uppercase text-[9px] border transition-colors",
              theme === "dark" ? "bg-white/5 border-white/10 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
            )}>
              Silicon Cape Hub // Orchestration Engine
            </Badge>
            
            <h1 className="text-6xl md:text-8xl lg:text-[11rem] font-black tracking-tighter mb-4 leading-[0.8] uppercase text-center flex flex-col shrink-0">
                <span className="block">Precision</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-emerald-400 inline-block pb-2">
                    At Scale
                </span>
            </h1>

            <p className="text-base md:text-xl lg:text-2xl opacity-40 max-w-2xl mx-auto mb-16 font-light leading-relaxed tracking-tight">
                Autonomous lead orchestration for high-velocity fintech pipelines. 
                Infinitely scalable intelligence, localized for the South African market.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-md">
              <Button size="lg" className="h-16 px-10 text-[10px] font-black uppercase tracking-[0.3em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-2xl shadow-blue-600/30 flex-1 w-full sm:w-auto">
                Initialize System
              </Button>
              <Button size="lg" variant="outline" className="h-16 px-10 text-[10px] font-black uppercase tracking-[0.3em] rounded-none border-blue-500/20 hover:bg-blue-600/5 flex-1 w-full sm:w-auto">
                Local Specs
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Status Bar */}
        <div className="absolute bottom-10 left-0 w-full px-12 hidden lg:flex items-center justify-between opacity-30 text-[9px] font-black uppercase tracking-[0.4em]">
            <div className="flex items-center gap-4">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>Node 01 // Cape Town HQ // Active</span>
            </div>
            <div className="flex items-center gap-4">
                <span>Latency: 12.4ms</span>
                <div className="h-4 w-px bg-slate-500" />
                <span>GMT +2</span>
            </div>
        </div>
      </section>

      {/* Bento Grid: Capabilities */}
      <section id="features" className="py-40 border-t border-white/5 relative">
        <div className="container mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6 auto-rows-[300px]">
                {/* Feature 1: Large */}
                <div className={cn(
                    "md:col-span-6 lg:col-span-8 p-10 border relative overflow-hidden group transition-all duration-700",
                    theme === "dark" ? "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]" : "bg-slate-50 border-black/5 hover:bg-slate-100"
                )}>
                    <div className="relative z-10 h-full flex flex-col">
                        <Badge className="w-fit mb-6 bg-blue-600/10 text-blue-500 rounded-none border-none text-[8px] font-black uppercase">Orchestration</Badge>
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Neural Lead <br /> Enrichment</h3>
                        <p className="max-w-md text-sm opacity-50 font-light leading-relaxed">Our agents automatically cross-reference 50+ data points to build a high-fidelity financial profile of every lead in milliseconds.</p>
                        <div className="mt-auto">
                            <Button variant="ghost" className="p-0 h-auto font-black text-[10px] uppercase tracking-widest text-blue-600 hover:bg-transparent group">
                                View Technical Manual <ChevronRight className="ml-1 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    </div>
                    <Database className="absolute -bottom-10 -right-10 h-64 w-64 text-blue-600/5 group-hover:scale-110 transition-transform duration-1000" />
                </div>

                {/* Feature 2: Compliance */}
                <div className={cn(
                    "md:col-span-3 lg:col-span-4 p-10 border relative overflow-hidden transition-all duration-700",
                    theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-slate-50 border-black/5"
                )}>
                    <Lock className="h-8 w-8 text-blue-600 mb-8" />
                    <h3 className="text-xl font-black uppercase tracking-tight mb-4">POPIA <br /> Native</h3>
                    <p className="text-xs opacity-50 font-medium leading-relaxed">Built from the ground up for South African data privacy requirements. Zero-trust architecture comes standard.</p>
                </div>

                {/* Feature 3: Speed */}
                <div className={cn(
                    "md:col-span-3 lg:col-span-4 p-10 border relative overflow-hidden transition-all duration-700",
                    theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-slate-50 border-black/5"
                )}>
                    <Zap className="h-8 w-8 text-amber-500 mb-8" />
                    <h3 className="text-xl font-black uppercase tracking-tight mb-4">Sub-Second <br /> Qualification</h3>
                    <p className="text-xs opacity-50 font-medium leading-relaxed">Eliminate latency in your sales cycle. Instant qualification means your agents close deals before the competition even calls.</p>
                </div>

                {/* Feature 4: Large 2 */}
                <div className={cn(
                    "md:col-span-6 lg:col-span-8 p-10 border relative overflow-hidden group transition-all duration-700",
                    theme === "dark" ? "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]" : "bg-slate-50 border-black/5 hover:bg-slate-100"
                )}>
                    <div className="relative z-10 h-full flex flex-col">
                        <Badge className="w-fit mb-6 bg-emerald-600/10 text-emerald-500 rounded-none border-none text-[8px] font-black uppercase">Network</Badge>
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Autonomous <br /> Node Distribution</h3>
                        <p className="max-w-md text-sm opacity-50 font-light leading-relaxed">Coordinate multiple agent clusters across various product lines with centralized command and control.</p>
                    </div>
                    <Network className="absolute -bottom-10 -right-10 h-64 w-64 text-emerald-600/5 group-hover:scale-110 transition-transform duration-1000" />
                </div>
            </div>
        </div>
      </section>

      {/* Scale: Rand Denominated Growth */}
      <section id="scale" className={cn(
          "py-40 transition-colors",
          theme === "dark" ? "bg-white/[0.01]" : "bg-slate-50"
      )}>
        <div className="container mx-auto px-8 text-center">
            <h2 className="text-6xl md:text-8xl font-black tracking-tighter uppercase mb-24 italic leading-none">
                The New Economy <br /> <span className="text-blue-600">Of Silicon Cape</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
                {[
                    { label: "Pipeline Orchestrated", value: "R2.4B+" },
                    { label: "Agent Actions Monthly", value: "12.8M" },
                    { label: "Conversion Lift", value: "142%" },
                ].map((stat, i) => (
                    <div key={i} className="space-y-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">{stat.label}</div>
                        <div className="text-6xl md:text-8xl font-black italic">{stat.value}</div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Final Call: Initial Sequence */}
      <section className="py-60 relative overflow-hidden flex flex-col items-center justify-center text-center">
        <div className="absolute inset-0 bg-blue-600/5 blur-[150px]" />
        <div className="container mx-auto px-8 relative z-10">
            <h2 className="text-7xl md:text-[14rem] font-black tracking-tighter uppercase leading-[0.75] mb-16 italic">
                Secure <br /> The Pulse
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 pt-10">
                <Link to="/auth/sign-up">
                    <Button size="lg" className="h-20 px-16 text-[11px] font-black uppercase tracking-[0.4em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-3xl">
                        Begin Deployment
                    </Button>
                </Link>
                <div className="flex items-center gap-6 group cursor-pointer opacity-50 hover:opacity-100 transition-opacity">
                    <div className="h-10 w-10 rounded-full border border-blue-600 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                        <ChevronRight className="h-4 w-4 group-hover:text-white" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Contact Solutions Team</span>
                </div>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={cn(
        "py-20 border-t transition-colors duration-700",
        theme === "dark" ? "border-white/5 bg-black" : "border-slate-200 bg-white"
      )}>
        <div className="container mx-auto px-8">
            <div className="flex flex-col md:flex-row items-start justify-between gap-20 mb-20">
                <div className="space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Mountain className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xl font-black tracking-tighter uppercase">Agios.AI</span>
                    </div>
                    <p className="text-xs opacity-30 leading-relaxed font-medium max-w-xs uppercase tracking-widest">
                        Orchestrating high-velocity financial pipelines for the Silicon Cape economy.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-20">
                    <div className="space-y-8">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-600 opacity-60">Engine</h4>
                        <ul className="space-y-4 text-[9px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Specifications</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Node Network</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Intelligence</a></li>
                        </ul>
                    </div>
                    <div className="space-y-8">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-600 opacity-60">Legal</h4>
                        <ul className="space-y-4 text-[9px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Ethics</a></li>
                        </ul>
                    </div>
                    <div className="space-y-8">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-600 opacity-60">HQ</h4>
                        <ul className="space-y-4 text-[9px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Cape Town</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Silicon Cape</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Support</a></li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 opacity-20 text-[9px] font-black uppercase tracking-[0.4em]">
                <span>© 2025 AGIOS AI ORCHESTRATION</span>
                <div className="flex gap-12">
                    <span>GMT +2 // Silicon Cape</span>
                    <span>Distributed System Alpha 2.4</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}
