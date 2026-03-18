import { Link } from "react-router";
import { 
  ArrowRight, 
  Zap, 
  Sun,
  Moon,
  Mountain,
  Activity,
  ChevronRight,
  Fingerprint,
  Lock,
  Globe
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt18() {
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
      theme === "dark" ? "bg-[#030712] text-slate-100" : "bg-[#ffffff] text-slate-900"
    )}>
      {/* Premium Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-20%] left-[-10%] w-[100%] h-[100%] blur-[180px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-600/30" : "bg-blue-400/20"
        )} />
        <div className={cn(
          "absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] blur-[180px] rounded-full transition-all duration-1000 opacity-10",
          theme === "dark" ? "bg-emerald-600/20" : "bg-emerald-100/40"
        )} />
        {/* Subtle Noise Texture */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      {/* Floating Modern Header */}
      <header className="fixed top-8 left-0 w-full z-50 px-8">
        <div className={cn(
            "container mx-auto h-16 rounded-full border backdrop-blur-2xl px-8 flex items-center justify-between transition-all duration-500",
            theme === "dark" ? "bg-black/60 border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]" : "bg-white/60 border-black/5 shadow-xl shadow-black/5"
        )}>
            <div className="flex items-center gap-3 group cursor-pointer">
                <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30 transform group-hover:rotate-12 transition-transform">
                    <Mountain className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-lg font-black tracking-tighter leading-none uppercase italic">Agios<span className="text-blue-600">.Prime</span></span>
                    <span className="text-[7px] font-bold uppercase tracking-[0.4em] opacity-40">Silicon Cape HQ</span>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                <a href="#engine" className="hover:opacity-100 transition-opacity">Engine</a>
                <a href="#compliance" className="hover:opacity-100 transition-opacity">Compliance</a>
                <a href="#impact" className="hover:opacity-100 transition-opacity">Impact</a>
            </div>

            <div className="flex items-center gap-4">
                <button onClick={toggleTheme} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-blue-600/10 transition-colors">
                    {theme === "dark" ? <Sun className="h-4 w-4 opacity-50" /> : <Moon className="h-4 w-4 opacity-50" />}
                </button>
                <div className="h-6 w-px bg-slate-500/20" />
                <Link to="/auth/sign-in" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition-opacity">Login</Link>
                <Link to="/auth/sign-up">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 text-[10px] font-black uppercase tracking-[0.2em] h-10 shadow-lg shadow-blue-600/20">
                        Deploy Unit
                    </Button>
                </Link>
            </div>
        </div>
      </header>

      {/* Hero Section: Generous Spacing & High Focus */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-8">
        <div className="container mx-auto relative z-10 text-center flex flex-col items-center max-w-6xl">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center"
            >
                <Badge className={cn(
                    "mb-12 py-3 px-8 rounded-full font-bold tracking-[0.3em] uppercase text-[10px] border transition-colors",
                    theme === "dark" ? "bg-white/5 border-white/10 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
                )}>
                    The Autonomous Lead Engine // Silicon Cape
                </Badge>
                
                <h1 className="text-6xl md:text-8xl lg:text-[11rem] font-black tracking-tighter mb-12 leading-[0.8] uppercase italic flex flex-col items-center">
                    <span className="block">Orchestrating</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-emerald-400 inline-block not-italic pb-4 leading-tight">
                        Cape Growth.
                    </span>
                </h1>

                <p className="text-lg md:text-2xl lg:text-3xl opacity-40 max-w-4xl mx-auto mb-20 font-light leading-relaxed tracking-tight">
                    Powering South Africa's most aggressive lead generation pipelines with millisecond precision and POPIA-hardened autonomous intelligence.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-12 w-full max-w-2xl">
                    <Button size="lg" className="h-20 px-16 text-[11px] font-black uppercase tracking-[0.3em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_20px_50px_rgba(37,99,235,0.4)] flex-1 w-full sm:w-auto transform hover:scale-105 transition-all">
                        Initialize System
                    </Button>
                    <div className="flex items-center gap-6 group cursor-pointer opacity-60 hover:opacity-100 transition-opacity">
                        <div className="text-left">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Local Access</div>
                            <span className="text-xs font-black uppercase tracking-[0.1em]">Cape Town Case Studies</span>
                        </div>
                        <div className="h-10 w-10 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-2xl">
                            <ChevronRight className="h-4 w-4 group-hover:text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>

        {/* Global Latency Strip */}
        <div className="absolute bottom-12 left-0 w-full px-12 hidden lg:flex items-center justify-between opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]" />
                    <span>CPT_NODE_PRIMARY // ONLINE</span>
                </div>
                <div className="h-4 w-px bg-slate-500/50" />
                <span>QUALIFICATION_LATENCY: 14.8MS</span>
            </div>
            <div className="flex items-center gap-6">
                <span>LOCAL_PIPELINE: R2.4B/MO</span>
                <div className="h-4 w-px bg-slate-500/50" />
                <span>POPIA_GUARD: ACTIVE</span>
            </div>
        </div>
      </section>

      {/* Feature Section: The Engine (Bento Grid) */}
      <section id="engine" className="py-40 border-t border-white/5 relative">
        <div className="container mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 auto-rows-[340px]">
                {/* Large Main Feature */}
                <div className={cn(
                    "md:col-span-12 lg:col-span-8 p-12 border relative overflow-hidden group transition-all duration-700",
                    theme === "dark" ? "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]" : "bg-slate-50 border-black/5 hover:bg-slate-100"
                )}>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="space-y-6">
                            <Badge className="bg-blue-600/10 text-blue-500 rounded-none border-none text-[8px] font-black uppercase">Orchestration Alpha</Badge>
                            <h3 className="text-5xl font-black uppercase italic tracking-tighter leading-[0.9]">Autonomous Lead <br /> Lifecycle.</h3>
                        </div>
                        <p className="max-w-md text-base opacity-50 font-light leading-relaxed">Agents that scan, qualify, and route with superhuman velocity. We handle the heavy lifting of fintech prospecting at scale.</p>
                        <Button variant="ghost" className="p-0 h-auto font-black text-[10px] uppercase tracking-widest text-blue-600 hover:bg-transparent group justify-start">
                            Explore Engine Specs <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                    <div className="absolute -bottom-20 -right-20 h-[500px] w-[500px] opacity-10 group-hover:opacity-20 transition-opacity duration-1000">
                        <Activity className="h-full w-full text-blue-600" />
                    </div>
                </div>

                {/* Secondary Feature 1 */}
                <div className={cn(
                    "md:col-span-6 lg:col-span-4 p-12 border relative overflow-hidden transition-all duration-700",
                    theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-slate-50 border-black/5"
                )}>
                    <Lock className="h-10 w-10 text-blue-600 mb-10" />
                    <h3 className="text-2xl font-black uppercase tracking-tight mb-4 leading-none italic">Hardened <br /> Privacy.</h3>
                    <p className="text-sm opacity-40 font-light leading-relaxed">Built for Silicon Cape legal standards. 100% POPIA compliance natively integrated into every node.</p>
                </div>

                {/* Secondary Feature 2 */}
                <div className={cn(
                    "md:col-span-6 lg:col-span-4 p-12 border relative overflow-hidden transition-all duration-700",
                    theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-slate-50 border-black/5"
                )}>
                    <Zap className="h-10 w-10 text-amber-500 mb-10" />
                    <h3 className="text-2xl font-black uppercase tracking-tight mb-4 leading-none italic">Millisecond <br /> Response.</h3>
                    <p className="text-sm opacity-40 font-light leading-relaxed">Instant qualification scoring using localized CPT credit and FSR data models. No lag, just conversion.</p>
                </div>

                {/* Third Feature: Wide */}
                <div className={cn(
                    "md:col-span-12 lg:col-span-8 p-12 border relative overflow-hidden group transition-all duration-700",
                    theme === "dark" ? "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]" : "bg-slate-50 border-black/5 hover:bg-slate-100"
                )}>
                    <div className="relative z-10 h-full flex flex-col">
                        <h3 className="text-5xl font-black uppercase italic tracking-tighter leading-[0.9] mb-8">Node Network <br /> Distribution.</h3>
                        <p className="max-w-lg text-base opacity-50 font-light leading-relaxed">Centralized command over distributed agent clusters. Coordinate multiple fintech product lines from a single, high-fidelity dashboard.</p>
                        <div className="mt-auto flex items-center gap-12">
                            {[
                                { label: "Nodes", value: "24" },
                                { label: "Latency", value: "14ms" },
                                { label: "Uptime", value: "99.9%" }
                            ].map((stat, i) => (
                                <div key={i}>
                                    <div className="text-[8px] font-black uppercase tracking-widest opacity-30">{stat.label}</div>
                                    <div className="text-2xl font-black italic text-blue-600">{stat.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <Globe className="absolute -bottom-10 -right-10 h-80 w-80 text-blue-600/5 group-hover:scale-110 transition-transform duration-1000" />
                </div>
            </div>
        </div>
      </section>

      {/* Impact Section: Rand Denominated Scale */}
      <section id="impact" className={cn(
          "py-40 transition-colors border-y",
          theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-black/5"
      )}>
        <div className="container mx-auto px-8 text-center max-w-5xl">
            <h2 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter uppercase mb-24 leading-[0.8] italic">
                Dominating <br /> <span className="text-blue-600 not-italic">The Market.</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-32">
                {[
                    { label: "Pipeline Value", value: "R2.4B+" },
                    { label: "Daily Qualified", value: "85,000+" },
                    { label: "ROI Increase", value: "142%" }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col items-center gap-6">
                        <div className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">{stat.label}</div>
                        <div className="text-7xl md:text-8xl font-black italic tracking-tighter">{stat.value}</div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* CTA: Final Initialization */}
      <section className="py-64 relative overflow-hidden flex flex-col items-center justify-center text-center">
        <div className="absolute inset-0 bg-blue-600/10 blur-[150px] opacity-20 pointer-events-none" />
        <div className="container mx-auto px-8 relative z-10 flex flex-col items-center">
            <h2 className="text-8xl md:text-[14rem] font-black tracking-tighter uppercase leading-[0.7] mb-20 italic">
                Secure <br /> The Pulse.
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-16 w-full max-w-4xl">
                <Link to="/auth/sign-up" className="w-full sm:w-auto">
                    <Button size="lg" className="h-24 px-20 text-[12px] font-black uppercase tracking-[0.4em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-[0_30px_70px_rgba(37,99,235,0.4)] w-full">
                        Initialize Deployment
                    </Button>
                </Link>
                <div className="text-left group cursor-pointer flex flex-col gap-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Technical Sequence</div>
                    <div className="flex items-center gap-6 text-blue-600 group-hover:text-blue-500 transition-colors">
                        <span className="text-2xl font-black uppercase tracking-tight italic">Speak with an Architect</span>
                        <ArrowRight className="h-8 w-8 transform group-hover:translate-x-3 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Footer: Industrial Precision */}
      <footer className={cn(
        "py-24 border-t transition-colors duration-1000",
        theme === "dark" ? "bg-black border-white/10" : "bg-white border-black/10"
      )}>
        <div className="container mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-20 mb-24">
                <div className="md:col-span-4 space-y-10">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center">
                            <Mountain className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-2xl font-black tracking-tighter uppercase italic">Agios.Prime</span>
                    </div>
                    <p className="text-sm opacity-30 leading-relaxed font-medium max-w-xs uppercase tracking-widest">
                        Orchestrating high-velocity financial pipelines for the Silicon Cape economy. Decentralized. Autonomous. Secured.
                    </p>
                </div>
                
                <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-12">
                    <div className="space-y-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Engine</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Specs</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Nodes</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Status</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Security</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Audit</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Cloud</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Region</h4>
                        <ul className="space-y-6 text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <li><a href="#" className="hover:opacity-100 transition-opacity">Silicon Cape</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">CPT Hub</a></li>
                            <li><a href="#" className="hover:opacity-100 transition-opacity">HQ</a></li>
                        </ul>
                    </div>
                    <div className="space-y-10">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Identity</h4>
                        <div className="flex gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-10 w-10 border border-white/10 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all cursor-pointer">
                                    <Fingerprint className="h-4 w-4" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-12 opacity-20 text-[10px] font-black uppercase tracking-[0.4em]">
                <div className="flex items-center gap-10">
                    <span>© 2025 AGIOS PRIME ORCHESTRATION</span>
                    <span className="hidden md:block">GMT+2 // SOUTH AFRICA</span>
                </div>
                <div className="flex gap-10 italic">
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
