import { Link } from "react-router";
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Sun,
  Moon,
  Mountain,
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

export default function LandingAlt22() {
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
      theme === "dark" ? "bg-[#000000] text-slate-200" : "bg-[#ffffff] text-slate-900"
    )}>
      {/* Visual background layer: Deep Focal Blur */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-10%] right-[-10%] w-[100%] h-[100%] blur-[220px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-600/30" : "bg-blue-300/40"
        )} />
        <div className={cn(
          "absolute bottom-[-10%] left-[-10%] w-[80%] h-[80%] blur-[220px] rounded-full transition-all duration-1000 opacity-10",
          theme === "dark" ? "bg-indigo-600/20" : "bg-indigo-100/30"
        )} />
        {/* Subtle grid with larger cells */}
        <div className={cn(
            "absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:100px_100px]"
        )} />
      </div>

      {/* Modern High-End Navigation */}
      <nav className="fixed top-0 w-full z-50 px-10 h-32 flex items-center">
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-5 group cursor-pointer text-left">
                <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)] group-hover:scale-110 transition-transform">
                    <Mountain className="h-6 w-6 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black tracking-tight leading-none uppercase">Agios<span className="text-blue-600">.</span>OS</span>
                    <span className="text-[8px] font-bold uppercase tracking-[0.6em] opacity-40 mt-1">Silicon Cape // South Africa</span>
                </div>
            </div>

            <div className="hidden lg:flex items-center gap-16 text-[11px] font-black uppercase tracking-[0.4em] opacity-50">
                <a href="#pipeline" className="hover:text-blue-600 transition-colors">The Pipeline</a>
                <a href="#logic" className="hover:text-blue-600 transition-colors">Neural Logic</a>
                <a href="#compliance" className="hover:text-blue-600 transition-colors">Compliance</a>
            </div>

            <div className="flex items-center gap-8">
                <button onClick={toggleTheme} className="h-10 w-10 rounded-full border border-blue-600/20 flex items-center justify-center hover:bg-blue-600/5 transition-colors">
                    {theme === "dark" ? <Sun className="h-4 w-4 opacity-40" /> : <Moon className="h-4 w-4 opacity-40" />}
                </button>
                <Link to="/auth/sign-in" className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 hover:opacity-100">Login</Link>
                <Link to="/auth/sign-up">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-12 text-[11px] font-black uppercase tracking-[0.4em] h-14 shadow-2xl shadow-blue-600/20">
                        Deploy Initial Node
                    </Button>
                </Link>
            </div>
        </div>
      </nav>

      {/* Hero Section: Centered Editorial Style */}
      <section className="relative h-screen flex flex-col items-center justify-center px-10 overflow-hidden text-center">
        <div className="container mx-auto relative z-10 flex flex-col items-center justify-center h-full pt-20">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center max-w-[1500px]"
            >
                <Badge className={cn(
                    "mb-12 py-3 px-10 rounded-full font-black tracking-[0.5em] uppercase text-[10px] border-2 transition-colors shrink-0",
                    theme === "dark" ? "bg-blue-950/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
                )}>
                    Advanced Lead Orchestration // CPT // v4.1
                </Badge>
                
                <h1 className="text-6xl md:text-8xl lg:text-[12rem] font-black tracking-tighter mb-12 leading-[0.8] uppercase italic text-center shrink-0">
                    <span className="block">Orchestrate</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-800 inline-block not-italic pb-4 leading-tight">
                        The Cape.
                    </span>
                </h1>

                <p className="text-xl md:text-2xl opacity-40 max-w-5xl mx-auto mb-20 font-light leading-relaxed tracking-tight shrink-0">
                    Agios AI is the definitive orchestration layer for South Africa's most aggressive financial lead generation pipelines. Autonomous. Hardened. Absolute.
                </p>
                
                <div className="flex flex-col md:flex-row items-center justify-center gap-16 w-full max-w-3xl shrink-0">
                    <Button size="lg" className="h-24 px-20 text-[13px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] flex-1 transform hover:scale-105 transition-all">
                        Initialize Node
                    </Button>
                    <div className="flex items-center gap-10 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity shrink-0">
                        <div className="text-left space-y-1">
                            <div className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">System Access</div>
                            <span className="text-sm font-black uppercase tracking-[0.2em] italic">Technical Manual</span>
                        </div>
                        <div className="h-14 w-14 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-2xl">
                            <ChevronRight className="h-6 w-6 group-hover:text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>

        {/* Status Hub Bar - Fixed at bottom to avoid overlap */}
        <div className="absolute bottom-12 left-0 w-full px-16 hidden lg:flex items-center justify-between opacity-30 text-[10px] font-black uppercase tracking-[0.6em] pointer-events-none">
            <div className="flex items-center gap-12">
                <div className="flex items-center gap-4 text-left">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
                    <span>NODE_CPT_HQ // SYNCHRONIZED</span>
                </div>
                <div className="h-5 w-px bg-current/20" />
                <span>QUAL_LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-12 text-right">
                <span>PIPELINE_THROUGHPUT: R2.4B/MO</span>
                <div className="h-5 w-px bg-current/20" />
                <span>POPIA_HARDENED: YES</span>
            </div>
        </div>
      </section>


      {/* Grid: High Density Logic */}
      <section id="pipeline" className={cn(
          "py-52 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-100/50 border-black/5"
      )}>
        <div className="container mx-auto px-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-40">
                {[
                    { label: "Market Orchestrated", value: "R2.4B+", icon: <TrendingUp className="h-8 w-8 text-blue-500" /> },
                    { label: "Daily Qualified leads", value: "85k+", icon: <Zap className="h-8 w-8 text-amber-500" /> },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-8 w-8 text-emerald-500" /> },
                    { label: "Units Population", value: "12.8M", icon: <Fingerprint className="h-8 w-8 text-blue-600" /> }
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

      {/* Agents Section: Detailed & High-Trust */}
      <section id="logic" className="py-52 px-10 relative overflow-hidden text-left">
        <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-48">
                <div className="flex-1 space-y-20">
                    <div className="space-y-10">
                        <Badge className="bg-blue-600 text-white rounded-none px-8 py-2.5 font-black text-[11px] uppercase tracking-[0.6em]">Engine Logic</Badge>
                        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none italic">
                            Elite Agent <br /> <span className="text-blue-600 not-italic">Distribution.</span>
                        </h2>
                        <p className="text-xl md:text-3xl opacity-50 font-light leading-relaxed max-w-3xl tracking-tight">
                            Deploy specialized autonomous units trained on localized financial data. From prospecting to qualification, we map the entire Silicon Cape economy in real-time.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                        {[
                            { title: "Market Sourcing", desc: "Autonomous agents monitor intent signals across 50M+ regional data points." },
                            { title: "Neural Scoring", desc: "Proprietary credit readiness models built for localized regional financial profiles." },
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
                        "aspect-square relative border-2 p-16 flex flex-col justify-between transition-all duration-1000 overflow-hidden",
                        theme === "dark" ? "border-white/10 bg-black shadow-[0_0_150px_rgba(37,99,235,0.1)]" : "border-black/5 bg-slate-50 shadow-3xl shadow-black/5"
                    )}>
                        <div className="flex items-center justify-between opacity-30 text-[11px] font-black uppercase tracking-[0.6em]">
                            <span>Unit_Alpha_09</span>
                            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center items-center relative">
                            <Network className="h-32 w-32 text-blue-600 mb-12 animate-pulse opacity-60" />
                            <div className="text-center space-y-6">
                                <div className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter leading-none text-current opacity-20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none select-none">
                                    AGIOS PRIME
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
                                <span className="text-3xl font-black italic leading-none uppercase">CPT // HQ</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Compliance Block */}
      <section id="compliance" className={cn(
          "py-52 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01]" : "bg-slate-50"
      )}>
        <div className="container mx-auto px-10 max-w-[1400px] text-center space-y-32">
            <div className="flex justify-center">
                <div className="h-32 w-32 border-2 border-blue-600 flex items-center justify-center rounded-sm rotate-45 transform hover:rotate-[225deg] transition-all duration-1000 cursor-pointer group">
                    <Lock className="h-14 w-14 text-blue-600 -rotate-45 group-hover:scale-110 transition-transform" />
                </div>
            </div>
            <div className="space-y-12">
                <h2 className="text-7xl md:text-[10rem] font-black uppercase tracking-tighter italic leading-[0.8]">Hardened <br /> Regional Compliance.</h2>
                <p className="text-2xl md:text-4xl opacity-50 font-light leading-relaxed max-w-6xl mx-auto tracking-tight">
                    POPIA isn't an afterthought. Every lead orchestrated by Agios is processed within a secure, localized South African data environment, meeting the highest standards of financial security.
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-32 pt-10 opacity-60">
                {["POPIA Verified", "Bank Grade", "Localized Nodes", "Zero Trust"].map((tag, i) => (
                    <div key={i} className="flex items-center gap-6 group">
                        <div className="h-3 w-3 rounded-full bg-blue-600 group-hover:scale-150 transition-transform" />
                        <span className="text-[16px] font-black uppercase tracking-[0.6em]">{tag}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Final Call: The Initialization */}
      <section className="py-80 relative flex flex-col items-center justify-center text-center px-10 overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 blur-[250px] opacity-40 pointer-events-none" />
        <div className="container mx-auto relative z-10 flex flex-col items-center">
            <h2 className="text-8xl md:text-[16rem] lg:text-[20rem] font-black tracking-tighter uppercase leading-[0.7] mb-24 italic relative z-10">
                Secure <br /> The Pulse.
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
                        <span className="text-3xl font-black uppercase tracking-tight italic leading-none">Speak with a <br /> Strategist</span>
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
                        The definitive orchestration standard for South African fintech. Decentralized. Autonomous. Hardened.
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
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GDPR</a></li>
                        </ul>
                    </div>
                    <div className="space-y-12">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-600">HQ</h4>
                        <ul className="space-y-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Silicon Cape</a></li>
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
