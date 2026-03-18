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
  Lock,
  Network
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt25() {
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
      "min-h-screen transition-colors duration-1000 font-sans selection:bg-blue-600/30 overflow-x-hidden text-left",
      theme === "dark" ? "bg-[#050505] text-slate-100" : "bg-[#fcfcfc] text-slate-900"
    )}>
      {/* Visual Background: The Silicon Cape Pulse */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-10%] right-[-5%] w-[80%] h-[80%] blur-[250px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-600/40" : "bg-blue-300/50"
        )} />
        <div className={cn(
            "absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none",
            "bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:60px_60px]"
        )} />
      </div>

      {/* Floating Precision Header */}
      <header className="fixed top-0 w-full z-50 px-10 h-32 flex items-center">
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-5 group cursor-pointer text-left">
                <div className="h-11 w-11 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.4)] group-hover:scale-105 transition-transform">
                    <Mountain className="h-6 w-6 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black tracking-tighter leading-none uppercase">Agios<span className="text-blue-600">.</span>Prime</span>
                    <span className="text-[8px] font-bold uppercase tracking-[0.5em] opacity-40 mt-1">Silicon Cape // HQ</span>
                </div>
            </div>

            <div className="hidden lg:flex items-center gap-16 text-[10px] font-black uppercase tracking-[0.4em] opacity-50">
                <a href="#pipeline" className="hover:text-blue-600 transition-colors">The Engine</a>
                <a href="#logic" className="hover:text-blue-600 transition-colors">Neural Logic</a>
                <a href="#compliance" className="hover:text-blue-600 transition-colors">POPIA</a>
            </div>

            <div className="flex items-center gap-8">
                <button onClick={toggleTheme} className="h-10 w-10 rounded-full border border-blue-600/10 flex items-center justify-center hover:bg-blue-600/5 transition-colors">
                    {theme === "dark" ? <Sun className="h-4 w-4 opacity-40" /> : <Moon className="h-4 w-4 opacity-40" />}
                </button>
                <div className="h-8 w-px bg-current/10" />
                <Link to="/auth/sign-in" className="text-[11px] font-black uppercase tracking-[0.3em] opacity-50 hover:opacity-100 transition-opacity">Login</Link>
                <Link to="/auth/sign-up">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-12 text-[11px] font-black uppercase tracking-[0.3em] h-12 shadow-2xl shadow-blue-600/20">
                        Deploy Unit
                    </Button>
                </Link>
            </div>
        </div>
      </header>

      {/* Hero Section: The Absolute Peak */}
      <section className="relative h-screen flex flex-col items-center justify-center px-10 overflow-hidden text-center">
        <div className="container mx-auto relative z-10 flex flex-col items-center justify-center max-w-[1600px] h-full">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center w-full -mt-20"
            >
                <Badge className={cn(
                    "mb-12 py-3 px-12 rounded-full font-black tracking-[0.5em] uppercase text-[11px] border-2 transition-colors shrink-0",
                    theme === "dark" ? "bg-blue-950/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
                )}>
                    High-Velocity Lead Orchestration // v4.1.0
                </Badge>
                
                <h1 className="text-7xl md:text-9xl lg:text-[12rem] xl:text-[14rem] font-black tracking-tighter mb-10 leading-[0.75] uppercase italic text-center shrink-0">
                    <span className="block">Orchestrate</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-emerald-500 inline-block not-italic pb-4 leading-tight">
                        The Cape.
                    </span>
                </h1>

                <p className="text-xl md:text-3xl lg:text-4xl opacity-40 max-w-5xl mx-auto mb-20 font-light leading-relaxed tracking-tight shrink-0">
                    Agios AI is the absolute standard for South Africa's highest-velocity lead generation pipelines. Autonomous. Hardened. Absolute.
                </p>
                
                <div className="flex flex-col md:flex-row items-center justify-center gap-16 w-full max-w-4xl shrink-0">
                    <Button size="lg" className="h-28 px-24 text-[14px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_50px_150px_rgba(37,99,235,0.6)] flex-1 transform hover:scale-105 transition-all">
                        Initialize Node
                    </Button>
                    <div className="flex items-center gap-10 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity shrink-0">
                        <div className="text-left space-y-1">
                            <div className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">System Access</div>
                            <span className="text-xl font-black uppercase tracking-[0.1em] italic">Technical Manual</span>
                        </div>
                        <div className="h-16 w-16 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-2xl">
                            <ChevronRight className="h-6 w-6 group-hover:text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>

        {/* Global Hub Status Line - Fixed to bottom with safe margins */}
        <div className="absolute bottom-12 left-0 w-full px-20 hidden lg:flex items-center justify-between opacity-30 text-[11px] font-black uppercase tracking-[0.6em] pointer-events-none">
            <div className="flex items-center gap-12">
                <div className="flex items-center gap-4 text-left">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_20px_rgba(16,185,129,1)]" />
                    <span>NODE_CPT_PRIMARY // SYNCHRONIZED</span>
                </div>
                <div className="h-6 w-px bg-current/20" />
                <span>QUAL_LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-12 text-right">
                <span>PIPELINE_THROUGHPUT: R3.4B / MO</span>
                <div className="h-6 w-px bg-current/20" />
                <span>POPIA_HARDENING: ENABLED</span>
            </div>
        </div>
      </section>

      {/* Grid Section: Rand Denominated Growth */}
      <section id="pipeline" className={cn(
          "py-52 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-black/5"
      )}>
        <div className="container mx-auto px-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-40">
                {[
                    { label: "Market Orchestrated", value: "R3.4B+", icon: <TrendingUp className="h-10 w-10 text-blue-500" /> },
                    { label: "Daily Qualified Leads", value: "125k+", icon: <Zap className="h-10 w-10 text-amber-500" /> },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-10 w-10 text-emerald-500" /> },
                    { label: "Active Agent Units", value: "12.8M", icon: <Fingerprint className="h-10 w-10 text-blue-600" /> }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-12 text-left group">
                        <div className="opacity-60 transform group-hover:scale-110 transition-transform duration-500">{stat.icon}</div>
                        <div className="flex flex-col gap-4">
                            <span className="text-7xl md:text-8xl font-black tracking-tighter italic leading-none">{stat.value}</span>
                            <span className="text-[12px] font-black uppercase tracking-[0.5em] opacity-40 mt-4 leading-none">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Agent Logic: Industrial Strength */}
      <section id="logic" className="py-52 px-20 relative overflow-hidden text-left">
        <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-48">
                <div className="flex-1 space-y-24">
                    <div className="space-y-10">
                        <Badge className="bg-blue-600 text-white rounded-none px-8 py-2.5 font-black text-[12px] uppercase tracking-[0.6em]">Distributed Engine</Badge>
                        <h2 className="text-7xl md:text-9xl font-black uppercase tracking-tighter leading-none italic">
                            Elite Node <br /> <span className="text-blue-600 not-italic">Logistics.</span>
                        </h2>
                        <p className="text-2xl md:text-3xl opacity-40 font-light leading-relaxed max-w-3xl tracking-tight">
                            Deploy specialized autonomous units trained on high-fidelity financial data. From prospecting to qualification, we orchestrate the entire Silicon Cape in real-time.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                        {[
                            { title: "Market Scanning", desc: "Autonomous agents monitor intent signals across 50M+ South African data points." },
                            { title: "Neural Scoring", desc: "Proprietary qualification models built on localized financial readiness data." },
                            { title: "Dynamic Routing", desc: "Instant distribution of qualified prospects to high-performance closing nodes." },
                            { title: "Hardened Security", desc: "Zero-trust data masking protocols exceeding regional bank grade." }
                        ].map((item, i) => (
                            <div key={i} className="space-y-6 group">
                                <h3 className="text-lg font-black uppercase tracking-widest text-blue-600 flex items-center gap-6 italic">
                                    <span className="h-px w-12 bg-blue-600/30 group-hover:w-20 transition-all" /> 
                                    {item.title}
                                </h3>
                                <p className="text-lg opacity-40 font-light leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full lg:w-[45%] relative shrink-0">
                    <div className={cn(
                        "aspect-square relative border-2 p-20 flex flex-col justify-between transition-all duration-1000 overflow-hidden",
                        theme === "dark" ? "border-white/10 bg-black shadow-[0_0_200px_rgba(37,99,235,0.15)]" : "border-black/5 bg-white shadow-3xl shadow-black/5"
                    )}>
                        <div className="flex items-center justify-between opacity-30 text-[11px] font-black uppercase tracking-[0.8em]">
                            <span>Engine_Module_09</span>
                            <div className="h-3 w-3 rounded-full bg-blue-600 animate-pulse" />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center items-center relative">
                            <Network className="h-32 w-32 text-blue-600 mb-16 animate-pulse opacity-40" />
                            <div className="text-center space-y-6 relative z-10">
                                <div className="text-6xl lg:text-[6rem] font-black italic uppercase tracking-tighter leading-none">Synchronized</div>
                                <div className="h-1.5 w-48 bg-blue-600 mx-auto" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-blue-600/20 pt-12">
                            <div className="flex flex-col gap-3">
                                <span className="text-[12px] font-black uppercase opacity-40 tracking-widest leading-none">Uptime</span>
                                <span className="text-4xl font-black italic leading-none">99.99%</span>
                            </div>
                            <div className="flex flex-col gap-3 text-right">
                                <span className="text-[12px] font-black uppercase opacity-40 tracking-widest leading-none text-blue-600">Region</span>
                                <span className="text-4xl font-black italic leading-none uppercase text-current">CPT</span>
                            </div>
                        </div>
                    </div>
                    {/* Visual Offset */}
                    <div className="absolute -top-16 -left-16 p-12 border border-blue-600/20 shadow-3xl hidden md:block backdrop-blur-3xl transition-colors duration-1000">
                        <Activity className="h-10 w-10 text-blue-600 animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* POPIA: The Absolute Baseline */}
      <section id="compliance" className={cn(
          "py-52 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01]" : "bg-slate-50"
      )}>
        <div className="container mx-auto px-20 max-w-[1400px] text-center space-y-32">
            <div className="flex justify-center">
                <div className="h-40 w-40 border-2 border-blue-600 flex items-center justify-center rounded-sm rotate-45 transform hover:rotate-[225deg] transition-all duration-1000 cursor-pointer group">
                    <Lock className="h-16 w-16 text-blue-600 -rotate-45 group-hover:scale-110 transition-transform" />
                </div>
            </div>
            <div className="space-y-12">
                <h2 className="text-7xl md:text-[10rem] font-black uppercase tracking-tighter italic leading-[0.8]">Hardened <br /> Local Compliance.</h2>
                <p className="text-2xl md:text-4xl opacity-50 font-light leading-relaxed max-w-6xl mx-auto tracking-tight">
                    POPIA isn't an afterthought. Every lead orchestrated by Agios is processed within a secure, localized South African data environment, meeting the highest standards of financial security.
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-32 pt-10 opacity-60">
                {["POPIA Verified", "Bank Grade", "Localized Nodes", "Zero Trust Architecture"].map((tag, i) => (
                    <div key={i} className="flex items-center gap-6 group">
                        <div className="h-3 w-3 rounded-full bg-blue-600 group-hover:scale-150 transition-transform" />
                        <span className="text-[16px] font-black uppercase tracking-[0.6em] group-hover:opacity-100 transition-opacity">{tag}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Final Sequence: Initialization */}
      <section className="py-80 relative flex flex-col items-center justify-center text-center px-10 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 blur-[250px] opacity-40 pointer-events-none" />
        <div className="container mx-auto relative z-10 flex flex-col items-center">
            <h2 className="text-[15vw] md:text-[20rem] lg:text-[24rem] font-black tracking-tighter uppercase leading-[0.7] mb-32 italic text-current opacity-[0.03] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none select-none">
                AGIOS PRIME
            </h2>
            
            <h2 className="text-8xl md:text-[16rem] lg:text-[20rem] font-black tracking-tighter uppercase leading-[0.7] mb-24 italic relative z-10">
                Secure <br /> The Flow.
            </h2>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-24 w-full max-w-6xl relative z-10">
                <Link to="/auth/sign-up" className="w-full sm:w-auto">
                    <Button size="lg" className="h-32 px-24 text-[18px] font-black uppercase tracking-[0.6em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_60px_150px_rgba(37,99,235,0.7)] w-full transform hover:scale-105 transition-all">
                        Initialize Node
                    </Button>
                </Link>
                <div className="text-left group cursor-pointer flex flex-col gap-4">
                    <div className="text-[12px] font-black uppercase tracking-[0.4em] opacity-40">System Sequence</div>
                    <div className="flex items-center gap-10 text-blue-600 group-hover:text-blue-500 transition-colors text-left">
                        <span className="text-4xl font-black uppercase tracking-tight italic leading-none">Speak with a <br /> Strategist</span>
                        <ArrowRight className="h-16 w-16 transform group-hover:translate-x-8 transition-transform duration-500" />
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
                    <div className="flex items-center gap-8">
                        <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/20">
                            <Mountain className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-4xl font-black tracking-tighter uppercase italic leading-none">Agios<span className="text-blue-600">.</span>OS</span>
                    </div>
                    <p className="text-lg opacity-30 leading-relaxed font-medium max-w-md uppercase tracking-[0.2em] italic">
                        The definitive orchestration standard for high-velocity Silicon Cape financial systems. Decentralized. Autonomous. Hardened.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-32 text-left flex-1">
                    <div className="space-y-12">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">Engine</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Specs</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Nodes</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">Legal</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">Region</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Cape Town</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GMT+2</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">Identity</h4>
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
            
            <div className="pt-20 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-16 opacity-20 text-[12px] font-black uppercase tracking-[0.8em] text-left">
                <div className="flex items-center gap-24">
                    <span>© 2025 AGIOS ORCHESTRATION INC.</span>
                    <span className="hidden md:block">Cape Town // South Africa</span>
                </div>
                <div className="flex gap-24 italic">
                    <span>Industrial.</span>
                    <span>Absolute.</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}
