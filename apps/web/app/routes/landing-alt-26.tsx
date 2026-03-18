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
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt26() {
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
      theme === "dark" ? "bg-[#020617] text-slate-200" : "bg-[#f8fafc] text-slate-900"
    )}>
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-10%] right-[-5%] w-[80%] h-[80%] blur-[250px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-600/30" : "bg-blue-400/40"
        )} />
        <div className={cn(
            "absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"
        )} />
      </div>

      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 w-full z-50 border-b backdrop-blur-xl transition-colors duration-500",
        theme === "dark" ? "border-white/5 bg-slate-950/50" : "border-slate-200 bg-white/50"
      )}>
        <div className="container mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Mountain className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xl font-black tracking-tighter leading-none uppercase italic">Agios<span className="text-blue-500">.</span>OS</span>
              <span className="text-[7px] font-bold uppercase tracking-[0.4em] opacity-40 mt-1">Silicon Cape // HQ</span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.4em] opacity-60">
            <a href="#platform" className="hover:text-blue-600 transition-colors">Platform</a>
            <a href="#intelligence" className="hover:text-blue-600 transition-colors">Intelligence</a>
            <a href="#POPIA" className="hover:text-blue-600 transition-colors">POPIA</a>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={toggleTheme} className="h-9 w-9 rounded-full border border-blue-600/10 flex items-center justify-center hover:bg-blue-600/5 transition-colors">
              {theme === "dark" ? <Sun className="h-4 w-4 opacity-40" /> : <Moon className="h-4 w-4 opacity-40" />}
            </button>
            <div className="h-6 w-px bg-slate-500/20" />
            <Link to="/auth/sign-in" className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 hover:opacity-100">Login</Link>
            <Link to="/auth/sign-up">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-10 text-[10px] font-black uppercase tracking-[0.4em] h-11 shadow-2xl shadow-blue-600/20">
                Deploy Unit
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section: Centered Editorial Perspective */}
      <section className="relative h-screen flex flex-col items-center justify-center pt-20 px-8 overflow-hidden">
        <div className="container mx-auto relative z-10 text-center flex flex-col items-center justify-center h-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center max-w-6xl"
          >
            <Badge className={cn(
              "mb-12 py-3 px-10 rounded-full font-bold tracking-[0.3em] uppercase text-[10px] border transition-colors",
              theme === "dark" ? "bg-blue-900/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
            )}>
              Lead Orchestration for Cape Fintech
            </Badge>
            
            <h1 className="text-6xl md:text-[8rem] lg:text-[10rem] font-black tracking-tighter mb-8 leading-[0.85] uppercase italic">
              Scale <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-600 not-italic inline-block pb-4">
                The Cape.
              </span>
            </h1>

            <p className="text-lg md:text-2xl opacity-40 max-w-3xl mx-auto mb-16 font-light leading-relaxed tracking-tight">
              The high-fidelity orchestration layer for South Africa's highest-velocity lead generation pipelines. Autonomous, hardened, and built for the Silicon Cape.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-10 w-full max-w-2xl">
              <Button size="lg" className="h-20 px-16 text-[11px] font-black uppercase tracking-[0.3em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_20px_50px_rgba(37,99,235,0.4)] flex-1 w-full sm:w-auto transform hover:scale-105 transition-all">
                Initialize System
              </Button>
              <div className="flex items-center gap-6 group cursor-pointer opacity-40 hover:opacity-100 transition-opacity">
                <div className="text-left">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">System Sequence</div>
                    <span className="text-xs font-black uppercase tracking-[0.1em]">Technical manual</span>
                </div>
                <div className="h-10 w-10 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <ChevronRight className="h-4 w-4 group-hover:text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Global Hub Status */}
        <div className="absolute bottom-12 left-0 w-full px-12 hidden lg:flex items-center justify-between opacity-30 text-[9px] font-black uppercase tracking-[0.4em]">
            <div className="flex items-center gap-10">
                <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]" />
                    <span>NODE_CPT_PRIMARY // ACTIVE</span>
                </div>
                <div className="h-4 w-px bg-current/20" />
                <span>QUAL_LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-10 text-right">
                <span>PIPELINE_FLOW: R2.4B / MO</span>
                <div className="h-4 w-px bg-current/20" />
                <span>POPIA_GUARD: ENABLED</span>
            </div>
        </div>
      </section>

      {/* Grid: Metrics in Rand */}
      <section id="platform" className={cn(
          "py-40 border-y transition-colors",
          theme === "dark" ? "border-white/5 bg-white/[0.01]" : "border-slate-200 bg-white"
      )}>
        <div className="container mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-24">
                {[
                    { label: "Market Orchestrated", value: "R2.4B+", icon: <TrendingUp className="h-6 w-6 text-blue-500" /> },
                    { label: "Daily Qualified Leads", value: "85k+", icon: <Zap className="h-6 w-6 text-amber-500" /> },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-6 w-6 text-emerald-500" /> },
                    { label: "Active Units", value: "12.8M", icon: <Fingerprint className="h-6 w-6 text-blue-600" /> }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-8 text-left group">
                        <div className="opacity-40 group-hover:scale-110 transition-transform duration-500">{stat.icon}</div>
                        <div className="flex flex-col gap-2">
                            <span className="text-5xl font-black tracking-tighter italic leading-none">{stat.value}</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mt-2">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Feature Block: Neural Intelligence */}
      <section id="intelligence" className="py-48 px-8 relative overflow-hidden text-left">
        <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-32">
                <div className="flex-1 space-y-20">
                    <div className="space-y-8">
                        <Badge className="bg-blue-600 text-white rounded-none px-6 py-2 font-black text-[10px] uppercase tracking-[0.5em]">Agent Logistics</Badge>
                        <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none italic">
                            Elite Agent <br /> <span className="text-blue-600 not-italic">Distribution.</span>
                        </h2>
                        <p className="text-xl md:text-2xl opacity-40 font-light leading-relaxed max-w-xl">
                            Deploy specialized autonomous units trained on localized financial data. From prospecting to qualification, we map the Silicon Cape in real-time.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                        {[
                            { title: "Market Sourcing", desc: "Autonomous agents scan the digital landscape for real-time intent signals." },
                            { title: "Neural Scoring", desc: "Proprietary qualification models built on localized financial readiness data." },
                        ].map((item, i) => (
                            <div key={i} className="space-y-4 group">
                                <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 flex items-center gap-4 italic group-hover:text-blue-500 transition-colors">
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
                        theme === "dark" ? "border-white/10 bg-black shadow-[0_0_100px_rgba(37,99,235,0.1)]" : "border-black/5 bg-white shadow-3xl shadow-black/5"
                    )}>
                        <div className="flex items-center justify-between opacity-30 text-[10px] font-black uppercase tracking-[0.6em]">
                            <span>Module_Alpha_01</span>
                            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center items-center">
                            <Activity className="h-24 w-24 text-blue-600 mb-12 animate-pulse opacity-60" />
                            <div className="text-center space-y-4">
                                <div className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter leading-none text-current opacity-20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none select-none">
                                    AGIOS OS
                                </div>
                                <div className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter leading-none relative z-10">Synchronized</div>
                                <div className="h-1 w-40 bg-blue-600 mx-auto relative z-10" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-blue-600/20 pt-10">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none">Uptime</span>
                                <span className="text-3xl font-black italic leading-none">99.99%</span>
                            </div>
                            <div className="flex flex-col gap-2 text-right">
                                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none text-blue-600">Region</span>
                                <span className="text-3xl font-black italic leading-none uppercase">CPT</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* POPIA: The Absolute Baseline */}
      <section id="POPIA" className={cn(
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
                <h2 className="text-6xl md:text-[8rem] font-black uppercase tracking-tighter italic leading-[0.8] text-center">Hardened <br /> Local Compliance.</h2>
                <p className="text-xl md:text-3xl lg:text-4xl opacity-50 font-light leading-relaxed max-w-5xl mx-auto tracking-tight">
                    POPIA isn't an afterthought. Every lead orchestrated by Agios is processed within a secure, localized South African data environment.
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-24 pt-10 opacity-60">
                {["POPIA Verified", "Bank Grade", "Localized Nodes", "Zero Trust"].map((tag, i) => (
                    <div key={i} className="flex items-center gap-5 group">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-600 group-hover:scale-150 transition-transform" />
                        <span className="text-[13px] font-black uppercase tracking-[0.5em] group-hover:opacity-100 transition-opacity">{tag}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Final Sequence CTA */}
      <section className="py-72 relative flex flex-col items-center justify-center text-center px-10 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 blur-[250px] opacity-30 pointer-events-none" />
        <div className="container mx-auto relative z-10">
            <h2 className="text-8xl md:text-[14rem] lg:text-[18rem] font-black tracking-tighter uppercase leading-[0.7] mb-24 italic relative z-10 text-center">
                Secure <br /> The Flow.
            </h2>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-20 w-full max-w-5xl relative z-10 mx-auto">
                <Link to="/auth/sign-up" className="w-full sm:w-auto">
                    <Button size="lg" className="h-28 px-24 text-[16px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] w-full transform hover:scale-105 transition-all">
                        Initialize Node
                    </Button>
                </Link>
                <div className="text-left group cursor-pointer flex flex-col gap-3 shrink-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">System Integration</div>
                    <div className="flex items-center gap-8 text-blue-600 group-hover:text-blue-500 transition-colors text-left">
                        <span className="text-3xl font-black uppercase tracking-tight italic leading-none">Speak with a <br /> Strategist</span>
                        <ArrowRight className="h-10 w-10 transform group-hover:translate-x-4 transition-transform duration-500" />
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
        <div className="container mx-auto px-10">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-40 mb-40 text-left">
                <div className="space-y-16 text-left">
                    <div className="flex items-center gap-8">
                        <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/20">
                            <Mountain className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-4xl font-black tracking-tighter uppercase italic leading-none">Agios<span className="text-blue-600">.</span>OS</span>
                    </div>
                    <p className="text-lg opacity-30 leading-relaxed font-medium max-w-md uppercase tracking-[0.2em] italic">
                        The definitive orchestration standard for South African fintech. Decentralized. Autonomous. Hardened.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-32 text-left flex-1">
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">System</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Blueprint</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Nodes</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">Legal</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GDPR</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">HQ</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Cape Town</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GMT+2</a></li>
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
            
            <div className="pt-20 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-16 opacity-20 text-[12px] font-black uppercase tracking-[0.8em] text-left">
                <div className="flex items-center gap-24 text-left">
                    <span>© 2025 AGIOS ORCHESTRATION INC.</span>
                    <span className="hidden md:block">Cape Town // South Africa</span>
                </div>
                <div className="flex gap-24 italic text-left">
                    <span>Industrial.</span>
                    <span>Absolute.</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}
