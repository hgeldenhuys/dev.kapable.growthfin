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
  BarChart3
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt21() {
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
      {/* Visual Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-20%] left-[-10%] w-[100%] h-[100%] blur-[200px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-600/40" : "bg-blue-200/60"
        )} />
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 px-10 h-32 flex items-center">
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6 group cursor-pointer text-left">
                <div className="h-12 w-12 bg-blue-600 rounded-[1.2rem] flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.5)]">
                    <Mountain className="h-6 w-6 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black tracking-tighter leading-none uppercase">Agios<span className="text-blue-600">.</span>OS</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40">Silicon Cape HQ</span>
                </div>
            </div>

            <div className="hidden lg:flex items-center gap-16 text-[11px] font-black uppercase tracking-[0.4em] opacity-50">
                <a href="#scale" className="hover:opacity-100 transition-opacity">The Scale</a>
                <a href="#logic" className="hover:opacity-100 transition-opacity">The Logic</a>
                <a href="#compliance" className="hover:opacity-100 transition-opacity">POPIA</a>
            </div>

            <div className="flex items-center gap-10">
                <button onClick={toggleTheme} className="opacity-40 hover:opacity-100 transition-opacity">
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <div className="h-8 w-px bg-slate-500/20" />
                <Link to="/auth/sign-in" className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 hover:opacity-100 transition-opacity">Login</Link>
                <Link to="/auth/sign-up">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-12 text-[11px] font-black uppercase tracking-[0.4em] h-14 shadow-2xl shadow-blue-600/20">
                        Deploy Unit
                    </Button>
                </Link>
            </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 px-10 overflow-hidden text-center">
        <div className="container mx-auto relative z-10 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center max-w-[1600px]"
          >
            <Badge className={cn(
                "mb-12 py-3 px-10 rounded-full font-black tracking-[0.5em] uppercase text-[10px] border-2 transition-colors",
                theme === "dark" ? "bg-blue-950/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
            )}>
                Lead Orchestration // Silicon Cape // v4.0
            </Badge>
            
            <h1 className="text-6xl md:text-9xl lg:text-[11.5rem] font-black tracking-tighter mb-10 leading-[0.75] uppercase italic text-center">
                <span className="block">Orchestrate</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-800 inline-block not-italic pb-4 leading-tight">
                    The Cape.
                </span>
            </h1>

            <p className="text-xl md:text-3xl lg:text-4xl opacity-40 max-w-5xl mx-auto mb-20 font-light leading-relaxed tracking-tight">
                Agios AI is the high-fidelity orchestration layer for South Africa's highest-velocity lead generation pipelines. Autonomous. Hardened. Infinitely Scalable.
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full max-w-4xl">
                <Button size="lg" className="h-24 px-20 text-[14px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] flex-1 transform hover:scale-105 transition-all">
                    Initialize Node
                </Button>
                <div className="text-left group cursor-pointer flex items-center gap-6 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex flex-col gap-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">System Access</div>
                        <span className="text-xl font-black uppercase tracking-tight italic">Technical Manual</span>
                    </div>
                    <div className="h-14 w-14 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                        <ChevronRight className="h-6 w-6 group-hover:text-white" />
                    </div>
                </div>
            </div>
          </motion.div>
        </div>

        {/* Global Hub Status Line */}
        <div className="absolute bottom-16 left-0 w-full px-16 hidden lg:flex items-center justify-between opacity-30 text-[10px] font-black uppercase tracking-[0.6em]">
            <div className="flex items-center gap-10">
                <div className="flex items-center gap-4 text-left">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>SYTEM_READY // SILICON_CAPE_HUB</span>
                </div>
                <div className="h-5 w-px bg-current/20" />
                <span>QUAL_LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-10">
                <span>PIPELINE: R2.4B/MO</span>
                <div className="h-5 w-px bg-current/20" />
                <span>POPIA_HARDENED: YES</span>
            </div>
        </div>
      </section>

      {/* Grid Section */}
      <section id="scale" className={cn(
          "py-48 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-black/5"
      )}>
        <div className="container mx-auto px-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-32">
                {[
                    { label: "Market Orchestrated", value: "R2.4B+", icon: <TrendingUp className="h-8 w-8 text-blue-500" /> },
                    { label: "Daily Qualified Leads", value: "85k+", icon: <Zap className="h-8 w-8 text-amber-500" /> },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-8 w-8 text-emerald-500" /> },
                    { label: "Active Units", value: "12.8M", icon: <Fingerprint className="h-8 w-8 text-blue-600" /> }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-10 text-left group">
                        <div className="opacity-60 group-hover:scale-110 transition-transform duration-500">{stat.icon}</div>
                        <div className="flex flex-col gap-4">
                            <span className="text-6xl font-black tracking-tighter italic leading-none">{stat.value}</span>
                            <span className="text-[11px] font-black uppercase tracking-[0.5em] opacity-40 mt-2">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Agents Section */}
      <section id="logic" className="py-48 px-10 relative text-left">
        <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-40">
                <div className="flex-1 space-y-20">
                    <div className="space-y-8">
                        <Badge className="bg-blue-600 text-white rounded-none px-6 py-2 font-black text-[11px] uppercase tracking-[0.5em]">Unit Logistics</Badge>
                        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none italic">
                            Elite Agent <br /> <span className="text-blue-600 not-italic">Distribution.</span>
                        </h2>
                        <p className="text-xl md:text-2xl opacity-50 font-light leading-relaxed max-w-2xl">
                            Deploy specialized autonomous units trained on localized financial data. From prospecting to qualification, we map the Silicon Cape in real-time.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                        {[
                            { title: "Market Sourcing", desc: "Autonomous agents scan the digital landscape for real-time intent signals." },
                            { title: "Neural Scoring", desc: "Proprietary qualification models built on localized financial readiness data." },
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
                                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none">Uptime</span>
                                <span className="text-3xl font-black italic leading-none">99.99%</span>
                            </div>
                            <div className="flex flex-col gap-2 text-right">
                                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none text-blue-600">Region</span>
                                <span className="text-3xl font-black italic leading-none uppercase">CPT // HQ</span>
                            </div>
                        </div>
                    </div>
                    <div className="absolute -top-12 -left-12 p-8 border border-blue-600/20 shadow-3xl hidden md:block backdrop-blur-3xl">
                        <BarChart3 className="h-10 w-10 text-blue-600 animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="compliance" className="py-72 relative flex flex-col items-center justify-center text-center px-10 border-t border-current/5">
        <div className="absolute inset-0 bg-blue-600/5 blur-[250px] opacity-30 pointer-events-none" />
        <div className="container mx-auto relative z-10">
            <h2 className="text-7xl md:text-[16rem] font-black tracking-tighter uppercase leading-[0.7] mb-20 italic">
                Secure <br /> The Flow.
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-20">
                <Link to="/auth/sign-up" className="w-full sm:w-auto">
                    <Button size="lg" className="h-28 px-24 text-[14px] font-black uppercase tracking-[0.4em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.5)] w-full">
                        Initialize Node
                    </Button>
                </Link>
                <div className="text-left group cursor-pointer flex flex-col gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">System Integration</div>
                    <div className="flex items-center gap-6 text-blue-600 group-hover:text-blue-500 transition-colors text-left">
                        <span className="text-3xl font-black uppercase tracking-tight italic leading-none">Speak with a <br /> Strategist</span>
                        <ArrowRight className="h-10 w-10 transform group-hover:translate-x-4 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={cn(
        "py-24 border-t transition-colors duration-1000",
        theme === "dark" ? "bg-[#000000] border-white/5" : "bg-white border-black/5"
      )}>
        <div className="container mx-auto px-10">
            <div className="flex flex-col md:flex-row items-start justify-between gap-32 mb-32 text-left">
                <div className="space-y-12 text-left">
                    <div className="flex items-center gap-5">
                        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center">
                            <Mountain className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-3xl font-black tracking-tighter uppercase italic leading-none">Agios<span className="text-blue-600">.</span>OS</span>
                    </div>
                    <p className="text-sm opacity-30 leading-relaxed font-medium max-w-sm uppercase tracking-widest italic">
                        The definitive orchestration standard for high-velocity Silicon Cape financial systems.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-24 text-left">
                    <div className="space-y-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">System</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Blueprint</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Nodes</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Legal</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Region</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Silicon Cape</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">GMT+2</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Network</h4>
                        <div className="flex gap-6 pt-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-10 w-10 border border-white/10 rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all cursor-pointer">
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
                    <span className="hidden md:block">Cape Town HQ // South Africa</span>
                </div>
                <div className="flex gap-16 italic text-left">
                    <span>Industrial.</span>
                    <span>Absolute.</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}
