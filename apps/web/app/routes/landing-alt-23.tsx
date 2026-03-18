import { Link } from "react-router";
import { 
  ShieldCheck, 
  Sun,
  Moon,
  Mountain,
  Activity,
  ChevronRight,
  Fingerprint,
  TrendingUp,
  Zap,
  Lock,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt23() {
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
      theme === "dark" ? "bg-[#080808] text-slate-100" : "bg-[#fcfcfc] text-slate-900"
    )}>
      {/* Visual background layer: Atmospheric Depth */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-20%] left-[-10%] w-[100%] h-[100%] blur-[250px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-900/30" : "bg-blue-400/20"
        )} />
        <div className={cn(
            "absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"
        )} />
      </div>

      {/* Floating Modern Header */}
      <header className="fixed top-8 left-0 w-full z-50 px-10">
        <div className={cn(
            "container mx-auto h-16 rounded-full border backdrop-blur-2xl px-8 flex items-center justify-between transition-all duration-500",
            theme === "dark" ? "bg-black/40 border-white/10" : "bg-white/40 border-black/5"
        )}>
            <div className="flex items-center gap-4 group cursor-pointer">
                <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30 transform group-hover:rotate-12 transition-transform">
                    <Mountain className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-lg font-black tracking-tight leading-none uppercase italic">Agios<span className="text-blue-600">.</span>OS</span>
                    <span className="text-[7px] font-bold uppercase tracking-[0.5em] opacity-40 mt-1">Silicon Cape // South Africa</span>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.3em] opacity-50">
                <a href="#pipeline" className="hover:opacity-100 transition-opacity">Engine</a>
                <a href="#logic" className="hover:opacity-100 transition-opacity">Logic</a>
                <a href="#security" className="hover:opacity-100 transition-opacity">Security</a>
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
      </header>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center px-10 overflow-hidden text-center">
        <div className="container mx-auto relative z-10 flex flex-col items-center justify-center max-w-[1400px] h-full">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center w-full"
            >
                <Badge className={cn(
                    "mb-12 py-3 px-10 rounded-full font-black tracking-[0.5em] uppercase text-[10px] border-2 transition-colors shrink-0",
                    theme === "dark" ? "bg-blue-950/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
                )}>
                    The Standard for Fintech Lead Orchestration
                </Badge>
                
            <h1 className="text-6xl md:text-9xl lg:text-[11.5rem] font-black tracking-tighter mb-10 leading-[0.75] uppercase italic text-center shrink-0">
                <span className="block">Powering</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-800 inline-block not-italic pb-4 leading-tight">
                    Cape Growth.
                </span>
            </h1>

                <p className="text-xl md:text-2xl lg:text-3xl opacity-40 max-w-5xl mx-auto mb-20 font-light leading-relaxed tracking-tight shrink-0">
                    Agios AI provides the high-fidelity orchestration layer for South Africa's most aggressive lead generation engines. Built for R100M+ monthly pipelines.
                </p>
                
                <div className="flex flex-col md:flex-row items-center justify-center gap-16 w-full max-w-4xl shrink-0">
                    <Button size="lg" className="h-24 px-20 text-[14px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] flex-1 transform hover:scale-105 transition-all">
                        Initialize System
                    </Button>
                    <div className="flex items-center gap-10 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity shrink-0">
                        <div className="text-left space-y-1">
                            <div className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">System Access</div>
                            <span className="text-sm font-black uppercase tracking-[0.1em] italic">Technical Manual</span>
                        </div>
                        <div className="h-14 w-14 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-2xl">
                            <ChevronRight className="h-6 w-6 group-hover:text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>

        {/* Global Hub Status Line - Push to bottom corners to avoid overlap */}
        <div className="absolute bottom-8 left-0 w-full px-12 hidden lg:flex items-center justify-between opacity-20 text-[9px] font-black uppercase tracking-[0.5em] pointer-events-none">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]" />
                    <span>NODE_CPT_01 // READY</span>
                </div>
                <span>LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-8">
                <span>PIPELINE: R2.4B/MO</span>
                <span>POPIA: HARDENED</span>
            </div>
        </div>
      </section>



      {/* Grid: Rand-Denominated Scale */}
      <section id="pipeline" className={cn(
          "py-52 border-y transition-colors",
          theme === "dark" ? "border-white/5 bg-white/[0.01]" : "bg-slate-50 border-black/5"
      )}>
        <div className="container mx-auto px-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-32">
                {[
                    { label: "Market Value", value: "R12.8B", icon: <TrendingUp className="h-8 w-8 text-blue-500" /> },
                    { label: "Qualification Velocity", value: "85ms", icon: <Zap className="h-8 w-8 text-amber-500" /> },
                    { label: "Node Compliance", value: "100%", icon: <ShieldCheck className="h-8 w-8 text-emerald-500" /> },
                    { label: "Agent Population", value: "12.8M", icon: <Fingerprint className="h-8 w-8 text-blue-600" /> }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-10 text-left group">
                        <div className="opacity-60 transform group-hover:scale-110 transition-transform duration-500">{stat.icon}</div>
                        <div className="flex flex-col gap-4">
                            <span className="text-6xl md:text-7xl font-black tracking-tighter italic leading-none">{stat.value}</span>
                            <span className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40 mt-4 leading-none">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Feature Showcase: The Agent Network */}
      <section id="logic" className="py-52 relative px-10">
        <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-48">
                <div className="flex-1 space-y-16 text-left">
                    <div className="space-y-6">
                        <Badge className="bg-blue-600 text-white rounded-none px-6 py-1.5 font-black text-[11px] uppercase tracking-[0.4em]">Unit Logistics</Badge>
                        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none italic">
                            Elite Agent <br /> <span className="text-blue-600 not-italic">Distribution.</span>
                        </h2>
                    </div>
                    <p className="text-xl md:text-2xl opacity-50 font-light leading-relaxed max-w-2xl">
                        Agios AI deploys specialized autonomous units trained on high-fidelity financial data. We map the entire Silicon Cape economy in real-time.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
                        {[
                            { title: "Market Sourcing", desc: "Agents monitor intent signals across 50M+ South African data points." },
                            { title: "Neural Scoring", desc: "Proprietary credit readiness models built for localized regional profiles." },
                            { title: "Dynamic Routing", desc: "Distribution of qualified prospects to high-performance nodes." },
                            { title: "Hardened Security", desc: "Data masking and encryption exceeding regional bank grade." }
                        ].map((item, i) => (
                            <div key={i} className="space-y-4 group">
                                <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 italic group-hover:text-blue-500 transition-colors">0{i+1} // {item.title}</h3>
                                <p className="text-sm opacity-40 font-light leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="w-full lg:w-[45%]">
                    <div className={cn(
                        "aspect-[4/5] relative border-2 p-16 flex flex-col justify-between transition-all duration-1000",
                        theme === "dark" ? "border-white/10 bg-black shadow-[0_0_100px_rgba(37,99,235,0.1)]" : "border-black/5 bg-white shadow-3xl shadow-black/5"
                    )}>
                        <div className="flex items-center justify-between opacity-30 text-[10px] font-black uppercase tracking-[0.5em]">
                            <span>System_Interface_09</span>
                            <div className="flex gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-600 opacity-20" />
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center items-center relative">
                            <Activity className="h-24 w-24 text-blue-600 mb-10 animate-pulse" />
                            <div className="text-center space-y-4 relative z-10">
                                <div className="text-5xl font-black italic uppercase tracking-tighter">Synchronized</div>
                                <div className="h-1 w-32 bg-blue-600 mx-auto" />
                            </div>
                        </div>

                        <div className="border border-blue-600/20 p-8 flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase opacity-40 tracking-widest">Uptime</span>
                                <span className="text-2xl font-black italic">99.99%</span>
                            </div>
                            <div className="h-10 w-px bg-blue-600/20" />
                            <div className="flex flex-col gap-1 text-right">
                                <span className="text-[9px] font-black uppercase opacity-40 tracking-widest">Region</span>
                                <span className="text-2xl font-black italic text-blue-600 uppercase">CPT // HQ</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* POPIA Section: Regional Logic */}
      <section id="security" className={cn(
          "py-52 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01]" : "bg-slate-50"
      )}>
        <div className="container mx-auto px-10 max-w-6xl text-center space-y-20 text-left md:text-center">
            <div className="flex justify-center">
                <div className="h-32 w-32 border-2 border-blue-600 flex items-center justify-center rounded-sm rotate-45 transform hover:rotate-[225deg] transition-transform duration-1000">
                    <Lock className="h-12 w-12 text-blue-600 -rotate-45" />
                </div>
            </div>
            <div className="space-y-8">
                <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter italic leading-none">Hardened <br /> Regional Compliance.</h2>
                <p className="text-xl md:text-3xl opacity-50 font-light leading-relaxed max-w-5xl mx-auto">
                    POPIA is our foundation. Every lead orchestrated by Agios is processed within a secure, localized South African environment.
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-20 pt-10">
                {["POPIA Ready", "Bank Grade", "Localized Nodes", "Zero Trust"].map((tag, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                        <div className="h-2 w-2 rounded-full bg-blue-600 group-hover:scale-150 transition-transform" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] opacity-60 group-hover:opacity-100 transition-opacity">{tag}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Final Sequence CTA */}
      <section className="py-72 relative flex flex-col items-center justify-center text-center px-10 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 blur-[250px] opacity-30 pointer-events-none" />
        <div className="container mx-auto relative z-10">
            <h2 className="text-[12vw] md:text-[16rem] font-black tracking-tighter uppercase leading-[0.7] mb-24 italic text-current opacity-[0.03] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none select-none">
                AGIOS PRIME
            </h2>
            
            <h2 className="text-8xl md:text-[14rem] font-black tracking-tighter uppercase leading-[0.7] mb-20 italic relative z-10">
                Secure <br /> The Pulse.
            </h2>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-20">
                <Link to="/auth/sign-up" className="w-full sm:w-auto">
                    <Button size="lg" className="h-28 px-24 text-[14px] font-black uppercase tracking-[0.4em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] w-full transform hover:scale-105 transition-all">
                        Initialize Node
                    </Button>
                </Link>
                <div className="text-left group cursor-pointer flex flex-col gap-3 shrink-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Architectural Access</div>
                    <div className="flex items-center gap-6 text-blue-600 group-hover:text-blue-500 transition-colors">
                        <span className="text-3xl font-black uppercase tracking-tight italic leading-none">Speak with a <br /> Strategist</span>
                        <ArrowRight className="h-10 w-10 transform group-hover:translate-x-4 transition-transform duration-500" />
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
            <div className="flex flex-col lg:flex-row items-start justify-between gap-32 mb-32 text-left">
                <div className="space-y-12 text-left">
                    <div className="flex items-center gap-5">
                        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center">
                            <Mountain className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-3xl font-black tracking-tighter uppercase italic leading-none">Agios<span className="text-blue-600">.</span>OS</span>
                    </div>
                    <p className="text-sm opacity-30 leading-relaxed font-medium max-w-sm uppercase tracking-widest italic">
                        The definitive orchestration standard for high-velocity Silicon Cape financial systems. Decentralized. Autonomous. Hardened.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-24 text-left flex-1">
                    <div className="space-y-10 text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Engine</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Specs</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Nodes</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10 text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Legal</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10 text-left">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">HQ</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Cape Town</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GMT+2</a></li>
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
                <div className="flex items-center gap-16 text-left">
                    <span>© 2025 AGIOS ORCHESTRATION INC.</span>
                    <span className="hidden md:block">Silicon Cape HQ // South Africa</span>
                </div>
                <div className="flex gap-16 italic text-left">
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
