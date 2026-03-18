import { Link } from "react-router";
import { 
  ShieldCheck, 
  Sun,
  Moon,
  Mountain,
  TrendingUp,
  Fingerprint,
  Zap,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt40() {
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
      {/* Visual Background: Absolute Clarity */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-10%] right-[-5%] w-[80%] h-[80%] blur-[250px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-600/30" : "bg-blue-400/30"
        )} />
        <div className={cn(
            "absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(circle_at_center,currentColor_1px,transparent_1px)] bg-[size:40px_40px]"
        )} />
      </div>

      {/* Floating Modern Header */}
      <nav className={cn(
        "fixed top-8 left-0 w-full z-50 px-10",
        "transition-transform duration-500"
      )}>
        <div className={cn(
            "container mx-auto h-16 rounded-full border backdrop-blur-2xl px-8 flex items-center justify-between transition-all duration-500 shadow-2xl",
            theme === "dark" ? "bg-black/60 border-white/10" : "bg-white/70 border-black/5"
        )}>
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30 transform group-hover:rotate-12 transition-transform">
              <Mountain className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight leading-none uppercase italic text-current">Agios<span className="text-blue-600">.</span>OS</span>
              <span className="text-[7px] font-bold uppercase tracking-[0.4em] opacity-40 mt-0.5 leading-none">Silicon Cape HQ</span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
            <a href="#pipeline" className="hover:opacity-100 transition-opacity text-current">The Pipeline</a>
            <a href="#compliance" className="hover:opacity-100 transition-opacity text-current">Compliance</a>
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
      </nav>

      {/* Hero Section: Centered & Massive Typography */}
      <section className="relative h-screen flex flex-col items-center justify-center px-10 overflow-hidden text-center shrink-0">
        <div className="container mx-auto relative z-10 flex flex-col items-center justify-center h-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center max-w-[1500px] -mt-16 md:-mt-24"
          >
            <Badge className={cn(
              "mb-12 py-3 px-10 rounded-full font-black tracking-[0.5em] uppercase text-[10px] border-2 transition-colors shrink-0 leading-none",
              theme === "dark" ? "bg-blue-950/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600 shadow-sm"
            )}>
              Advanced Lead Orchestration for Cape Fintech // v4.4.0
            </Badge>
            
            <h1 className="text-6xl md:text-9xl lg:text-[12rem] xl:text-[15rem] font-black tracking-tighter mb-10 leading-[0.75] uppercase italic text-center shrink-0">
              <span className="block text-current opacity-90">Powering</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-800 inline-block not-italic pb-6 leading-tight">
                Cape Growth.
              </span>
            </h1>

            <p className="text-xl md:text-3xl opacity-40 max-w-5xl mx-auto mb-20 font-light leading-relaxed tracking-tight shrink-0 text-center text-current">
              Agios AI is the absolute standard for South Africa's highest-velocity lead generation pipelines. Autonomous. Hardened. Infinitely Scalable.
            </p>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-16 w-full max-w-4xl shrink-0">
              <Button size="lg" className="h-24 px-20 text-[14px] font-black uppercase tracking-[0.5em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_40px_100px_rgba(37,99,235,0.6)] flex-1 transform hover:scale-105 transition-all">
                Initialize Node
              </Button>
              <div className="text-left group cursor-pointer flex flex-col gap-2 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 leading-none text-current">System Access</div>
                </div>
                <div className="flex items-center gap-6 text-blue-600 group-hover:text-blue-500 transition-colors">
                    <span className="text-3xl font-black uppercase tracking-tight italic leading-none">Technical Manual</span>
                    <ArrowRight className="h-8 w-8 transform group-hover:translate-x-4 transition-transform" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tactical Hub Status Bar: Absolute bottom to avoid overlap */}
        <div className={cn(
            "absolute bottom-12 left-0 w-full px-16 hidden lg:flex items-center justify-between font-black uppercase tracking-[0.6em] pointer-events-none opacity-30",
            theme === "dark" ? "text-white" : "text-slate-900"
        )}>
            <div className="flex items-center gap-12 text-left text-[11px] leading-none">
                <div className="flex items-center gap-4">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
                    <span>NODE_CPT_PRIMARY // READY</span>
                </div>
                <div className="h-6 w-px bg-current/20 hidden md:block" />
                <span>QUAL_LATENCY: 12.4ms</span>
            </div>
            <div className="flex items-center gap-12 text-right text-[11px] leading-none">
                <span>PIPELINE_THROUGHPUT: R2.4B / MO</span>
                <div className="h-6 w-px bg-current/20 hidden md:block" />
                <span>POPIA_HARDENING: ENABLED</span>
            </div>
        </div>
      </section>

      {/* Grid: Metrics in Rand - Improved Spacing */}
      <section id="pipeline" className={cn(
          "py-72 border-y transition-colors shrink-0 relative z-10",
          theme === "dark" ? "bg-[#020617] border-white/5 shadow-[inset_0_0_150px_rgba(0,0,0,0.5)]" : "bg-[#ffffff] border-slate-200 shadow-inner"
      )}>
        <div className="container mx-auto px-16 max-w-[1600px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-40 text-left">
                {[
                    { label: "Pipeline Orchestrated", value: "R3.4B+", icon: <TrendingUp className="h-8 w-8 text-blue-600" />, desc: "Total monthly pipeline volume." },
                    { label: "Daily leads qualified", value: "125k+", icon: <Zap className="h-8 w-8 text-amber-500" />, desc: "High-density lead throughput." },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-8 w-8 text-emerald-500" />, desc: "Regulatory hardened architecture." },
                    { label: "Active Agent population", value: "12.8M", icon: <Fingerprint className="h-8 w-8 text-blue-600" />, desc: "Autonomous units online." }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-12 text-left group">
                        <div className="opacity-60 transform group-hover:scale-110 transition-transform duration-500 text-current">{stat.icon}</div>
                        <div className="flex flex-col gap-6">
                            <span className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter italic leading-none text-current">{stat.value}</span>
                            <div className="space-y-3">
                                <span className="text-[12px] font-black uppercase tracking-[0.5em] opacity-40 leading-none block text-current">{stat.label}</span>
                                <p className="text-xs opacity-30 font-medium leading-relaxed max-w-xs text-current">{stat.desc}</p>
                            </div>
                        </div>
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
        <div className="container mx-auto px-20 text-left">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-40 mb-40">
                <div className="space-y-12 text-left">
                    <div className="flex items-center gap-6">
                        <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30">
                            <Mountain className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-4xl font-black tracking-tighter uppercase italic leading-none text-current">Agios<span className="text-blue-600">.</span>OS</span>
                    </div>
                    <p className="text-lg opacity-30 leading-relaxed font-medium max-w-md uppercase tracking-[0.2em] italic text-current text-left">
                        The definitive orchestration standard for high-velocity Silicon Cape financial systems. Decentralized. Autonomous. Hardened.
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
                        <div className="flex gap-10 pt-2">
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
                <div className="flex gap-24 italic text-left">
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
