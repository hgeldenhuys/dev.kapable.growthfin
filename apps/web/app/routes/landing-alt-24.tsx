import { Link } from "react-router";
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Sun,
  Moon,
  Mountain,
  Activity,
  ChevronRight,
  TrendingUp,
  Fingerprint,
  Lock
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt24() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setMounted(true);
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
    }
  }, []);

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  if (!mounted) return null;

  return (
    <div ref={containerRef} className={cn(
      "min-h-screen transition-colors duration-1000 font-sans selection:bg-blue-600/30 overflow-x-hidden text-left",
      theme === "dark" ? "bg-[#000000] text-slate-200" : "bg-[#ffffff] text-slate-900"
    )}>
      {/* Cinematic Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-20%] left-[-10%] w-[100%] h-[100%] blur-[250px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-600/40" : "bg-blue-200/50"
        )} />
        <div className={cn(
            "absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none",
            "bg-[radial-gradient(circle_at_center,currentColor_1px,transparent_1px)] bg-[size:40px_40px]"
        )} />
      </div>

      {/* Floating Modern Header */}
      <nav className="fixed top-8 left-0 w-full z-50 px-10">
        <div className={cn(
            "container mx-auto h-16 rounded-full border backdrop-blur-2xl px-8 flex items-center justify-between transition-all duration-500",
            theme === "dark" ? "bg-black/60 border-white/10 shadow-2xl" : "bg-white/60 border-black/5 shadow-xl"
        )}>
            <div className="flex items-center gap-4 group cursor-pointer">
                <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30 transform group-hover:rotate-12 transition-transform">
                    <Mountain className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-lg font-black tracking-tighter leading-none uppercase italic">Agios<span className="text-blue-600">.</span>Prime</span>
                    <span className="text-[7px] font-bold uppercase tracking-[0.5em] opacity-40 mt-0.5">Silicon Cape HQ</span>
                </div>
            </div>

            <div className="hidden lg:flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
                <a href="#engine" className="hover:opacity-100 transition-opacity">Engine</a>
                <a href="#logic" className="hover:opacity-100 transition-opacity">Logic</a>
                <a href="#compliance" className="hover:opacity-100 transition-opacity">Compliance</a>
            </div>

            <div className="flex items-center gap-6">
                <button onClick={toggleTheme} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-blue-600/10 transition-colors">
                    {theme === "dark" ? <Sun className="h-4 w-4 opacity-50" /> : <Moon className="h-4 w-4 opacity-50" />}
                </button>
                <div className="h-6 w-px bg-slate-500/20" />
                <Link to="/auth/sign-in" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition-opacity">Login</Link>
                <Link to="/auth/sign-up">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 text-[10px] font-black uppercase tracking-[0.2em] h-10 shadow-lg shadow-blue-600/20">
                        Deploy Node
                    </Button>
                </Link>
            </div>
        </div>
      </nav>

      {/* Hero Section: Centered & Massive Typography */}
      <section className="relative h-screen flex flex-col items-center justify-center px-10 overflow-hidden text-center">
        <div className="container mx-auto relative z-10 flex flex-col items-center justify-center h-full">
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center max-w-[1500px]"
            >
                <Badge className={cn(
                    "mb-12 py-3 px-10 rounded-full font-black tracking-[0.5em] uppercase text-[10px] border-2 transition-colors",
                    theme === "dark" ? "bg-blue-900/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
                )}>
                    The Orchestration Engine for Silicon Cape Fintech
                </Badge>
                
                <h1 className="text-7xl md:text-9xl lg:text-[12rem] xl:text-[15rem] font-black tracking-tighter mb-10 leading-[0.75] uppercase italic text-center shrink-0">
                    <span className="block">Orchestrate</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-800 inline-block not-italic pb-4 leading-tight">
                        The Future.
                    </span>
                </h1>

                <p className="text-xl md:text-3xl opacity-40 max-w-5xl mx-auto mb-20 font-light leading-relaxed tracking-tight shrink-0">
                    Agios AI powers the highest-velocity financial lead pipelines in South Africa. 
                    Built for the R100M+ environment. POPIA hardened.
                </p>
                
                <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full max-w-3xl shrink-0">
                    <Button size="lg" className="h-24 px-20 text-[14px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] flex-1 transform hover:scale-105 transition-all">
                        Initialize Node
                    </Button>
                    <div className="flex items-center gap-8 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity shrink-0">
                        <div className="text-left space-y-1">
                            <div className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">Technical Specs</div>
                            <span className="text-lg font-black uppercase tracking-[0.1em] italic">System Architecture</span>
                        </div>
                        <div className="h-14 w-14 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-2xl">
                            <ChevronRight className="h-6 w-6 group-hover:text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>

        {/* Tactical Hub Status Line */}
        <div className="absolute bottom-16 left-0 w-full px-16 hidden lg:flex items-center justify-between opacity-30 text-[10px] font-black uppercase tracking-[0.6em]">
            <div className="flex items-center gap-12">
                <div className="flex items-center gap-4 text-left">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
                    <span>SYTEM_NODE_01 // READY</span>
                </div>
                <div className="h-5 w-px bg-current/20" />
                <span>LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-12">
                <span>THROUGHPUT: R2.4B/MO</span>
                <div className="h-5 w-px bg-current/20" />
                <span>POPIA_HARDENING: ACTIVE</span>
            </div>
        </div>
      </section>

      {/* Grid: High Density Logic */}
      <section id="engine" className={cn(
          "py-48 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-black/5"
      )}>
        <div className="container mx-auto px-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-32">
                {[
                    { label: "Market Orchestrated", value: "R2.4B+", icon: <TrendingUp className="h-8 w-8 text-blue-500" /> },
                    { label: "Daily Qualified leads", value: "85k+", icon: <Zap className="h-8 w-8 text-amber-500" /> },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-8 w-8 text-emerald-500" /> },
                    { label: "Active Agent Units", value: "12.8M", icon: <Fingerprint className="h-8 w-8 text-blue-600" /> }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-12 text-left group">
                        <div className="opacity-60 transform group-hover:scale-110 transition-transform duration-500">{stat.icon}</div>
                        <div className="flex flex-col gap-4">
                            <span className="text-6xl md:text-7xl font-black tracking-tighter italic leading-none">{stat.value}</span>
                            <span className="text-[11px] font-black uppercase tracking-[0.5em] opacity-40 mt-2">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Logic Grid: High Performance Architecture */}
      <section id="logic" className="py-48 px-10 relative overflow-hidden text-left">
        <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-40">
                <div className="flex-1 space-y-20">
                    <div className="space-y-8">
                        <Badge className="bg-blue-600 text-white rounded-none px-6 py-2 font-black text-[11px] uppercase tracking-[0.5em]">System Core</Badge>
                        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none italic">
                            Absolute <br /> <span className="text-blue-600 not-italic">Precision.</span>
                        </h2>
                        <p className="text-xl md:text-2xl opacity-50 font-light leading-relaxed max-w-2xl">
                            Deploy specialized autonomous units trained on localized financial data. From cold-prospecting to deep qualification, we map the Silicon Cape in real-time.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                        {[
                            { title: "Market Sourcing", desc: "Autonomous agents scan the digital landscape for real-time intent signals." },
                            { title: "Neural Scoring", desc: "Proprietary qualification models built on localized financial readiness data." },
                            { title: "Dynamic Routing", desc: "Distribution of qualified prospects to high-performance nodes." },
                            { title: "Hardened Security", desc: "Data masking and encryption standards exceeding regional bank grade." }
                        ].map((item, i) => (
                            <div key={i} className="space-y-4 group">
                                <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 flex items-center gap-4 italic">
                                    <span className="h-px w-8 bg-blue-600/30 group-hover:w-12 transition-all" /> 
                                    {item.title}
                                </h3>
                                <p className="text-base opacity-40 font-light leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full lg:w-[45%] relative shrink-0">
                    <div className={cn(
                        "aspect-square relative border-2 p-16 flex flex-col justify-between transition-all duration-1000 overflow-hidden",
                        theme === "dark" ? "border-white/10 bg-black shadow-[0_0_150px_rgba(37,99,235,0.1)]" : "border-black/5 bg-slate-50 shadow-3xl shadow-black/5"
                    )}>
                        <div className="flex items-center justify-between opacity-30 text-[10px] font-black uppercase tracking-[0.6em]">
                            <span>Unit_Alpha_09</span>
                            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center items-center">
                            <Activity className="h-24 w-24 text-blue-600 mb-12 animate-pulse opacity-60" />
                            <div className="text-center space-y-6">
                                <div className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter leading-none">Synchronized</div>
                                <div className="h-1 w-40 bg-blue-600 mx-auto" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-blue-600/20 pt-10">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none">Node Uptime</span>
                                <span className="text-3xl font-black italic leading-none">99.99%</span>
                            </div>
                            <div className="flex flex-col gap-2 text-right">
                                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none text-blue-600">Region</span>
                                <span className="text-3xl font-black italic leading-none uppercase">CPT // HQ</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* POPIA Section */}
      <section id="compliance" className={cn(
          "py-48 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01]" : "bg-slate-50"
      )}>
        <div className="container mx-auto px-10 max-w-6xl text-center space-y-24">
            <div className="flex justify-center">
                <div className="h-32 w-32 border-2 border-blue-600 flex items-center justify-center rounded-sm rotate-45 transform hover:rotate-[225deg] transition-all duration-1000 cursor-pointer group">
                    <Lock className="h-14 w-14 text-blue-600 -rotate-45 group-hover:scale-110 transition-transform" />
                </div>
            </div>
            <div className="space-y-10">
                <h2 className="text-7xl md:text-9xl font-black uppercase tracking-tighter italic leading-[0.8]">Hardened <br /> Compliance.</h2>
                <p className="text-xl md:text-3xl lg:text-4xl opacity-50 font-light leading-relaxed max-w-5xl mx-auto tracking-tight">
                    POPIA is our foundation. Every lead orchestrated by Agios is processed within a secure, localized South African data environment.
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-24 pt-10 opacity-60 text-left md:text-center">
                {["POPIA Verified", "Bank Grade", "Localized Nodes", "Zero Trust"].map((tag, i) => (
                    <div key={i} className="flex items-center gap-5 group">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-600 group-hover:scale-150 transition-transform" />
                        <span className="text-[13px] font-black uppercase tracking-[0.5em]">{tag}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Final Sequence CTA */}
      <section className="py-72 relative flex flex-col items-center justify-center text-center px-10 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 blur-[250px] opacity-40 pointer-events-none" />
        <div className="container mx-auto relative z-10 flex flex-col items-center">
            <h2 className="text-[14vw] md:text-[18rem] lg:text-[22rem] font-black tracking-tighter uppercase leading-[0.7] mb-32 italic text-current opacity-[0.03] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none select-none">
                AGIOS PRIME
            </h2>
            
            <h2 className="text-8xl md:text-[14rem] lg:text-[18rem] font-black tracking-tighter uppercase leading-[0.7] mb-24 italic relative z-10">
                Secure <br /> The Flow.
            </h2>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-20 w-full max-w-5xl relative z-10">
                <Link to="/auth/sign-up" className="w-full sm:w-auto">
                    <Button size="lg" className="h-28 px-24 text-[16px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] w-full transform hover:scale-105 transition-all">
                        Initialize Node
                    </Button>
                </Link>
                <div className="text-left group cursor-pointer flex flex-col gap-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">System Sequence</div>
                    <div className="flex items-center gap-8 text-blue-600 group-hover:text-blue-500 transition-colors">
                        <span className="text-3xl font-black uppercase tracking-tight italic leading-none">Speak with a <br /> Strategist</span>
                        <ArrowRight className="h-14 w-14 transform group-hover:translate-x-6 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Industrial Footer */}
      <footer className={cn(
        "py-32 border-t transition-colors duration-1000",
        theme === "dark" ? "bg-[#000000] border-white/5" : "bg-white border-black/5"
      )}>
        <div className="container mx-auto px-20">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-40 mb-40 text-left">
                <div className="space-y-16 text-left">
                    <div className="flex items-center gap-6">
                        <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/20">
                            <Mountain className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-4xl font-black tracking-tighter uppercase italic leading-none">Agios<span className="text-blue-600">.</span>OS</span>
                    </div>
                    <p className="text-lg opacity-30 leading-relaxed font-medium max-w-md uppercase tracking-[0.2em] italic">
                        The absolute orchestration standard for South African fintech. Decentralized. Autonomous. Hardened.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-32 text-left flex-1">
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">System</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Specs</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Nodes</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">Legal</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">Region</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Silicon Cape</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Support</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">Network</h4>
                        <div className="flex gap-8 pt-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-12 w-12 border-2 border-white/10 rounded-sm flex items-center justify-center hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all cursor-pointer shadow-xl">
                                    <Fingerprint className="h-5 w-5" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="pt-20 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-16 opacity-20 text-[12px] font-black uppercase tracking-[0.8em]">
                <div className="flex items-center gap-24 text-left">
                    <span>© 2025 AGIOS ORCHESTRATION INC.</span>
                    <span className="hidden md:block">Cape Town // South Africa</span>
                </div>
                <div className="flex gap-24 italic">
                    <span>Precision.</span>
                    <span>Power.</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}
