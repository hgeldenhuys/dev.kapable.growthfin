import { Link } from "react-router";
import { 
  Sun,
  Moon,
  Mountain,
  Activity,
  ChevronRight,
  TrendingUp,
  Zap,
  ArrowRight,
  Fingerprint,
  ShieldCheck,
  Globe
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt56() {
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
      {/* Visual Background: Absolute Premium */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-20%] left-[-5%] w-[100%] h-[100%] blur-[250px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-600/30" : "bg-blue-400/40"
        )} />
        <div className={cn(
            "absolute inset-0 opacity-[0.02] dark:opacity-[0.04] pointer-events-none bg-[radial-gradient(circle_at_center,currentColor_1px,transparent_1px)] bg-[size:64px_64px]"
        )} />
      </div>

      {/* Editorial Navigation */}
      <nav className={cn(
        "fixed top-0 w-full z-50 transition-all duration-500 border-b",
        theme === "dark" ? "border-white/5 bg-black/40 backdrop-blur-xl" : "border-black/5 bg-white/70 backdrop-blur-xl shadow-sm"
      )}>
        <div className="container mx-auto px-12 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6 group cursor-pointer text-left">
            <div className="h-11 w-11 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30 transform group-hover:scale-105 transition-transform duration-500">
              <Mountain className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter leading-none uppercase italic">Agios<span className="text-blue-600">.</span>OS</span>
              <span className="text-[7px] font-bold uppercase tracking-[0.6em] opacity-40 mt-1 leading-none">Silicon Cape HQ</span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-16 text-[10px] font-black uppercase tracking-[0.4em] opacity-50">
            <a href="#pipeline" className="hover:text-blue-600 transition-colors">Performance</a>
            <a href="#logic" className="hover:text-blue-600 transition-colors">Orchestration</a>
            <a href="#compliance" className="hover:text-blue-600 transition-colors">Compliance</a>
          </div>

          <div className="flex items-center gap-8">
            <button onClick={toggleTheme} className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-blue-600/10 transition-colors border border-current/10">
              {theme === "dark" ? <Sun className="h-4 w-4 opacity-40" /> : <Moon className="h-4 w-4 opacity-40" />}
            </button>
            <div className="h-6 w-px bg-current/10 mx-2" />
            <Link to="/auth/sign-in" className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 hover:opacity-100 transition-opacity">Login</Link>
            <Link to="/auth/sign-up">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-12 text-[10px] font-black uppercase tracking-[0.4em] h-12 shadow-2xl shadow-blue-600/20">
                Deploy Unit
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section: Absolute Centering & Editorial Space */}
      <section className="relative h-screen flex flex-col items-center justify-center px-12 overflow-hidden text-center shrink-0">
        <div className="container mx-auto relative z-10 flex flex-col items-center justify-center h-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center max-w-7xl -mt-16"
          >
            <Badge className={cn(
              "mb-16 py-3 px-10 rounded-full font-black tracking-[0.5em] uppercase text-[10px] border-2 transition-colors shrink-0 leading-none",
              theme === "dark" ? "bg-blue-950/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600 shadow-sm"
            )}>
              Advanced Lead Orchestration // v4.6.0 // Silicon Cape
            </Badge>
            
            <h1 className="text-6xl md:text-8xl lg:text-[11rem] xl:text-[14rem] font-black tracking-tighter mb-10 leading-[0.75] uppercase italic shrink-0 text-center">
              <span className="block text-current opacity-90">Powering</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-700 inline-block not-italic pb-6 leading-none">
                Cape Growth.
              </span>
            </h1>

            <p className="text-xl md:text-2xl lg:text-3xl opacity-40 max-w-5xl mx-auto mb-20 font-light leading-relaxed tracking-tight shrink-0 text-center">
              Agios AI is the absolute standard for South Africa's highest-velocity financial lead generation pipelines. Autonomous, hardened, and localized.
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full max-w-4xl shrink-0">
              <Button size="lg" className="h-24 px-20 text-[14px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.6)] flex-1 transform hover:scale-105 transition-all">
                Initialize System
              </Button>
              <div className="text-left group cursor-pointer flex items-center gap-10 opacity-60 hover:opacity-100 transition-opacity shrink-0">
                <div className="flex flex-col gap-1 text-left leading-none">
                    <div className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40 leading-none">System access</div>
                    <span className="text-2xl font-black uppercase tracking-tight italic text-current leading-none">Technical Manual</span>
                </div>
                <div className="h-14 w-14 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-2xl">
                  <ChevronRight className="h-6 w-6 group-hover:text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Global Hub Status - Absolute Bottom with controlled opacity */}
        <div className={cn(
            "absolute bottom-10 left-0 w-full px-16 hidden lg:flex items-center justify-between font-black uppercase tracking-[0.6em] pointer-events-none transition-colors",
            theme === "dark" ? "opacity-20 text-white" : "opacity-40 text-slate-900"
        )}>
            <div className="flex items-center gap-12 text-left text-[11px] leading-none">
                <div className="flex items-center gap-4 leading-none text-left">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
                    <span>NODE_CPT_PRIMARY // ACTIVE</span>
                </div>
                <div className="h-6 w-px bg-current/20 hidden md:block" />
                <span>LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-12 text-right text-[11px] leading-none">
                <span>THROUGHPUT: R3.4B / MO</span>
                <div className="h-6 w-px bg-current/20 hidden md:block" />
                <span>POPIA_HARDENING: ENABLED</span>
            </div>
        </div>
      </section>

      {/* Grid: High Fidelity Metrics - Resolved Cramped Layout with Max Width and Padding */}
      <section id="pipeline" className={cn(
          "py-80 border-y transition-colors shrink-0 relative z-10",
          theme === "dark" ? "bg-[#020617] border-white/5 shadow-[inset_0_0_150px_rgba(0,0,0,0.6)]" : "bg-white border-slate-200 shadow-inner"
      )}>
        <div className="container mx-auto px-20 max-w-[1700px]">
            <div className="text-left mb-56 space-y-8 pl-4">
                <Badge className="bg-blue-600 text-white rounded-none px-8 py-3 font-black text-[13px] uppercase tracking-[0.8em]">Network Output</Badge>
                <h2 className="text-7xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8] text-current">The Pipeline <br /> <span className="text-blue-600 not-italic">Engine.</span></h2>
                <p className="text-2xl md:text-4xl opacity-40 font-light max-w-3xl leading-relaxed tracking-tight text-left">High-fidelity lead qualification at absolute scale. Built for the high-velocity fintech economy.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-40 lg:gap-52 text-left pl-4">
                {[
                    { label: "Market Orchestrated", value: "R3.4B+", icon: <TrendingUp className="h-10 w-10 text-blue-600" />, desc: "Total monthly pipeline volume processed across the cluster node network." },
                    { label: "Daily leads qualified", value: "125k+", icon: <Zap className="h-10 w-10 text-amber-500" />, desc: "Autonomous qualified leads distributed to closing nodes every 24h." },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-10 w-10 text-emerald-500" />, desc: "Regulatory hardened architecture score for South African fintech." },
                    { label: "Active Agent population", value: "12.8M", icon: <Fingerprint className="h-10 w-10 text-blue-400" />, desc: "Total autonomous units synchronized across regional HQ clusters." }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-12 text-left group">
                        <div className="flex flex-col gap-10">
                            <div className="h-20 w-20 border border-current/10 flex items-center justify-center rounded-sm opacity-60 transform group-hover:rotate-12 transition-all duration-700 bg-current/[0.02]">
                                {stat.icon}
                            </div>
                            <div className="space-y-6 text-left">
                                <span className="text-7xl md:text-8xl lg:text-[8.5rem] font-black tracking-tighter italic leading-none transition-colors group-hover:text-blue-600">{stat.value}</span>
                                <div className="space-y-4 pt-10 border-t border-current/10 max-w-xs text-left">
                                    <span className="text-[14px] font-black uppercase tracking-[0.6em] opacity-40 leading-none block text-left">{stat.label}</span>
                                    <p className="text-base opacity-30 font-medium leading-relaxed text-left">{stat.desc}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Logic showcase */}
      <section id="logic" className="py-72 px-12 relative overflow-hidden text-left shrink-0">
        <div className="container mx-auto max-w-[1500px]">
            <div className="flex flex-col lg:flex-row items-center gap-64 text-left">
                <div className="flex-1 space-y-32 text-left">
                    <div className="space-y-12 text-left">
                        <Badge className="bg-blue-600 text-white rounded-none px-8 py-2.5 font-black text-[12px] uppercase tracking-[0.6em]">Agent Logistics</Badge>
                        <h2 className="text-7xl md:text-9xl lg:text-[11rem] font-black uppercase tracking-tighter leading-none italic text-current text-left">
                            Elite Node <br /> <span className="text-blue-600 not-italic">Distribution.</span>
                        </h2>
                        <p className="text-2xl md:text-3xl opacity-50 font-light leading-relaxed max-w-4xl tracking-tight text-left">
                            Deploy specialized autonomous units trained on localized South African financial data. We map the digital landscape with surgical precision.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-24 text-left">
                        {[
                            { title: "Market Sourcing", desc: "Autonomous agents scan market signals across 50M+ South African data points.", icon: <Globe className="h-10 w-10" /> },
                            { title: "Neural Scoring", desc: "Proprietary qualification models built on localized financial readiness and FSR scoring.", icon: <Fingerprint className="h-10 w-10" /> },
                        ].map((item, i) => (
                            <div key={i} className="space-y-10 group text-left">
                                <div className="text-blue-600 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 shadow-2xl bg-current/[0.02] h-16 w-16 flex items-center justify-center">{item.icon}</div>
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-black uppercase tracking-widest text-blue-600 flex items-center gap-6 italic group-hover:text-blue-500 transition-colors leading-none text-left">
                                        <span className="h-px w-16 bg-blue-600/30 group-hover:w-24 transition-all" /> 
                                        {item.title}
                                    </h3>
                                    <p className="text-lg opacity-40 font-light leading-relaxed text-left max-w-md">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full lg:w-[45%] relative shrink-0">
                    <div className={cn(
                        "aspect-square relative border-2 p-16 flex flex-col justify-between transition-all duration-1000 overflow-hidden shadow-2xl",
                        theme === "dark" ? "border-white/10 bg-black shadow-[0_0_150px_rgba(37,99,235,0.1)]" : "border-black/5 bg-white shadow-3xl shadow-black/5"
                    )}>
                        <div className="flex items-center justify-between opacity-30 text-[10px] font-black uppercase tracking-[0.6em]">
                            <span>Engine_Module_09</span>
                            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center items-center">
                            <Activity className="h-24 w-24 text-blue-600 mb-12 animate-pulse opacity-60" />
                            <div className="text-center space-y-6 relative">
                                <div className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter leading-none text-current opacity-10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none select-none">
                                    AGIOS OS
                                </div>
                                <div className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter leading-none relative z-10">Synchronized</div>
                                <div className="h-1 w-40 bg-blue-600 mx-auto relative z-10" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-current/10 pt-10">
                            <div className="flex flex-col gap-2 text-left">
                                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none">Uptime</span>
                                <span className="text-3xl font-black italic leading-none">99.99%</span>
                            </div>
                            <div className="flex flex-col gap-2 text-right">
                                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none text-blue-600">Region</span>
                                <span className="text-3xl font-black italic leading-none uppercase text-current">CPT</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Compliance Block */}
      <section id="compliance" className={cn(
          "py-72 border-y transition-colors shrink-0 relative z-10",
          theme === "dark" ? "bg-white/[0.01]" : "bg-[#fcfcfc] shadow-inner"
      )}>
        <div className="container mx-auto px-16 max-w-[1400px] text-center space-y-32">
            <div className="flex justify-center">
                <div className="h-48 w-48 border-2 border-blue-600 flex items-center justify-center rounded-full transform hover:scale-110 transition-all duration-1000 cursor-pointer group shadow-2xl bg-current/[0.02]">
                    <ShieldCheck className="h-20 w-20 text-blue-600 group-hover:scale-110 transition-transform" />
                </div>
            </div>
            <div className="space-y-12 text-left md:text-center">
                <h2 className="text-7xl md:text-[10rem] font-black uppercase tracking-tighter italic leading-[0.8] text-center text-current">Hardened <br /> Regional Compliance.</h2>
                <p className="text-2xl md:text-4xl opacity-50 font-light leading-relaxed max-w-6xl mx-auto tracking-tight text-center text-current leading-relaxed">
                    POPIA is our baseline. Every lead orchestrated by Agios is processed within a secure, localized South African data environment.
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-32 pt-10 opacity-60">
                {["POPIA Verified", "Bank Grade", "Localized Nodes", "Zero Trust"].map((tag, i) => (
                    <div key={i} className="flex items-center gap-6 group text-current">
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
        theme === "dark" ? "bg-[#000000] border-white/5" : "bg-white border-black/10 shadow-2xl"
      )}>
        <div className="container mx-auto px-20">
            {/* CTA Final */}
            <div className="py-80 text-center relative mb-48 flex flex-col items-center">
                <div className="absolute inset-0 bg-blue-600/5 blur-[200px] opacity-30 pointer-events-none" />
                <h2 className="text-8xl md:text-[16rem] lg:text-[22rem] font-black tracking-tighter uppercase leading-[0.7] mb-24 italic relative z-10 text-center text-current">
                    Secure <br /> The Flow.
                </h2>
                <div className="flex flex-col md:flex-row items-center justify-center gap-20 relative z-10 mx-auto w-full max-w-5xl">
                    <Link to="/auth/sign-up" className="w-full sm:w-auto flex-1">
                        <Button size="lg" className="h-32 px-24 text-[18px] font-black uppercase tracking-[0.6em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_60px_150px_rgba(37,99,235,0.7)] w-full transform hover:scale-105 transition-all">
                            Initialize Node
                        </Button>
                    </Link>
                    <div className="text-left group cursor-pointer flex flex-col gap-3 shrink-0 text-current">
                        <div className="text-[12px] font-black uppercase tracking-[0.4em] opacity-40 leading-none">System Integration</div>
                        <div className="flex items-center gap-10 text-blue-600 group-hover:text-blue-500 transition-colors text-left leading-none text-left">
                            <span className="text-3xl font-black uppercase tracking-tight italic leading-none">Speak with a <br /> Strategist</span>
                            <ArrowRight className="h-10 w-10 transform group-hover:translate-x-6 transition-transform duration-500" />
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
                    <p className="text-xl opacity-30 leading-relaxed font-medium max-w-md uppercase tracking-[0.2em] italic text-current text-left">
                        The definitive orchestration standard for high-velocity Silicon Cape financial lead generation systems.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-32 text-left flex-1 text-current">
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600 text-left">System</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40 text-left">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Blueprint</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Nodes</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600 text-left">Legal</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40 text-left">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600 text-left">HQ</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40 text-left">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Cape Town</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GMT+2</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12 text-left">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600 text-left">Network</h4>
                        <div className="flex gap-8 pt-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-11 w-11 border-2 border-current opacity-10 rounded-sm flex items-center justify-center hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all cursor-pointer shadow-xl">
                                    <Fingerprint className="h-5 w-5" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="pt-20 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-16 opacity-20 text-[12px] font-black uppercase tracking-[0.8em] text-left leading-none text-current">
                <div className="flex items-center gap-24 text-left text-current">
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
