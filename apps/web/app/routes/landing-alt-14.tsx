import { Link } from "react-router";
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Globe,
  Wallet,
  CheckCircle2,
  Sun,
  Moon,
  Mountain,
  Lock,
  LineChart,
  Network,
  TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt14() {
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
      theme === "dark" ? "bg-[#000000] text-slate-100" : "bg-[#ffffff] text-slate-900"
    )}>
      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className={cn(
          "absolute -top-[20%] -left-[10%] w-[70%] h-[70%] blur-[150px] rounded-full transition-all duration-1000 opacity-20",
          theme === "dark" ? "bg-blue-900" : "bg-blue-200"
        )} />
        <div className={cn(
          "absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] blur-[150px] rounded-full transition-all duration-1000 opacity-10",
          theme === "dark" ? "bg-amber-900" : "bg-amber-100"
        )} />
        {/* Subtle Grid */}
        <div className={cn(
            "absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:64px_64px]",
            theme === "dark" ? "opacity-100" : "opacity-50"
        )} />
      </div>

      {/* Modern Navigation */}
      <nav className={cn(
        "fixed top-0 w-full z-50 border-b backdrop-blur-md transition-colors duration-500",
        theme === "dark" ? "border-white/10 bg-black/40" : "border-slate-200 bg-white/40"
      )}>
        <div className="container mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="relative">
                <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                    <Mountain className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -inset-1 bg-blue-600/20 blur-lg rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight leading-none uppercase">Agios.AI</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.4em] opacity-40">Cape Town HQ</span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
            <a href="#platform" className="hover:text-blue-600 transition-colors">Platform</a>
            <a href="#compliance" className="hover:text-blue-600 transition-colors">POPIA Compliance</a>
            <a href="#solutions" className="hover:text-blue-600 transition-colors">Lead Gen</a>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={toggleTheme} className="opacity-50 hover:opacity-100 transition-opacity">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="h-4 w-px bg-slate-500/20" />
            <Link to="/auth/sign-in" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition-opacity">Login</Link>
            <Link to="/auth/sign-up">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-8 font-black text-[10px] uppercase tracking-[0.2em] h-11 shadow-lg shadow-blue-600/20">
                Deploy Agent
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section: The Billion Dollar Perspective */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="container mx-auto px-8 relative z-10 text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center"
          >
            <Badge className={cn(
              "mb-12 py-2.5 px-8 rounded-full font-bold tracking-[0.3em] uppercase text-[9px] border transition-colors",
              theme === "dark" ? "bg-blue-900/20 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
            )}>
              Autonomous Lead Orchestration for Enterprise
            </Badge>
            
            <h1 className="text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tighter mb-12 leading-[0.8] uppercase">
                Orchestrate <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-blue-500 to-blue-800 pb-4 inline-block leading-tight">
                    The Infinite
                </span>
            </h1>

            <p className="text-lg md:text-2xl opacity-50 max-w-3xl mx-auto mb-20 font-light leading-relaxed">
                Agios AI powers the highest-velocity lead generation engines in the Silicon Cape. 
                Built for the R100M+ pipeline, POPIA-native, and infinitely scalable.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-10 w-full max-w-2xl">
              <Button size="lg" className="h-16 px-12 text-[10px] font-black uppercase tracking-[0.3em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-2xl shadow-blue-600/30 flex-1">
                Start Orchestration
              </Button>
              <Button size="lg" variant="outline" className="h-16 px-12 text-[10px] font-black uppercase tracking-[0.3em] rounded-none border-blue-500/30 hover:bg-blue-600/5 flex-1 text-foreground">
                Technical Blueprint
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className={cn(
        "py-32 border-y transition-colors",
        theme === "dark" ? "border-white/5 bg-white/[0.01]" : "border-slate-100 bg-slate-50"
      )}>
        <div className="container mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-20">
                {[
                    { label: "Pipeline Velocity", value: "3.8x", icon: <TrendingUp className="h-5 w-5 text-blue-500" /> },
                    { label: "Daily Lead Capacity", value: "250k", icon: <Zap className="h-5 w-5 text-amber-500" /> },
                    { label: "Compliance Score", value: "100%", icon: <ShieldCheck className="h-5 w-5 text-emerald-500" /> },
                    { label: "Monthly Asset Value", value: "R2.4B", icon: <Wallet className="h-5 w-5 text-blue-400" /> },
                ].map((stat, i) => (
                    <div key={i} className="space-y-4">
                        <div className="flex items-center gap-3">
                            {stat.icon}
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{stat.label}</span>
                        </div>
                        <div className="text-5xl font-black tracking-tighter italic">{stat.value}</div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Workflow Showcase */}
      <section id="platform" className="py-40 relative">
        <div className="container mx-auto px-8">
            <div className="flex flex-col lg:flex-row gap-32 items-center">
                <div className="flex-1 space-y-12">
                    <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none italic">
                        The Lead <br /> Lifecycle, <br /> <span className="text-blue-600">Perfected.</span>
                    </h2>
                    <div className="space-y-10">
                        {[
                            { title: "Autonomous Discovery", desc: "Agents scan the market for intent signals across 50+ data sources simultaneously.", icon: <Globe className="h-6 w-6" /> },
                            { title: "Cognitive Qualification", desc: "Deep analysis of financial profiles using localized FSR and credit data models.", icon: <LineChart className="h-6 w-6" /> },
                            { title: "Dynamic Routing", desc: "Instantly distribute qualified prospects to high-performance closing teams.", icon: <Network className="h-6 w-6" /> },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-8 group">
                                <div className="h-12 w-12 shrink-0 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                    {item.icon}
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold uppercase tracking-tight">{item.title}</h3>
                                    <p className="text-sm opacity-50 leading-relaxed font-light">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="w-full lg:w-1/2">
                    <div className={cn(
                        "aspect-[4/5] relative border p-4 transition-all duration-700",
                        theme === "dark" ? "border-white/10 bg-black" : "border-slate-200 bg-white"
                    )}>
                        {/* Mock Dashboard UI */}
                        <div className="absolute inset-0 bg-blue-600/[0.02] pointer-events-none" />
                        <div className="h-full border border-blue-500/10 flex flex-col p-8">
                            <div className="flex items-center justify-between mb-12">
                                <div className="flex gap-2">
                                    <div className="h-2 w-2 rounded-full bg-blue-600" />
                                    <div className="h-2 w-2 rounded-full bg-blue-600 opacity-20" />
                                    <div className="h-2 w-2 rounded-full bg-blue-600 opacity-10" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Agent_Module_09</span>
                            </div>
                            <div className="flex-1 flex flex-col justify-center space-y-8">
                                <div className="h-24 w-full bg-blue-600/5 border border-blue-500/10 animate-pulse" />
                                <div className="space-y-4">
                                    <div className="h-1 w-full bg-blue-500/20" />
                                    <div className="h-1 w-[80%] bg-blue-500/20" />
                                    <div className="h-1 w-[60%] bg-blue-500/20" />
                                </div>
                            </div>
                            <div className="h-12 w-full border border-blue-500/20 flex items-center justify-center px-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Processing Node: CAPE_TOWN_01</span>
                            </div>
                        </div>
                        {/* Detail Box */}
                        <div className={cn(
                            "absolute -bottom-10 -left-10 p-8 border shadow-3xl hidden md:block backdrop-blur-xl",
                            theme === "dark" ? "bg-black border-white/10" : "bg-white border-slate-200"
                        )}>
                            <div className="text-[9px] font-black uppercase opacity-40 mb-2 tracking-[0.2em]">Lead conversion</div>
                            <div className="text-3xl font-black text-blue-600 italic">+142%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* POPIA / Legal Block */}
      <section id="compliance" className={cn(
        "py-40 border-y transition-colors",
        theme === "dark" ? "border-white/5 bg-white/[0.01]" : "border-slate-100 bg-slate-50"
      )}>
        <div className="container mx-auto px-8">
            <div className="max-w-4xl mx-auto text-center space-y-12">
                <div className="flex justify-center">
                    <Lock className="h-12 w-12 text-blue-600" />
                </div>
                <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic">POPIA Native Architecture</h2>
                <p className="text-lg md:text-xl opacity-50 font-light leading-relaxed">
                    Data privacy isn't a feature; it's our foundation. Agios AI includes real-time South African regulatory verification, automated consent management, and secure localized data processing as standard.
                </p>
                <div className="flex flex-wrap justify-center gap-12 pt-8">
                    {["GDPR Compliant", "POPIA Certified", "ISO 27001", "SOC2 Type II"].map((cert, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{cert}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-60 relative overflow-hidden flex flex-col items-center justify-center text-center">
        <div className="absolute inset-0 bg-blue-600/10 blur-[150px] opacity-20" />
        <div className="container mx-auto px-8 relative z-10">
            <h2 className="text-7xl md:text-[12rem] font-black tracking-tighter uppercase leading-none mb-16 italic">
                Secure <br /> the Lead
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-12">
                <Link to="/auth/sign-up">
                    <Button size="lg" className="h-20 px-16 text-[11px] font-black uppercase tracking-[0.4em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-3xl">
                        Initialize Deployment
                    </Button>
                </Link>
                <div className="text-left space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Next Step</div>
                    <div className="flex items-center gap-4 text-blue-600 hover:text-blue-500 cursor-pointer transition-colors">
                        <span className="text-sm font-black uppercase tracking-[0.1em]">Speak with a Fintech Strategist</span>
                        <ArrowRight className="h-4 w-4" />
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={cn(
        "py-20 border-t transition-colors",
        theme === "dark" ? "border-white/10 bg-black" : "border-slate-200 bg-white"
      )}>
        <div className="container mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-20 mb-32">
                <div className="col-span-1 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Mountain className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-black tracking-tight uppercase leading-none">Agios.AI</span>
                    </div>
                    <p className="text-xs opacity-40 leading-relaxed font-medium">
                        The elite orchestration layer for South African financial lead generation systems.
                    </p>
                </div>
                <div className="space-y-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">System</h4>
                    <ul className="space-y-4 text-[10px] font-bold uppercase tracking-widest opacity-50">
                        <li><a href="#" className="hover:opacity-100 transition-opacity">Overview</a></li>
                        <li><a href="#" className="hover:opacity-100 transition-opacity">Agent Specs</a></li>
                        <li><a href="#" className="hover:opacity-100 transition-opacity">Pricing</a></li>
                        <li><a href="#" className="hover:opacity-100 transition-opacity">API Docs</a></li>
                    </ul>
                </div>
                <div className="space-y-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Company</h4>
                    <ul className="space-y-4 text-[10px] font-bold uppercase tracking-widest opacity-50">
                        <li><a href="#" className="hover:opacity-100 transition-opacity">About</a></li>
                        <li><a href="#" className="hover:opacity-100 transition-opacity">Careers</a></li>
                        <li><a href="#" className="hover:opacity-100 transition-opacity">Press</a></li>
                        <li><a href="#" className="hover:opacity-100 transition-opacity">Contact</a></li>
                    </ul>
                </div>
                <div className="space-y-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Legal</h4>
                    <ul className="space-y-4 text-[10px] font-bold uppercase tracking-widest opacity-50">
                        <li><a href="#" className="hover:opacity-100 transition-opacity">POPIA</a></li>
                        <li><a href="#" className="hover:opacity-100 transition-opacity">Privacy Policy</a></li>
                        <li><a href="#" className="hover:opacity-100 transition-opacity">Terms of Use</a></li>
                    </ul>
                </div>
            </div>
            <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-12 text-[9px] font-black uppercase tracking-[0.3em] opacity-30">
                    <span>© 2025 AGIOS AI ORCHESTRATION</span>
                    <span className="hidden md:block">Cape Town, South Africa</span>
                    <span className="hidden md:block">GMT +2</span>
                </div>
                <div className="flex gap-12">
                    {["X", "LinkedIn", "GitHub"].map((link) => (
                        <a key={link} href="#" className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30 hover:opacity-100 transition-opacity">
                            {link}
                        </a>
                    ))}
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
}
