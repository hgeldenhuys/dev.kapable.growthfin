import { Zap, Shield, Target, MousePointer2 } from "lucide-react";

const features = [
  {
    title: "Instant Setup",
    description: "Launch your first AI SDR campaign in minutes, not days. We handle the heavy lifting.",
    icon: Zap,
  },
  {
    title: "Hyper-Targeted",
    description: "Our AI identifies your ideal customer profile with surgical precision.",
    icon: Target,
  },
  {
    title: "POPIA Compliant",
    description: "Built with privacy first. Fully compliant with data protection regulations.",
    icon: Shield,
  },
  {
    title: "High Conversion",
    description: "Optimized outreach patterns that actually get responses and book meetings.",
    icon: MousePointer2,
  },
];

export function FeaturesResend() {
  return (
    <div className="bg-black py-32 border-y border-zinc-900">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
