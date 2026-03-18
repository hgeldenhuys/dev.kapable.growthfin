import { Link } from "react-router";
import { 
  ArrowUpRight, 
  Cpu, 
  Terminal, 
  ShieldCheck, 
  Zap, 
  Maximize2,
  Scan,
  Database,
  Code2,
  Command,
  Plus
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export default function LandingAlt12() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.9]);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050505] text-[#e0e0e0] selection:bg-emerald-500/30 font-mono overflow-x-hidden">
      {/* Tactical Grid Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-radial-gradient from-emerald-500/5 via-transparent to-transparent" />
      </div>

      {/* Navigation - Industrial Style */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="h-6 w-6 border-2 border-emerald-500 flex items-center justify-center group-hover:rotate-90 transition-transform duration-500">
                <div className="h-2 w-2 bg-emerald-500" />
              </div>
              <span className="text-sm font-black tracking-widest">AGIOS.OS</span>
            </div>
            <div className="hidden md:flex items-center gap-1 px-4 py-1 bg-white/5 rounded-full border border-white/5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-tighter">System Status: Optimal</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-8 text-[10px] uppercase tracking-widest font-bold text-white/50">
              <a href="#core" className="hover:text-emerald-500 transition-colors">Core</a>
              <a href="#agents" className="hover:text-emerald-500 transition-colors">Agents</a>
              <a href="#observability" className="hover:text-emerald-500 transition-colors">Observability</a>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <Link to="/auth/sign-in">
              <Button variant="ghost" className="text-[10px] uppercase font-black tracking-widest px-4 hover:bg-emerald-500/10 hover:text-emerald-500">Terminal Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero: The Command Center */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div style={{ opacity, scale }}>
            <div className="flex flex-col lg:flex-row items-start gap-12">
              <div className="flex-1 text-left">
                <Badge className="mb-6 rounded-none bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                  [ AGENTIC_LAYER_V2.1 ]
                </Badge>
                <h1 className="text-6xl md:text-8xl xl:text-9xl font-black tracking-tighter leading-[0.85] mb-8 uppercase italic">
                  Command <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-emerald-200">the Pulse</span>
                </h1>
                <p className="text-lg md:text-xl text-white/40 max-w-2xl mb-12 leading-relaxed font-light">
                  A high-density orchestration platform for autonomous agents. 
                  Observe, debug, and scale your AI workforce with millisecond precision.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button className="h-14 px-8 bg-emerald-500 text-black hover:bg-emerald-400 rounded-none font-black uppercase tracking-widest flex items-center gap-4 group">
                    Initialize Workspace <ArrowUpRight className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </Button>
                  <Button variant="outline" className="h-14 px-8 border-white/10 hover:bg-white/5 rounded-none font-black uppercase tracking-widest text-[11px]">
                    Read Documentation
                  </Button>
                </div>
              </div>

              {/* Data Visualization Widget */}
              <div className="w-full lg:w-[450px] shrink-0">
                <div className="border border-white/10 bg-white/[0.02] p-6 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-20"><Maximize2 className="h-4 w-4" /></div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs font-black uppercase tracking-widest">Live Orchestration Stream</span>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { label: "AGENT_ALPHA", status: "PROCESSING", value: "88%", color: "emerald-500" },
                      { label: "CRM_SYNC_UNIT", status: "IDLE", value: "100%", color: "white/20" },
                      { label: "NEURAL_ENRICH", status: "ERROR", value: "ERR_04", color: "red-500" },
                      { label: "STREAM_PROC", status: "ACTIVE", value: "12.4ms", color: "emerald-500" },
                    ].map((stat, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-white/40 font-bold">{stat.label}</span>
                          <span className={cn("text-[10px] font-black", `text-${stat.color}`)}>{stat.status}</span>
                        </div>
                        <span className="text-xl font-black">{stat.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 h-24 w-full bg-emerald-500/5 border border-emerald-500/10 flex items-end gap-1 p-2">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ height: "10%" }}
                        animate={{ height: `${Math.random() * 80 + 20}%` }}
                        transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                        className="flex-1 bg-emerald-500/40" 
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Grid: Features */}
      <section id="core" className="py-20 relative border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-20">
            <Scan className="h-10 w-10 text-emerald-500" />
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">Core Capabilities</h2>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border border-white/5">
            {[
              {
                title: "Unified Agent Stream",
                desc: "Real-time visibility into every thought, action, and outcome of your AI workforce.",
                icon: <Terminal className="h-6 w-6" />,
                tag: "01"
              },
              {
                title: "Cognitive Tracing",
                desc: "Debug complex LLM chains with high-fidelity visual context and state snapshots.",
                icon: <Code2 className="h-6 w-6" />,
                tag: "02"
              },
              {
                title: "Autonomous CRM",
                desc: "Seamlessly link agent intelligence with your customer data pipeline.",
                icon: <Database className="h-6 w-6" />,
                tag: "03"
              },
              {
                title: "Secure Orchestration",
                desc: "Enterprise-grade permissions and audit logs for every autonomous event.",
                icon: <ShieldCheck className="h-6 w-6" />,
                tag: "04"
              }
            ].map((f, i) => (
              <div key={i} className="bg-[#050505] p-10 group hover:bg-emerald-500/5 transition-colors relative">
                <span className="absolute top-4 right-4 text-[10px] font-black text-white/20">{f.tag}</span>
                <div className="mb-6 text-emerald-500">{f.icon}</div>
                <h3 className="text-lg font-black uppercase mb-4 tracking-tighter group-hover:text-emerald-500 transition-colors">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed font-light">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industrial Feature Highlight */}
      <section className="py-32 bg-emerald-500 text-black">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1">
              <h2 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none mb-12">
                High Velocity <br /> Observability
              </h2>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-5xl font-black mb-2">99.9%</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-60">Accuracy Rate</div>
                </div>
                <div>
                  <div className="text-5xl font-black mb-2">12ms</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-60">Avg. Latency</div>
                </div>
                <div>
                  <div className="text-5xl font-black mb-2">100M+</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-60">Events Processed</div>
                </div>
                <div>
                  <div className="text-5xl font-black mb-2">0.0s</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest opacity-60">Downtime Target</div>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-1/2">
              <div className="aspect-square bg-black p-12 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
                  <Zap className="h-[500px] w-[500px] text-emerald-500" />
                </div>
                <div className="relative z-10 text-emerald-500 font-black text-center">
                  <Command className="h-20 w-20 mx-auto mb-8 animate-spin-slow" />
                  <p className="text-xl uppercase tracking-[0.3em] mb-4">Neural Architecture</p>
                  <div className="h-1 w-32 bg-emerald-500 mx-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agents Showcase */}
      <section id="agents" className="py-32 relative">
        <div className="container mx-auto px-4">
          <div className="mb-20">
            <h2 className="text-6xl font-black uppercase tracking-tighter mb-4">Deploy Units</h2>
            <p className="text-white/40 uppercase text-xs tracking-[0.2em]">Select specialized agent blueprints for your workflow</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Prospector-7", role: "Outbound Lead Gen", type: "Cognitive" },
              { name: "Guardian-OS", role: "Security & Compliance", type: "Logic" },
              { name: "Sync-Node", role: "Cross-Platform Integration", type: "Network" },
            ].map((agent, i) => (
              <div key={i} className="border border-white/5 bg-white/[0.01] p-8 hover:border-emerald-500/50 transition-all group">
                <div className="flex items-center justify-between mb-12">
                  <div className="h-12 w-12 border border-white/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black transition-colors">
                    <Cpu className="h-6 w-6" />
                  </div>
                  <Badge className="rounded-none bg-emerald-500/10 text-emerald-500 border-none text-[8px] font-black tracking-[0.2em]">{agent.type}</Badge>
                </div>
                <h3 className="text-2xl font-black mb-2 uppercase italic">{agent.name}</h3>
                <p className="text-xs text-white/40 mb-8 uppercase tracking-widest">{agent.role}</p>
                <div className="h-px w-full bg-white/5 mb-8" />
                <Button variant="ghost" className="w-full rounded-none border border-white/10 text-[10px] uppercase font-black tracking-[0.2em] hover:bg-emerald-500 hover:text-black">Configure Unit</Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA: Final System Access */}
      <section className="py-40 bg-black relative">
        <div className="absolute inset-0 bg-emerald-500/5 mix-blend-overlay" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-6xl md:text-9xl font-black tracking-tighter uppercase mb-12 leading-none">
            Establish <br /> Link
          </h2>
          <p className="text-white/40 max-w-xl mx-auto mb-16 uppercase text-sm tracking-[0.3em] leading-relaxed">
            Begin the initialization sequence and take control of your autonomous future.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-20 px-12 bg-emerald-500 text-black rounded-none text-xl font-black uppercase tracking-widest hover:scale-105 transition-transform">
              Start Initialization
            </Button>
            <div className="p-6 border border-white/10 text-left">
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Access Token Required</div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-black text-emerald-500 uppercase tracking-widest">Public Beta Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Minimal/Industrial */}
      <footer className="py-12 border-t border-white/5 bg-[#050505]">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <span className="text-xs font-black tracking-widest">AGIOS.OS // 2025</span>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex gap-4 text-[10px] font-bold uppercase text-white/40">
              <a href="#" className="hover:text-emerald-500 transition-colors">Terms</a>
              <a href="#" className="hover:text-emerald-500 transition-colors">Privacy</a>
              <a href="#" className="hover:text-emerald-500 transition-colors">Security</a>
            </div>
          </div>
          <div className="flex gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 w-8 border border-white/10 flex items-center justify-center hover:bg-white/5 cursor-pointer">
                <Plus className="h-3 w-3" />
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
