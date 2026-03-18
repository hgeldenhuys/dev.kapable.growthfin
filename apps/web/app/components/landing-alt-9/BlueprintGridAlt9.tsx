import { Database, Server, Cpu, Network } from 'lucide-react';

export function BlueprintGridAlt9() {
  return (
    <section className="py-20 border-y border-[#233554] bg-[#112240]">
      <div className="container mx-auto px-4">
        <h3 className="font-mono text-xl mb-12 text-center text-gray-400">
          {'< SYSTEM_COMPONENTS />'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#233554] border border-[#233554]">
          {[
            { icon: Database, title: 'Data Lake', desc: 'R2M+ pipeline generation.' },
            { icon: Cpu, title: 'Neural Engine', desc: '15% conversion rates.' },
            { icon: Network, title: 'Orchestrator', desc: '60% cost reduction.' },
            { icon: Server, title: 'Compliance', desc: 'POPIA_COMPLIANCE_MODULE.' }
          ].map((item, i) => (
            <div key={i} className="bg-[#0a192f] p-8 hover:bg-[#112240] transition-colors group">
              <item.icon className="w-8 h-8 mb-4 text-[#64ffda] opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="font-mono font-bold text-white mb-2">{item.title}</div>
              <div className="font-mono text-sm text-gray-400">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
