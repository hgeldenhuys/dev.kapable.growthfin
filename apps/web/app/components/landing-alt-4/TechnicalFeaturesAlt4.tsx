import { Server, Database, Cpu, Cloud, Shield, Zap, GitBranch, Monitor } from 'lucide-react';

export function TechnicalFeaturesAlt4() {
  const features = [
    {
      icon: Database,
      title: 'Real-Time Data Synchronization',
      description: 'Bi-directional sync with Salesforce, HubSpot, Pipedrive, and 50+ other platforms. Zero manual data entry.',
      specs: ['{"<"}100ms sync latency', '99.99% data accuracy', 'AES-256 encryption'],
      color: 'blue'
    },
    {
      icon: Server,
      title: 'Enterprise Infrastructure',
      description: 'Built on AWS/Azure multi-region architecture. Auto-scaling, load balancing, and redundancy built-in.',
      specs: ['99.9% uptime SLA', 'Auto-scaling to 100K+ leads', 'Multi-region failover'],
      color: 'indigo'
    },
    {
      icon: Cpu,
      title: 'Neural Processing Engine',
      description: 'Custom AI models trained on 500M+ sales interactions. Optimized inference on NVIDIA H100 GPUs.',
      specs: ['{"<"}50ms response time', 'Real-time optimization', 'Continuous model updates'],
      color: 'purple'
    },
    {
      icon: Cloud,
      title: 'Multi-Channel Orchestration',
      description: 'Unified API for email, LinkedIn, phone, SMS, and WhatsApp. Intelligent channel selection and timing.',
      specs: ['5+ communication channels', 'Smart send-time optimization', 'Response prediction'],
      color: 'blue'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'SOC 2 Type II, ISO 27001, POPIA, and GDPR compliant. Advanced threat detection and prevention.',
      specs: ['Zero-trust architecture', 'End-to-end encryption', 'Role-based access control'],
      color: 'indigo'
    },
    {
      icon: Monitor,
      title: 'Real-Time Analytics',
      description: 'Live dashboards with predictive insights. Track conversion funnels, channel performance, and ROI.',
      specs: ['Real-time updates', 'Predictive analytics', 'Custom report builder'],
      color: 'purple'
    }
  ];

  const techStack = [
    { category: 'AI/ML', tools: ['TensorFlow', 'PyTorch', 'Transformers', 'OpenAI API'] },
    { category: 'Infrastructure', tools: ['AWS', 'Kubernetes', 'Docker', 'Terraform'] },
    { category: 'Frontend', tools: ['React', 'TypeScript', 'Next.js', 'Tailwind'] },
    { category: 'Backend', tools: ['Node.js', 'Python', 'PostgreSQL', 'Redis'] },
    { category: 'Integrations', tools: ['REST APIs', 'GraphQL', 'Webhook', 'iPaaS'] },
    { category: 'Security', tools: ['OAuth 2.0', 'SAML', 'JWT', 'Vault'] }
  ];

  const colorMap = {
    blue: {
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      accent: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      bg: 'from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800',
      description: 'text-gray-700 dark:text-gray-300'
    },
    indigo: {
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      accent: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-800',
      bg: 'from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800',
      description: 'text-gray-700 dark:text-gray-300'
    },
    purple: {
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      accent: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
      bg: 'from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800',
      description: 'text-gray-700 dark:text-gray-300'
    }
  };

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <GitBranch className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">ENTERPRISE TECHNICAL SPECIFICATIONS</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            Built for Scale, Security, and Performance
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Enterprise-grade infrastructure with the flexibility to customize for your specific needs.
          </p>
        </div>

        {/* Technical features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            const colors = colorMap[feature.color as keyof typeof colorMap];

            return (
              <div
                key={idx}
                className={`group relative overflow-hidden rounded-xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-8 hover:shadow-2xl transition-all duration-300`}
              >
                {/* Animated accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>

                <div className="flex items-start gap-4 mb-6">
                  <div className={`flex-shrink-0 ${colors.iconBg} rounded-lg p-3`}>
                    <Icon className={`h-6 w-6 ${colors.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-950 dark:text-white">
                    {feature.title}
                  </h3>
                </div>

                <p className={`leading-relaxed mb-6 ${colors.description}`}>
                  {feature.description}
                </p>

                <div className="space-y-2">
                  {feature.specs.map((spec, specIdx) => (
                    <div key={specIdx} className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{spec}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tech stack */}
        <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950 rounded-2xl p-8 sm:p-12 text-white">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Modern Tech Stack</h3>
            <p className="text-gray-300">
              Best-in-class technologies for reliability, security, and performance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {techStack.map((category, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  {category.category}
                </h4>
                <div className="space-y-2">
                  {category.tools.map((tool, toolIdx) => (
                    <div key={toolIdx} className="bg-white/5 rounded-lg px-3 py-2 text-sm">
                      {tool}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <div className="inline-block bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-6 border border-blue-500/30">
              <Cloud className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <div className="text-2xl font-bold mb-2">Cloud-Native Architecture</div>
              <p className="text-gray-300 text-sm max-w-2xl">
                Built from the ground up for cloud scalability. Auto-scales to handle millions of prospects,
                with zero downtime deployments and instant global replication.
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="font-semibold text-blue-300">99.9% Uptime</div>
                  <div className="text-gray-400">Enterprise SLA</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="font-semibold text-indigo-300">{'<50ms'} Latency</div>
                  <div className="text-gray-400">Global CDN</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="font-semibold text-purple-300">Unlimited Scale</div>
                  <div className="text-gray-400">Auto-scaling</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}