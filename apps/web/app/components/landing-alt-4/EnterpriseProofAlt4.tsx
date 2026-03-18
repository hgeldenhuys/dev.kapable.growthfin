import { Shield, Award, Building, CheckCircle2, Users, Lock, Globe } from 'lucide-react';

export function EnterpriseProofAlt4() {
  const enterpriseStats = [
    {
      value: '500+',
      label: 'Enterprise Clients',
      sublabel: 'Across 40+ industries'
    },
    {
      value: '99.9%',
      label: 'Uptime SLA',
      sublabel: 'Enterprise infrastructure'
    },
    {
      value: 'R12B+',
      label: 'Pipeline Generated',
      sublabel: 'For our clients'
    },
    {
      value: '98%',
      label: 'Client Retention',
      sublabel: 'Year over year'
    }
  ];

  const certifications = [
    {
      icon: Shield,
      name: 'SOC 2 Type II',
      description: 'Annual security audits by third-party auditors',
      color: 'blue'
    },
    {
      icon: Lock,
      name: 'POPIA Compliant',
      description: 'Full South African data protection compliance',
      color: 'indigo'
    },
    {
      icon: Award,
      name: 'ISO 27001',
      description: 'Information security management certification',
      color: 'purple'
    },
    {
      icon: Globe,
      name: 'GDPR Ready',
      description: 'European data protection regulation compliant',
      color: 'blue'
    }
  ];

  const enterpriseClients = [
    {
      name: 'Fortune 500 Financial Services',
      employees: '75,000+',
      useCase: 'Enterprise SDR team replacement across 3 regions',
      result: 'R8.4M pipeline generated in Q1'
    },
    {
      name: 'Global Healthcare Tech',
      employees: '12,000+',
      useCase: 'Multi-product portfolio lead generation',
      result: '280% increase in qualified meetings'
    },
    {
      name: 'Leading Insurance Platform',
      employees: '8,500+',
      useCase: 'Commercial lines expansion',
      result: 'R14M in closed revenue attributed to AI SDRs'
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <Building className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">TRUSTED BY ENTERPRISE LEADERS</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            Enterprise-Grade Infrastructure, Security, and Results
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Built for organizations that demand the highest standards of security, reliability, and performance.
          </p>
        </div>

        {/* Enterprise stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {enterpriseStats.map((stat, idx) => (
            <div key={idx} className="text-center">
              <div className="text-4xl sm:text-5xl font-black text-blue-600 dark:text-blue-400 mb-2">
                {stat.value}
              </div>
              <div className="font-bold text-gray-950 dark:text-white mb-1">
                {stat.label}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {stat.sublabel}
              </div>
            </div>
          ))}
        </div>

        {/* Certifications */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-gray-950 dark:text-white text-center mb-8">
            Compliance & Security Certifications
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {certifications.map((cert, idx) => {
              const Icon = cert.icon;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center hover:shadow-xl transition-shadow"
                >
                  <div className="flex justify-center mb-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      cert.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      cert.color === 'indigo' ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                      'bg-purple-100 dark:bg-purple-900/30'
                    }`}>
                      <Icon className={`h-8 w-8 ${
                        cert.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                        cert.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
                        'text-purple-600 dark:text-purple-400'
                      }`} />
                    </div>
                  </div>
                  <h4 className="font-bold text-gray-950 dark:text-white mb-2">
                    {cert.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {cert.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enterprise client case studies */}
        <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950 rounded-2xl p-8 sm:p-12 text-white">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Enterprise Client Results</h3>
            <p className="text-gray-300">How Fortune 500 companies scale with ACME CORP AI</p>
          </div>

          <div className="space-y-8">
            {enterpriseClients.map((client, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="h-5 w-5 text-blue-400" />
                      <h4 className="font-bold text-white">{client.name}</h4>
                    </div>
                    <p className="text-sm text-gray-400">{client.employees} employees</p>
                  </div>
                  <div>
                    <h5 className="font-semibold text-blue-300 mb-2">Use Case</h5>
                    <p className="text-sm text-gray-300">{client.useCase}</p>
                  </div>
                  <div>
                    <h5 className="font-semibold text-indigo-300 mb-2">Result</h5>
                    <p className="text-sm text-gray-300">{client.result}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <div className="inline-block bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <Users className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <div className="text-2xl font-bold text-white mb-2">
                Join 500+ Enterprise Organizations
              </div>
              <p className="text-gray-300 text-sm mb-4">
                Leading companies choose ACME CORP for their most critical revenue operations
              </p>
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">Dedicated support team</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">Custom integrations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">SLA guarantees</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}