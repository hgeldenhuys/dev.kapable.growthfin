import { Link } from "react-router";
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  CheckCircle2,
  Sun,
  Moon,
  Mountain,
  Activity,
  ChevronRight,
  TrendingUp,
  Fingerprint
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt17() {
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
      theme === "dark" ? "bg-[#020617] text-slate-100" : "bg-[#f8fafc] text-slate-900"
    )}>
      {/* Abstract Cape Mountain Mesh Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
        <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" className="absolute w-[150%] h-[150%] -top-[25%] -left-[25%]">
            <defs>
                <linearGradient id="meshGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={theme === "dark" ? "#1e40af" : "#3b82f6"} stopOpacity="0.1" />
                    <stop offset="100%" stopColor={theme === "dark" ? "#1e1b4b" : "#dbeafe"} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d="M0,500 C200,450 300,550 500,500 C700,450 800,550 1000,500 L1000,1000 L0,1000 Z" fill="url(#meshGradient)" />
            <path d="M0,600 C150,550 250,650 450,600 C650,550 750,650 1000,600 L1000,1000 L0,1000 Z" fill="url(#meshGradient)" opacity="0.5" />
        </svg>
      </div>

      {/* Global Status Bar */}
      <div className={cn(
        "fixed top-0 w-full z-[60] h-1 border-b transition-colors duration-500",
        theme === "dark" ? "bg-blue-600/20 border-blue-500/30" : "bg-blue-600/10 border-blue-200"
      )}>
        <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="h-full bg-blue-600" 
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-8 h-24 flex items-center">
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4 group cursor-pointer">
                <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/40 transform group-hover:scale-110 transition-transform">
                    <Mountain className="h-7 w-7 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black tracking-tighter leading-none">AGIOS<span className="text-blue-600">.</span></span>
                    <span className="text-[8px] font-bold uppercase tracking-[0.5em] opacity-40">Silicon Cape HQ</span>
                </div>
            </div>

            <div className="hidden lg:flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
                <a href="#pipeline" className="hover:text-blue-600 transition-colors">The Pipeline</a>
                <a href="#intelligence" className="hover:text-blue-600 transition-colors">Agent Intelligence</a>
                <a href="#POPIA" className="hover:text-blue-600 transition-colors">Hardened Compliance</a>
            </div>

            <div className="flex items-center gap-6">
                <button onClick={toggleTheme} className="h-10 w-10 rounded-full border border-blue-600/20 flex items-center justify-center hover:bg-blue-600/5 transition-colors">
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <div className="h-8 w-px bg-slate-500/20" />
                <Link to="/auth/sign-in">
                    <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.3em]">Terminal Login</Button>
                </Link>
                <Link to="/auth/sign-up">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-10 text-[10px] font-black uppercase tracking-[0.3em] h-12 shadow-xl shadow-blue-600/20">
                        Deploy Unit
                    </Button>
                </Link>
            </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 overflow-hidden">
        <div className="container mx-auto px-8 relative z-10 text-center flex flex-col items-center">
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-6xl flex flex-col items-center"
            >
                <Badge className={cn(
                    "mb-12 py-3 px-10 rounded-full font-bold tracking-[0.3em] uppercase text-[10px] border transition-colors",
                    theme === "dark" ? "bg-blue-900/20 border-blue-500/30 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600"
                )}>
                    Advanced Lead Orchestration // v3.0 // Silicon Cape
                </Badge>
                
                <h1 className="text-7xl md:text-9xl lg:text-[12rem] font-black tracking-tighter mb-12 leading-[0.8] uppercase italic text-center">
                    Cape <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-blue-800 pb-4 inline-block not-italic">Fintech.</span>
                </h1>

                <p className="text-lg md:text-2xl lg:text-3xl opacity-50 max-w-4xl mx-auto mb-20 font-light leading-relaxed tracking-tight">
                    Agios AI is the high-fidelity orchestration layer for South Africa's most aggressive lead generation engines. Built for the R100M+ pipeline.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-12 w-full">
                    <Button size="lg" className="h-20 px-16 text-xs font-black uppercase tracking-[0.3em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-2xl shadow-blue-600/30 w-full sm:w-auto">
                        Initialize System
                    </Button>
                    <div className="flex items-center gap-4 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">View Local Case Studies</span>
                        <div className="h-10 w-10 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                            <ChevronRight className="h-4 w-4 group-hover:text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>

        {/* Tactical Status Line */}
        <div className="absolute bottom-12 left-0 w-full px-12 hidden lg:flex items-center justify-between opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>CPT_NODE_01 // ACTIVE</span>
                </div>
                <div className="h-4 w-px bg-slate-500" />
                <span>LATENCY: 14.2MS</span>
            </div>
            <div className="flex items-center gap-6">
                <span>POPIA_READY: 100%</span>
                <div className="h-4 w-px bg-slate-500" />
                <span>GMT+2 // SOUTH AFRICA</span>
            </div>
        </div>
      </section>

      {/* The Grid: Pipeline Metrics */}
      <section id="pipeline" className={cn(
          "py-40 border-y transition-colors",
          theme === "dark" ? "border-white/5 bg-white/[0.01]" : "border-slate-200 bg-slate-50"
      )}>
        <div className="container mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-24">
                {[
                    { label: "Pipeline Orchestrated", value: "R2.4B+", icon: <TrendingUp className="h-6 w-6" /> },
                    { label: "Daily Qualified Leads", value: "85k+", icon: <Zap className="h-6 w-6" /> },
                    { label: "Agent Actions", value: "12.8M", icon: <Fingerprint className="h-6 w-6" /> },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-6 w-6" /> }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-6 text-left">
                        <div className="text-blue-600 opacity-60">{stat.icon}</div>
                        <div className="flex flex-col">
                            <span className="text-5xl font-black tracking-tighter italic leading-none">{stat.value}</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mt-4">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Section: Agent Intelligence */}
      <section id="intelligence" className="py-40">
        <div className="container mx-auto px-8">
            <div className="flex flex-col lg:flex-row items-center gap-32">
                <div className="flex-1 space-y-12 text-left">
                    <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none italic">
                        Elite <br /> Agent <br /> <span className="text-blue-600 not-italic">Networks.</span>
                    </h2>
                    <p className="text-xl opacity-50 font-light leading-relaxed max-w-lg">
                        Deploy specialized AI units trained on localized financial data. From prospecting to deep credit analysis, Agios agents handle the complexity of the Silicon Cape market.
                    </p>
                    <div className="space-y-8 pt-8">
                        {[
                            "Autonomous Market Discovery Nodes",
                            "Real-time FSR Scoring Engine",
                            "Dynamic Closing Team Routing",
                            "Deep-Chain Cognitive Tracing"
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                                <span className="text-sm font-bold uppercase tracking-widest opacity-80">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="w-full lg:w-1/2">
                    <div className={cn(
                        "aspect-square relative border p-12 flex items-center justify-center transition-all duration-700",
                        theme === "dark" ? "border-white/10 bg-black/50" : "border-black/5 bg-white shadow-2xl"
                    )}>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-[80%] h-[80%] border border-blue-600/10 rounded-full animate-spin-slow" />
                            <div className="absolute w-[60%] h-[60%] border border-blue-600/5 rounded-full animate-reverse-spin" />
                        </div>
                        <div className="relative z-10 text-center flex flex-col items-center">
                            <Activity className="h-20 w-20 text-blue-600 mb-8 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.6em] opacity-40">Orchestration Active</span>
                        </div>
                        {/* Floating Tech Card */}
                        <div className={cn(
                            "absolute -bottom-8 -right-8 p-10 border shadow-3xl backdrop-blur-2xl transition-all",
                            theme === "dark" ? "bg-black/90 border-white/10" : "bg-white/90 border-slate-200"
                        )}>
                            <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">Pipeline Velocity</div>
                            <div className="text-5xl font-black text-blue-600 italic">3.8x</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* POPIA Section */}
      <section id="POPIA" className={cn(
          "py-40 border-y transition-colors",
          theme === "dark" ? "bg-white/[0.01]" : "bg-slate-50"
      )}>
        <div className="container mx-auto px-8 max-w-5xl text-center space-y-16">
            <div className="flex justify-center">
                <div className="h-24 w-24 border-2 border-blue-600 flex items-center justify-center rounded-sm rotate-45">
                    <ShieldCheck className="h-10 w-10 text-blue-600 -rotate-45" />
                </div>
            </div>
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter italic leading-none">Hardened <br /> Local Compliance</h2>
            <p className="text-xl opacity-50 font-light leading-relaxed">
                POPIA isn't an afterthought. Every lead orchestrated by Agios is processed within a secure, localized South African data environment, meeting the highest standards of financial security and regulatory compliance.
            </p>
            <div className="flex flex-wrap justify-center gap-12">
                {["POPIA Verified", "GDPR Ready", "Bank-Grade Encryption", "Localized Nodes"].map((tag, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="h-1 w-1 rounded-full bg-blue-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">{tag}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Final CTA: The Initialization */}
      <section className="py-64 relative text-center overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 blur-[180px] opacity-20" />
        <div className="container mx-auto px-8 relative z-10">
            <h2 className="text-7xl md:text-[14rem] font-black tracking-tighter uppercase leading-[0.75] mb-20 italic">
                Secure <br /> The Pulse.
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-16">
                <Link to="/auth/sign-up">
                    <Button size="lg" className="h-24 px-20 text-[11px] font-black uppercase tracking-[0.4em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-3xl">
                        Initialize Node
                    </Button>
                </Link>
                <div className="text-left group cursor-pointer">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-3">System Access</div>
                    <div className="flex items-center gap-4 text-blue-600 transition-colors">
                        <span className="text-xl font-black uppercase tracking-tight italic">Speak with an Architect</span>
                        <ArrowRight className="h-6 w-6 transform group-hover:translate-x-2 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={cn(
        "py-20 border-t transition-colors duration-1000",
        theme === "dark" ? "bg-[#020617] border-white/5" : "bg-white border-slate-200"
      )}>
        <div className="container mx-auto px-8">
            <div className="flex flex-col md:flex-row items-start justify-between gap-20 opacity-40 text-[10px] font-black uppercase tracking-[0.4em] mb-20">
                <div className="flex items-center gap-4">
                    <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Mountain className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-lg font-black tracking-tighter uppercase">Agios.AI</span>
                </div>
                <div className="flex gap-16">
                    <div className="flex flex-col gap-6">
                        <a href="#" className="hover:text-blue-600 transition-colors">Architecture</a>
                        <a href="#" className="hover:text-blue-600 transition-colors">Pricing</a>
                    </div>
                    <div className="flex flex-col gap-6">
                        <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
                        <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
                    </div>
                    <div className="flex flex-col gap-6">
                        <a href="#" className="hover:text-blue-600 transition-colors">CPT Status</a>
                        <a href="#" className="hover:text-blue-600 transition-colors">Network</a>
                    </div>
                </div>
            </div>
            <div className="pt-12 border-t border-blue-600/5 flex flex-col md:flex-row items-center justify-between gap-8 opacity-20 text-[9px] font-black uppercase tracking-[0.5em]">
                <span>© 2025 AGIOS ORCHESTRATION INC.</span>
                <span>Silicon Cape HQ // Cape Town // South Africa</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
