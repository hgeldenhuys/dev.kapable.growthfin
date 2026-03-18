import { Link } from "react-router";
import { 
  ShieldCheck, 
  Zap, 
  Globe,
  Wallet,
  CheckCircle2,
  Sun,
  Moon,
  Mountain,
  LineChart,
  Activity,
  MapPin,
  ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export default function LandingAlt16() {
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
      theme === "dark" ? "bg-[#050505] text-slate-200" : "bg-slate-50 text-slate-900"
    )}>
      {/* Blueprint Grid Background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] dark:opacity-[0.07]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* Floating Header */}
      <header className="fixed top-0 w-full z-50 px-8 py-6">
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4 group cursor-pointer">
                <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)] group-hover:scale-110 transition-transform">
                    <Mountain className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-xl font-black tracking-tighter leading-none uppercase">Agios.OS</span>
                    <span className="text-[7px] font-bold uppercase tracking-[0.5em] opacity-40">Silicon Cape HQ</span>
                </div>
            </div>

            <div className="hidden lg:flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.3em] opacity-50">
                <a href="#logic" className="hover:opacity-100 transition-opacity">Logic</a>
                <a href="#nodes" className="hover:opacity-100 transition-opacity">Nodes</a>
                <a href="#security" className="hover:opacity-100 transition-opacity">POPIA</a>
            </div>

            <div className="flex items-center gap-6">
                <button onClick={toggleTheme} className="opacity-40 hover:opacity-100 transition-opacity">
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <div className="h-6 w-px bg-slate-500/20 mx-2" />
                <Link to="/auth/sign-in">
                    <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.3em] h-10 px-4">Login</Button>
                </Link>
                <Link to="/auth/sign-up">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-none px-8 text-[10px] font-black uppercase tracking-[0.3em] h-12 shadow-xl shadow-blue-600/20">
                        Initialize
                    </Button>
                </Link>
            </div>
        </div>
      </header>

      {/* Hero: Tactical Orchestration */}
      <section className="relative h-screen flex flex-col items-center justify-center px-8 overflow-hidden">
        <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between gap-16 relative z-10">
            <motion.div 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="flex-1 space-y-10 text-left max-w-2xl"
            >
                <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Silicon Cape Hub // Active</span>
                </div>
                <h1 className="text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tighter mb-4 leading-[0.8] uppercase italic">
                    Map the <br /> 
                    <span className="text-blue-600 not-italic">Flow.</span>
                </h1>
                <p className="max-w-lg text-lg md:text-xl lg:text-2xl opacity-50 font-light leading-relaxed tracking-tight">
                    The orchestration layer for South Africa's most advanced financial lead generation systems. 
                    Built for speed, localized for the Cape, secured for the enterprise.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-10 pt-6">
                    <Button size="lg" className="h-20 px-16 text-[11px] font-black uppercase tracking-[0.3em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-2xl shadow-blue-600/30 w-full sm:w-auto">
                        View Blueprint
                    </Button>
                    <div className="flex items-center gap-6 group cursor-pointer opacity-40 hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Architecture</span>
                        <div className="h-10 w-10 rounded-full border border-blue-600/30 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                            <ChevronRight className="h-4 w-4 group-hover:text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Visual: The Engine Matrix */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="w-full lg:w-[45%] relative aspect-square max-w-[600px]"
            >
                <div className={cn(
                    "w-full h-full rounded-full border-2 p-16 flex items-center justify-center relative transition-colors duration-700",
                    theme === "dark" ? "border-white/5 bg-white/[0.01]" : "border-black/5 bg-slate-50"
                )}>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[90%] h-[90%] border border-blue-600/10 rounded-full animate-spin-slow opacity-20" />
                        <div className="absolute w-[70%] h-[70%] border border-blue-600/5 rounded-full animate-reverse-spin opacity-10" />
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                        <Activity className="h-12 w-12 text-blue-600 mb-8 animate-pulse" />
                        <div className="text-center">
                            <div className="text-3xl font-black italic tracking-tighter uppercase">Active Stream</div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.4em] opacity-30 mt-4">Node // GMT+2</div>
                        </div>
                    </div>

                    {/* Data Nodes */}
                    {[
                        { icon: <CheckCircle2 className="h-4 w-4" />, label: "POPIA", pos: "top-[15%] left-[10%]" },
                        { icon: <Zap className="h-4 w-4" />, label: "12ms", pos: "top-[40%] -right-4" },
                        { icon: <Wallet className="h-4 w-4" />, label: "R2.4B", pos: "bottom-[15%] left-[20%]" },
                    ].map((point, i) => (
                        <div key={i} className={cn("absolute p-3 border backdrop-blur-md flex items-center gap-3 transition-all shadow-xl", point.pos, theme === "dark" ? "bg-black border-white/10" : "bg-white border-black/5")}>
                            <div className="text-blue-600 scale-75 shrink-0">{point.icon}</div>
                            <span className="text-[8px] font-black uppercase tracking-widest shrink-0">{point.label}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>

        {/* Region Indicator */}
        <div className="absolute bottom-10 left-10 flex items-center gap-6 opacity-20">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Silicon Cape Hub // CPT // HQ</span>
        </div>
      </section>

      {/* Grid: High Density Logic */}
      <section id="logic" className={cn(
          "py-32 border-y transition-colors",
          theme === "dark" ? "border-white/5 bg-white/[0.01]" : "border-black/5 bg-slate-50"
      )}>
        <div className="container mx-auto px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                {[
                    { title: "Market Scanning", desc: "Autonomous nodes monitoring intent signals across 50M+ South African data points.", icon: <Globe className="h-6 w-6" /> },
                    { title: "Localized FSR", desc: "Financial services readiness scoring built on deep regional credit models.", icon: <LineChart className="h-6 w-6" /> },
                    { title: "Regulatory Guard", desc: "Native POPIA/GDPR compliance baked into every autonomous decision loop.", icon: <ShieldCheck className="h-6 w-6" /> }
                ].map((item, i) => (
                    <div key={i} className="space-y-6 text-left">
                        <div className="h-12 w-12 border border-blue-600/30 flex items-center justify-center text-blue-600">
                            {item.icon}
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tighter italic">{item.title}</h3>
                        <p className="text-sm opacity-50 font-light leading-relaxed">{item.desc}</p>
                        <div className="h-px w-20 bg-blue-600/20" />
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={cn(
        "py-16 border-t transition-colors",
        theme === "dark" ? "border-white/5 bg-black" : "border-black/5 bg-white"
      )}>
        <div className="container mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-8 opacity-40 text-[9px] font-black uppercase tracking-[0.4em]">
            <div className="flex items-center gap-12">
                <span>© 2025 AGIOS ORCHESTRATION</span>
                <span className="hidden md:block">Cape Town HQ // GMT+2</span>
            </div>
            <div className="flex gap-12">
                <a href="#" className="hover:text-blue-600 transition-colors">Specifications</a>
                <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
                <a href="#" className="hover:text-blue-600 transition-colors">Network</a>
            </div>
        </div>
      </footer>
    </div>
  );
}
