import { Link } from "react-router";
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  BarChart3,
  Globe,
  Wallet,
  CheckCircle2,
  Sun,
  Moon,
  Mountain
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt13() {
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
      "min-h-screen transition-colors duration-700 font-sans selection:bg-blue-500/30 overflow-x-hidden",
      theme === "dark" ? "bg-[#020617] text-slate-200" : "bg-slate-50 text-slate-900"
    )}>
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className={cn(
          "absolute top-[-10%] right-[-10%] w-[60%] h-[60%] blur-[120px] rounded-full transition-colors duration-1000",
          theme === "dark" ? "bg-blue-600/10" : "bg-blue-400/10"
        )} />
        <div className={cn(
          "absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] blur-[120px] rounded-full transition-colors duration-1000",
          theme === "dark" ? "bg-amber-500/5" : "bg-amber-200/20"
        )} />
      </div>

      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 w-full z-50 border-b backdrop-blur-xl transition-colors duration-500",
        theme === "dark" ? "border-white/5 bg-slate-950/50" : "border-slate-200 bg-white/50"
      )}>
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Mountain className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xl font-bold tracking-tighter leading-none">AGIOS <span className="text-blue-500">AI</span></span>
              <span className="text-[8px] uppercase tracking-[0.3em] font-black opacity-50 mt-1">Silicon Cape // HQ</span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-10 text-xs font-bold uppercase tracking-widest opacity-70">
            <a href="#pipeline" className="hover:text-blue-500 transition-colors">Pipeline</a>
            <a href="#compliance" className="hover:text-blue-500 transition-colors">Compliance</a>
            <a href="#agents" className="hover:text-blue-500 transition-colors">Agents</a>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleTheme} 
              className="rounded-full hover:bg-blue-500/10 transition-colors"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <div className="h-6 w-px bg-slate-500/20 mx-2" />
            <Link to="/auth/sign-in">
              <Button variant="ghost" className="font-bold text-xs uppercase tracking-widest">Login</Button>
            </Link>
            <Link to="/auth/sign-up">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 shadow-xl shadow-blue-600/20 font-bold text-xs uppercase tracking-widest h-11">
                Deploy Now
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="container mx-auto px-6 relative z-10 text-center flex flex-col items-center justify-center h-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center max-w-6xl w-full -mt-20 md:-mt-32"
          >
            <Badge className={cn(
              "mb-10 py-2.5 px-8 rounded-full font-bold tracking-[0.2em] uppercase text-[10px] border transition-colors shrink-0",
              theme === "dark" ? "bg-white/5 border-white/10 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
            )}>
              Advanced Lead Orchestration for Fintech
            </Badge>
            
            <h1 className="text-6xl md:text-8xl lg:text-[7.5rem] font-black tracking-tighter mb-10 leading-[0.85] uppercase">
              The Engine of <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-400 to-amber-400 pb-2 inline-block">
                Cape Fintech Scale
              </span>
            </h1>

            <p className="text-base md:text-xl opacity-60 max-w-3xl mx-auto mb-12 font-light leading-relaxed">
              Agios AI provides the high-fidelity orchestration layer required for South Africa's most aggressive lead generation engines. POPIA-ready, autonomous, and built for conversion.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-2xl">
              <Button size="lg" className="h-16 px-10 text-xs font-black uppercase tracking-[0.2em] bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-2xl shadow-blue-600/30 flex-1">
                Request Local Case Study
              </Button>
              <Button size="lg" variant="outline" className="h-16 px-10 text-xs font-black uppercase tracking-[0.2em] rounded-none border-blue-500/20 hover:bg-blue-500/5 flex-1">
                Explore The Pipeline
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* South Africa Context Section */}
      <section id="pipeline" className="py-24 border-y border-blue-500/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Globe className="h-96 w-96 text-blue-500" />
        </div>
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              { label: "Pipeline Value", value: "R1.4B+", desc: "Orchestrated monthly" },
              { label: "Qualification Rate", value: "+42%", desc: "vs traditional CRM" },
              { label: "Compliance Score", value: "100%", desc: "POPIA / GDPR compliant" },
              { label: "Lead Density", value: "85k/hr", desc: "Peak throughput" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col gap-2">
                <span className="text-4xl font-black text-blue-500">{stat.value}</span>
                <span className="text-xs font-bold uppercase tracking-widest opacity-80">{stat.label}</span>
                <span className="text-[11px] opacity-40 font-medium">{stat.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="agents" className="py-32">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-end justify-between mb-24 gap-8">
            <div className="max-w-2xl text-left">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight uppercase leading-[0.9] mb-6 italic">
                Autonomous <br /> Conversion Units
              </h2>
              <p className="text-lg opacity-60 font-light">Eliminate manual qualification. Deploy specialized AI agents that handle the heavy lifting of fintech lead nurturing.</p>
            </div>
            <div className="hidden lg:block h-32 w-32 border-l border-b border-blue-500/20" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "POPIA Safeguard",
                desc: "Real-time consent verification and data masking protocols baked into every orchestration flow.",
                icon: <ShieldCheck className="h-8 w-8 text-blue-500" />
              },
              {
                title: "FSR Qualification",
                desc: "Automated financial services readiness scoring using localized Cape Town credit data patterns.",
                icon: <Wallet className="h-8 w-8 text-blue-400" />
              },
              {
                title: "Neural Distribution",
                desc: "Intelligently route leads to the right closing teams based on agent availability and past performance.",
                icon: <Zap className="h-8 w-8 text-amber-500" />
              }
            ].map((feature, i) => (
              <div key={i} className={cn(
                "p-10 border transition-all duration-300 hover:-translate-y-2 flex flex-col h-full text-left",
                theme === "dark" ? "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]" : "border-slate-200 bg-white hover:bg-slate-50"
              )}>
                <div className="mb-8">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-4 uppercase tracking-tighter">{feature.title}</h3>
                <p className="text-sm opacity-50 leading-relaxed font-light mb-8 flex-1">{feature.desc}</p>
                <div className="h-px w-full bg-blue-500/20 mb-6" />
                <Button variant="ghost" className="p-0 h-auto font-bold text-[10px] uppercase tracking-widest hover:bg-transparent text-blue-500 group justify-start">
                  View Specs <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section id="compliance" className={cn(
        "py-32 relative",
        theme === "dark" ? "bg-white/[0.01]" : "bg-blue-50/50"
      )}>
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-20 items-center">
            <div className="flex-1 space-y-10 text-left">
              <Badge className="bg-blue-600 text-white rounded-none px-4 py-1 font-black text-[10px] uppercase tracking-widest">Enterprise Trust</Badge>
              <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">
                The New Standard <br /> for Silicon Cape
              </h2>
              <div className="space-y-6">
                {[
                  "Built-in POPIA & GDPR Compliance Engines",
                  "Direct integration with major SA Banking APIs",
                  "Sub-second lead qualification at scale",
                  "24/7 dedicated support in GMT+2"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-sm font-bold opacity-80">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="w-full lg:w-1/2 relative">
               <div className={cn(
                 "aspect-video rounded-3xl border shadow-2xl overflow-hidden p-2 transition-colors duration-500",
                 theme === "dark" ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white"
               )}>
                  <div className="flex items-center gap-1.5 mb-3 px-2 pt-2">
                    <div className="h-2 w-2 rounded-full bg-red-500/30" />
                    <div className="h-2 w-2 rounded-full bg-yellow-500/30" />
                    <div className="h-2 w-2 rounded-full bg-green-500/30" />
                  </div>
                  <div className="h-full w-full bg-blue-500/5 rounded-xl flex items-center justify-center">
                    <BarChart3 className="h-24 w-24 text-blue-500/20 animate-pulse" />
                  </div>
               </div>
               <div className={cn(
                 "absolute -bottom-10 -right-10 p-6 rounded-2xl border shadow-2xl hidden md:block backdrop-blur-xl transition-colors duration-500",
                 theme === "dark" ? "bg-slate-900/80 border-white/10" : "bg-white/80 border-slate-200"
               )}>
                  <div className="text-[10px] uppercase font-black opacity-40 mb-2">Live Throughput</div>
                  <div className="text-2xl font-black text-blue-500 text-left">R2,450 / sec</div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 relative overflow-hidden text-center border-t border-blue-500/10">
        <div className="container mx-auto px-6 relative z-10">
          <h2 className="text-5xl md:text-9xl font-black tracking-tighter uppercase mb-12 leading-none italic">
            Initialize <br /> Your Lead Engine
          </h2>
          <p className="text-lg md:text-xl opacity-60 max-w-xl mx-auto mb-16 font-light uppercase tracking-widest">
            The future of Cape Town fintech starts here. Secure your orchestration layer today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/auth/sign-up">
              <Button size="lg" className="h-16 px-12 text-sm font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white rounded-none">
                Start Free Deployment
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-16 px-12 text-sm font-black uppercase tracking-widest rounded-none border-blue-500/20 hover:bg-blue-500/5">
              Contact Solutions Architect
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={cn(
        "py-16 border-t transition-colors duration-500",
        theme === "dark" ? "border-white/5 bg-slate-950" : "border-slate-200 bg-white"
      )}>
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 text-left">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Mountain className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tighter uppercase">Agios AI</span>
            </div>
            
            <div className="flex gap-12 text-[10px] font-black uppercase tracking-widest opacity-40">
              <a href="#" className="hover:text-blue-500">Platform</a>
              <a href="#" className="hover:text-blue-500">Security</a>
              <a href="#" className="hover:text-blue-500">Privacy</a>
              <a href="#" className="hover:text-blue-500">Contact</a>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Silicon Cape Hub Status: Active</span>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-blue-500/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-30 text-[9px] font-bold uppercase tracking-[0.3em]">
            <span>© 2025 AGIOS AI ORCHESTRATION INC.</span>
            <div className="flex gap-8">
              <span>Cape Town, South Africa</span>
              <span>GMT +2</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
