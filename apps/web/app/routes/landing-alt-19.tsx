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
import { useState, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt19() {
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
      "min-h-screen transition-colors duration-1000 font-sans selection:bg-blue-600/30 overflow-x-hidden",
      theme === "dark" ? "bg-[#000000] text-slate-100" : "bg-[#fcfcfc] text-slate-900"
    )}>
      {/* Cinematic Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className={cn(
          "absolute -top-[20%] -left-[10%] w-[80%] h-[80%] blur-[200px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-900/40" : "bg-blue-200/50"
        )} />
        <div className={cn(
          "absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] blur-[200px] rounded-full transition-all duration-1000 opacity-10",
          theme === "dark" ? "bg-indigo-900/30" : "bg-indigo-100/50"
        )} />
        {/* Topographical Trace Overlay */}
        <div className={cn(
            "absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none",
            "bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:80px_80px]"
        )} />
      </div>

      {/* Industrial Precision Header */}
      <header className="fixed top-0 w-full z-50 px-10 h-28 flex items-center">
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-5 group cursor-pointer">
                <div className="h-14 w-14 bg-blue-600 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)] group-hover:rotate-12 transition-transform duration-500">
                    <Mountain className="h-7 w-7 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-3xl font-black tracking-tighter leading-none uppercase italic">Agios<span className="text-blue-600">.</span></span>
                    <span className="text-[9px] font-black uppercase tracking-[0.5em] opacity-40">Silicon Cape HQ // GMT+2</span>
                </div>
            </div>

            <div className="hidden lg:flex items-center gap-16 text-[11px] font-black uppercase tracking-[0.3em] opacity-50">
                <a href="#engine" className="hover:opacity-100 transition-opacity relative group">
                    The Engine
                    <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300" />
                </a>
                <a href="#logic" className="hover:opacity-100 transition-opacity relative group">
                    Orchestration
                    <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300" />
                </a>
                <a href="#POPIA" className="hover:opacity-100 transition-opacity relative group">
                    Compliance
                    <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300" />
                </a>
            </div>

            <div className="flex items-center gap-8">
                <button onClick={toggleTheme} className="h-12 w-12 rounded-full border border-blue-600/10 flex items-center justify-center hover:bg-blue-600/5 transition-colors">
                    {theme === "dark" ? <Sun className="h-5 w-5 opacity-60" /> : <Moon className="h-5 w-5 opacity-60" />}
                </button>
                <Link to="/auth/sign-in" className="text-[11px] font-black uppercase tracking-[0.3em] opacity-50 hover:opacity-100 transition-opacity">Login</Link>
                <Link to="/auth/sign-up">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-12 text-[11px] font-black uppercase tracking-[0.3em] h-14 shadow-2xl shadow-blue-600/20">
                        Initialize Node
                    </Button>
                </Link>
            </div>
        </div>
      </header>

      {/* Hero: The Absolute Pulse */}
      <section className="relative h-screen flex flex-col items-center justify-center px-10 overflow-hidden">
        <div className="container mx-auto relative z-10 text-center flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center max-w-[1400px] -mt-12"
          >
            <Badge className={cn(
                "mb-12 py-3 px-10 rounded-full font-black tracking-[0.4em] uppercase text-[10px] border-2 transition-colors",
                theme === "dark" ? "bg-blue-950/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600"
            )}>
                Autonomous Lead Orchestration // v4.0.1
            </Badge>
            
            <h1 className="text-6xl md:text-8xl lg:text-[10rem] xl:text-[12rem] font-black tracking-tighter mb-10 leading-[0.8] uppercase italic text-center">
                <span className="block">Orchestrate</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-700 inline-block not-italic pb-4 leading-tight">
                    The Infinite.
                </span>
            </h1>

            <p className="text-lg md:text-2xl opacity-40 max-w-4xl mx-auto mb-20 font-light leading-relaxed tracking-tight">
                Agios AI powers the highest-velocity financial lead pipelines in the Silicon Cape. 
                Built for the R1B+ environment. Fully POPIA hardened.
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full max-w-3xl">
                <Button size="lg" className="h-24 px-16 text-[12px] font-black uppercase tracking-[0.4em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_30px_90px_rgba(37,99,235,0.5)] flex-1 transform hover:scale-105 transition-all">
                    Establish Connection
                </Button>
                <div className="flex items-center gap-6 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity shrink-0">
                    <div className="text-left space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">System Overview</div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] italic">Technical Manual</span>
                    </div>
                    <div className="h-12 w-12 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-2xl">
                        <ChevronRight className="h-5 w-5 group-hover:text-white" />
                    </div>
                </div>
            </div>
          </motion.div>
        </div>

        {/* Global Hub Status Line */}
        <div className="absolute bottom-16 left-0 w-full px-16 hidden lg:flex items-center justify-between opacity-30 text-[10px] font-black uppercase tracking-[0.5em]">
            <div className="flex items-center gap-10">
                <div className="flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
                    <span>NODE_CAPE_TOWN_HQ // SYNCHRONIZED</span>
                </div>
                <div className="h-5 w-px bg-slate-500/50" />
                <span>LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-10">
                <span>THROUGHPUT: R3.4B / MO</span>
                <div className="h-5 w-px bg-slate-500/50" />
                <span>POPIA_HARDENED: ACTIVE</span>
            </div>
        </div>
      </section>

      {/* Pipeline Grid: Rand-Denominated Scale */}
      <section id="engine" className={cn(
          "py-48 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-black/5"
      )}>
        <div className="container mx-auto px-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-32">
                {[
                    { label: "Pipeline Value", value: "R2.4B+", icon: <TrendingUp className="h-8 w-8 text-blue-500" /> },
                    { label: "Qualification Speed", value: "85ms", icon: <Zap className="h-8 w-8 text-amber-500" /> },
                    { label: "Node Compliance", value: "100%", icon: <ShieldCheck className="h-8 w-8 text-emerald-500" /> },
                    { label: "Agent Population", value: "12.8M", icon: <Fingerprint className="h-8 w-8 text-blue-600" /> }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-10 text-left">
                        <div className="opacity-60">{stat.icon}</div>
                        <div className="flex flex-col">
                            <span className="text-6xl md:text-7xl font-black tracking-tighter italic leading-none">{stat.value}</span>
                            <span className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40 mt-6">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Feature Showcase: The Agent Network */}
      <section id="logic" className="py-48 relative px-10">
        <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-40">
                <div className="flex-1 space-y-16 text-left">
                    <div className="space-y-6">
                        <Badge className="bg-blue-600 text-white rounded-none px-6 py-1.5 font-black text-[11px] uppercase tracking-[0.4em]">Unit Logistics</Badge>
                        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none italic">
                            Elite Agent <br /> <span className="text-blue-600 not-italic">Distribution.</span>
                        </h2>
                    </div>
                    <p className="text-xl md:text-2xl opacity-50 font-light leading-relaxed max-w-2xl">
                        Agios AI deploys specialized autonomous units trained on high-fidelity financial data. From cold-prospecting to deep-chain credit qualification, we map the entire Silicon Cape economy in real-time.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
                        {[
                            { title: "Autonomous Sourcing", desc: "Agents monitor market signals across 50M+ South African data points." },
                            { title: "Localized FSR Scoring", desc: "Proprietary credit readiness models built for regional financial profiles." },
                            { title: "Dynamic Logic Chains", desc: "Self-optimizing decision trees that learn from every conversion outcome." },
                            { title: "Compliance Safeguard", desc: "Automated data masking and consent verification native to the OS." }
                        ].map((item, i) => (
                            <div key={i} className="space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 italic">0{i+1} // {item.title}</h3>
                                <p className="text-sm opacity-40 font-light leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="w-full lg:w-[45%]">
                    <div className={cn(
                        "aspect-[4/5] relative border p-12 flex flex-col justify-between transition-all duration-1000",
                        theme === "dark" ? "border-white/10 bg-black shadow-[0_0_100px_rgba(37,99,235,0.1)]" : "border-black/5 bg-white shadow-3xl"
                    )}>
                        <div className="flex items-center justify-between opacity-30 text-[10px] font-black uppercase tracking-[0.5em]">
                            <span>System_Interface_09</span>
                            <div className="flex gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-600 opacity-20" />
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center items-center relative">
                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                <Network className="h-[400px] w-[400px] text-blue-600" />
                            </div>
                            <Activity className="h-24 w-24 text-blue-600 mb-10 animate-pulse" />
                            <div className="text-center space-y-4 relative z-10">
                                <div className="text-5xl font-black italic uppercase tracking-tighter">Synchronized</div>
                                <div className="h-1 w-32 bg-blue-600 mx-auto" />
                            </div>
                        </div>

                        <div className="border border-blue-600/20 p-8 flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase opacity-40 tracking-widest">Node Uptime</span>
                                <span className="text-2xl font-black italic">99.99%</span>
                            </div>
                            <div className="h-10 w-1 bg-blue-600/20" />
                            <div className="flex flex-col gap-1 text-right">
                                <span className="text-[9px] font-black uppercase opacity-40 tracking-widest">Latency</span>
                                <span className="text-2xl font-black italic text-blue-600">12ms</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* POPIA: The Hardened Core */}
      <section id="POPIA" className={cn(
          "py-48 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01]" : "bg-slate-50"
      )}>
        <div className="container mx-auto px-10 max-w-6xl text-center space-y-20">
            <div className="flex justify-center">
                <div className="h-32 w-32 border-2 border-blue-600 flex items-center justify-center rounded-sm rotate-45 transform hover:rotate-[225deg] transition-transform duration-1000">
                    <Lock className="h-12 w-12 text-blue-600 -rotate-45" />
                </div>
            </div>
            <div className="space-y-8">
                <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter italic leading-none">Hardened <br /> Regional Logic.</h2>
                <p className="text-xl md:text-3xl opacity-50 font-light leading-relaxed max-w-5xl mx-auto">
                    POPIA is our foundation. Every lead orchestrated by Agios is processed within a secure, localized South African data environment, meeting the highest standards of financial security.
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-20 pt-10">
                {["POPIA Ready", "GDPR Native", "FSR Scored", "Bank Grade Encryption"].map((tag, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                        <div className="h-2 w-2 rounded-full bg-blue-600 group-hover:scale-150 transition-transform" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] opacity-60">{tag}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Final Initialization CTA */}
      <section className="py-72 relative flex flex-col items-center justify-center text-center px-10 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 blur-[250px] opacity-30 pointer-events-none" />
        <div className="container mx-auto relative z-10">
            <h2 className="text-[12vw] md:text-[16rem] font-black tracking-tighter uppercase leading-[0.7] mb-24 italic">
                Secure <br /> The Pulse.
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-20">
                <Link to="/auth/sign-up" className="w-full sm:w-auto">
                    <Button size="lg" className="h-28 px-24 text-[14px] font-black uppercase tracking-[0.4em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] w-full">
                        Initialize Node
                    </Button>
                </Link>
                <div className="text-left group cursor-pointer flex flex-col gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Architectural Access</div>
                    <div className="flex items-center gap-6 text-blue-600 group-hover:text-blue-500 transition-colors">
                        <span className="text-3xl font-black uppercase tracking-tight italic leading-none">Speak with a <br /> Strategist</span>
                        <ArrowRight className="h-10 w-10 transform group-hover:translate-x-4 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Industrial Footer */}
      <footer className={cn(
        "py-24 border-t transition-colors duration-1000",
        theme === "dark" ? "bg-[#000000] border-white/5" : "bg-white border-black/5"
      )}>
        <div className="container mx-auto px-10">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-32 mb-32">
                <div className="space-y-12">
                    <div className="flex items-center gap-5">
                        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center">
                            <Mountain className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-3xl font-black tracking-tighter uppercase italic leading-none">Agios<span className="text-blue-600">.</span>Prime</span>
                    </div>
                    <p className="text-sm opacity-30 leading-relaxed font-medium max-w-sm uppercase tracking-widest">
                        Orchestrating high-velocity financial pipelines for the Silicon Cape economy. Decentralized. Autonomous. Secured.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-24">
                    <div className="space-y-10 text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Orchestration</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Node Specs</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Unit Logic</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Network Status</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10 text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Compliance</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA Guide</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GDPR Mapping</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">FSR Scoring</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10 text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Regional</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Silicon Cape</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">CPT Hub</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GMT+2 Status</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10 text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Identity</h4>
                        <div className="flex gap-6 pt-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-10 w-10 border border-white/10 rounded-sm flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all cursor-pointer">
                                    <Fingerprint className="h-4 w-4" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="pt-16 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-10 opacity-20 text-[10px] font-black uppercase tracking-[0.5em]">
                <div className="flex items-center gap-16">
                    <span>© 2025 AGIOS PRIME ORCHESTRATION INC.</span>
                    <span className="hidden md:block">Cape Town HQ // South Africa</span>
                </div>
                <div className="flex gap-16 italic">
                    <span>Precision.</span>
                    <span>Power.</span>
                    <span>Scale.</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}
