import { Link } from "react-router";
import { 
  ShieldCheck, 
  Sun,
  Moon,
  Mountain,
  Activity,
  ChevronRight,
  TrendingUp,
  Zap,
  Lock,
  ArrowRight,
  Fingerprint
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt51() {
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
      "min-h-screen transition-colors duration-1000 font-sans selection:bg-blue-600/30 overflow-x-hidden text-left flex flex-col",
      theme === "dark" ? "bg-[#000000] text-slate-100" : "bg-[#ffffff] text-slate-900"
    )}>
      {/* Visual Background Decor: Refined Depth */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-20%] left-[-10%] w-[100%] h-[100%] blur-[250px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-600/30" : "bg-blue-400/20"
        )} />
        <div className={cn(
            "absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(circle_at_center,currentColor_1px,transparent_1px)] bg-[size:40px_40px]"
        )} />
      </div>

      {/* Floating Modern Header */}
      <header className="fixed top-8 left-0 w-full z-50 px-10">
        <div className={cn(
            "container mx-auto h-16 rounded-full border backdrop-blur-2xl px-8 flex items-center justify-between transition-all duration-500 shadow-2xl",
            theme === "dark" ? "bg-black/60 border-white/10" : "bg-white/70 border-black/5 shadow-black/5"
        )}>
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30 transform group-hover:rotate-12 transition-transform">
              <Mountain className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xl font-black tracking-tight leading-none uppercase italic">Agios<span className="text-blue-600">.</span>OS</span>
              <span className="text-[7px] font-bold uppercase tracking-[0.4em] opacity-40 mt-0.5 leading-none">Silicon Cape HQ</span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
            <a href="#pipeline" className="hover:text-blue-600 transition-colors">Performance</a>
            <a href="#compliance" className="hover:text-blue-600 transition-colors">Compliance</a>
          </div>

          <div className="flex items-center gap-8">
            <button onClick={toggleTheme} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-blue-600/10 transition-colors">
              {theme === "dark" ? <Sun className="h-4 w-4 opacity-50" /> : <Moon className="h-4 w-4 opacity-50" />}
            </button>
            <div className="h-6 w-px bg-slate-500/20" />
            <Link to="/auth/sign-in" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition-opacity">Login</Link>
            <Link to="/auth/sign-up">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-10 text-[10px] font-black uppercase tracking-[0.4em] h-10 shadow-2xl shadow-blue-600/20">
                Deploy Node
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section: Centered Editorial Perspective */}
      <section className="relative h-screen flex flex-col items-center justify-center px-10 overflow-hidden text-center shrink-0">
        <div className="container mx-auto relative z-10 flex flex-col items-center justify-center h-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center max-w-[1500px]"
          >
            <Badge className={cn(
              "mb-12 py-3 px-10 rounded-full font-black tracking-[0.5em] uppercase text-[10px] border-2 transition-colors shrink-0",
              theme === "dark" ? "bg-blue-950/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600 shadow-sm"
            )}>
              Advanced Lead Orchestration for Cape Fintech // v4.5.1
            </Badge>
            
            <h1 className="text-6xl md:text-8xl lg:text-[11rem] xl:text-[13rem] font-black tracking-tighter mb-10 leading-[0.8] uppercase italic text-center shrink-0">
              <span className="block text-current opacity-90">Powering</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-700 inline-block not-italic pb-6 leading-tight">
                Cape Growth.
              </span>
            </h1>

            <p className="text-xl md:text-2xl lg:text-3xl opacity-40 max-w-4xl mx-auto mb-20 font-light leading-relaxed tracking-tight shrink-0 text-center">
              Agios AI is the high-fidelity orchestration layer for South Africa's highest-velocity lead generation pipelines. Autonomous. Hardened. Infinite.
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-16 w-full max-w-3xl shrink-0">
              <Button size="lg" className="h-24 px-20 text-[14px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] flex-1 transform hover:scale-105 transition-all">
                Initialize System
              </Button>
              <div className="text-left group cursor-pointer flex items-center gap-10 opacity-60 hover:opacity-100 transition-opacity shrink-0">
                <div className="flex flex-col gap-1 text-left leading-none">
                    <div className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40 leading-none">System Access</div>
                    <span className="text-2xl font-black uppercase tracking-tight italic leading-none text-current">Technical Manual</span>
                </div>
                <div className="h-14 w-14 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-2xl">
                  <ChevronRight className="h-6 w-6 group-hover:text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tactical Status Hub Bar - Positioned at safe distance with increased padding */}
        <div className={cn(
            "absolute bottom-16 left-0 w-full px-20 hidden lg:flex items-center justify-between font-black uppercase tracking-[0.6em] pointer-events-none transition-colors",
            theme === "dark" ? "opacity-20 text-white" : "opacity-40 text-slate-900"
        )}>
            <div className="flex items-center gap-12 text-left text-[11px] leading-none">
                <div className="flex items-center gap-4">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
                    <span>NODE_CPT_PRIMARY // SYNCHRONIZED</span>
                </div>
                <div className="h-6 w-px bg-current/20" />
                <span>LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-12 text-right text-[11px] leading-none">
                <span>THROUGHPUT: R2.4B / MO</span>
                <div className="h-6 w-px bg-current/20" />
                <span>POPIA_HARDENING: ACTIVE</span>
            </div>
        </div>
      </section>

      {/* Grid Section: High Fidelity Performance - Spacious Layout */}
      <section id="pipeline" className={cn(
          "py-80 border-y transition-colors shrink-0 relative z-10",
          theme === "dark" ? "bg-[#020617] border-white/5 shadow-[inset_0_0_150px_rgba(0,0,0,0.5)]" : "bg-[#fcfcfc] border-slate-100 shadow-inner"
      )}>
        <div className="container mx-auto px-20 max-w-[1600px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-40 text-left">
                {[
                    { label: "Market Orchestrated", value: "R3.4B+", icon: <TrendingUp className="h-8 w-8 text-blue-600" />, desc: "Total monthly pipeline volume." },
                    { label: "Daily qualified population", value: "125k+", icon: <Zap className="h-8 w-8 text-amber-500" />, desc: "Autonomous lead generation units." },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-8 w-8 text-emerald-500" />, desc: "Regulatory hardened score." },
                    { label: "Agent Population", value: "12.8M", icon: <Fingerprint className="h-8 w-8 text-blue-600" />, desc: "Distributed autonomous agents." }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-14 text-left group">
                        <div className="opacity-60 transform group-hover:scale-110 transition-transform duration-500">{stat.icon}</div>
                        <div className="flex flex-col gap-6">
                            <span className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter italic leading-none">{stat.value}</span>
                            <div className="space-y-4">
                                <span className="text-[12px] font-black uppercase tracking-[0.5em] opacity-40 leading-none block">{stat.label}</span>
                                <p className="text-[11px] font-bold uppercase tracking-widest opacity-30 leading-relaxed max-w-xs">{stat.desc}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Compliance Block: Regional Baseline */}
      <section id="compliance" className="py-64 px-10 relative overflow-hidden shrink-0">
        <div className="container mx-auto max-w-6xl text-center space-y-32">
            <div className="flex justify-center">
                <div className="h-32 w-32 border-2 border-blue-600 flex items-center justify-center rounded-full transform hover:scale-110 transition-all duration-1000 cursor-pointer group shadow-2xl">
                    <ShieldCheck className="h-14 w-14 text-blue-600 group-hover:scale-110 transition-transform" />
                </div>
            </div>
            <div className="space-y-12 text-left md:text-center">
                <h2 className="text-7xl md:text-[10rem] font-black uppercase tracking-tighter italic leading-[0.8] text-center text-current">Hardened <br /> Regional Compliance.</h2>
                <p className="text-2xl md:text-4xl opacity-50 font-light leading-relaxed max-w-6xl mx-auto tracking-tight text-center text-current">
                    POPIA is our baseline. Every lead orchestrated by Agios is processed within a secure, localized South African data environment.
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-32 pt-10 opacity-60">
                {["POPIA Verified", "Bank Grade", "Localized Nodes", "Zero Trust"].map((tag, i) => (
                    <div key={i} className="flex items-center gap-6 group">
                        <div className="h-3 w-3 rounded-full bg-blue-600 group-hover:scale-150 transition-transform" />
                        <span className="text-[16px] font-black uppercase tracking-[0.6em] group-hover:opacity-100 transition-opacity leading-none text-current">{tag}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Industrial Footer */}
      <footer className={cn(
        "py-32 border-t transition-colors duration-1000 shrink-0",
        theme === "dark" ? "bg-[#000000] border-white/5" : "bg-[#fcfcfc] border-black/5 shadow-2xl"
      )}>
        <div className="container mx-auto px-20">
            {/* CTA Final */}
            <div className="py-72 text-center relative mb-48 flex flex-col items-center">
                <div className="absolute inset-0 bg-blue-600/5 blur-[200px] opacity-30 pointer-events-none" />
                <h2 className="text-8xl md:text-[16rem] lg:text-[22rem] font-black tracking-tighter uppercase leading-[0.7] mb-24 italic relative z-10 text-center text-current">
                    Secure <br /> The Flow.
                </h2>
                <div className="flex flex-col md:flex-row items-center justify-center gap-24 relative z-10 mx-auto w-full max-w-6xl">
                    <Link to="/auth/sign-up" className="w-full sm:w-auto flex-1">
                        <Button size="lg" className="h-32 px-24 text-[18px] font-black uppercase tracking-[0.8em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_60px_150px_rgba(37,99,235,0.8)] w-full transform hover:scale-105 transition-all">
                            Initialize Node
                        </Button>
                    </Link>
                    <div className="text-left group cursor-pointer flex flex-col gap-4 shrink-0 text-current">
                        <div className="text-[12px] font-black uppercase tracking-[0.4em] opacity-40 leading-none">System Integration</div>
                        <div className="flex items-center gap-10 text-blue-600 group-hover:text-blue-500 transition-colors text-left leading-none">
                            <span className="text-4xl font-black uppercase tracking-tight italic leading-none">Speak with a <br /> Strategist</span>
                            <ArrowRight className="h-12 w-12 transform group-hover:translate-x-10 transition-transform duration-500" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row items-start justify-between gap-48 mb-40 text-left pt-32 border-t border-current/5">
                <div className="space-y-16 text-left">
                    <div className="flex items-center gap-10 text-left">
                        <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/20">
                            <Mountain className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-4xl font-black tracking-tighter uppercase italic leading-none text-current">Agios<span className="text-blue-600">.</span>OS</span>
                    </div>
                    <p className="text-xl opacity-30 leading-relaxed font-medium max-w-lg uppercase tracking-[0.2em] italic text-current text-left">
                        The definitive orchestration standard for high-velocity Silicon Cape financial lead systems. Decentralized. Autonomous. Hardened.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-32 text-left flex-1 text-current">
                    <div className="space-y-14 text-left">
                        <h4 className="text-[13px] font-black uppercase tracking-[0.6em] text-blue-600 text-left">System</h4>
                        <ul className="space-y-8 text-[12px] font-bold uppercase tracking-widest opacity-40 text-left">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Blueprint</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Nodes</a></li>
                        </ul>
                    </div>
                    <div className="space-y-14 text-left">
                        <h4 className="text-[13px] font-black uppercase tracking-[0.6em] text-blue-600 text-left">Legal</h4>
                        <ul className="space-y-8 text-[12px] font-bold uppercase tracking-widest opacity-40 text-left">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy</a></li>
                        </ul>
                    </div>
                    <div className="space-y-14 text-left">
                        <h4 className="text-[13px] font-black uppercase tracking-[0.6em] text-blue-600 text-left">HQ</h4>
                        <ul className="space-y-8 text-[12px] font-bold uppercase tracking-widest opacity-40 text-left">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Cape Town</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GMT+2</a></li>
                        </ul>
                    </div>
                    <div className="space-y-14 text-left">
                        <h4 className="text-[13px] font-black uppercase tracking-[0.6em] text-blue-600 text-left">Network</h4>
                        <div className="flex gap-10 pt-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-12 w-12 border-2 border-current opacity-10 rounded-sm flex items-center justify-center hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all cursor-pointer shadow-xl">
                                    <Fingerprint className="h-6 w-6" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="pt-24 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-20 opacity-20 text-[13px] font-black uppercase tracking-[1em] text-left leading-none text-current">
                <div className="flex items-center gap-32 text-left text-current leading-none">
                    <span>© 2025 AGIOS ORCHESTRATION INC.</span>
                    <span className="hidden md:block">Cape Town // South Africa</span>
                </div>
                <div className="flex gap-24 italic text-left text-current leading-none">
                    <span>Precision.</span>
                    <span>Power.</span>
                    <span>Absolute.</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}
