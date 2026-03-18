import { Brain, Server, Shield, Cpu } from 'lucide-react';

export function FooterAlt4() {
  return (
    <footer className="bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950 text-gray-400 border-t border-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Top section with enterprise badges */}
        <div className="mb-12 pb-8 border-b border-gray-800">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-black text-white mb-2">ACME CORP</h3>
            <p className="text-gray-400">Enterprise AI SDR Intelligence Platform</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2 bg-blue-900/30 rounded-lg p-3 border border-blue-700/40">
              <Brain className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-blue-300">Neural AI</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-indigo-900/30 rounded-lg p-3 border border-indigo-700/40">
              <Server className="h-5 w-5 text-indigo-400" />
              <span className="text-sm text-indigo-300">Enterprise Scale</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-purple-900/30 rounded-lg p-3 border border-purple-700/40">
              <Shield className="h-5 w-5 text-purple-400" />
              <span className="text-sm text-purple-300">99.9% Uptime</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-blue-900/30 rounded-lg p-3 border border-blue-700/40">
              <Cpu className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-blue-300">Real-Time Learning</span>
            </div>
          </div>
        </div>

        {/* Link sections */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
          <div>
            <h4 className="font-bold text-white mb-4">AI Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">Neural Architecture</a></li>
              <li><a href="#" className="hover:text-white transition">Research Intelligence</a></li>
              <li><a href="#" className="hover:text-white transition">Multi-Channel Outreach</a></li>
              <li><a href="#" className="hover:text-white transition">Qualification Engine</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Enterprise</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">Security & Compliance</a></li>
              <li><a href="#" className="hover:text-white transition">Custom Integrations</a></li>
              <li><a href="#" className="hover:text-white transition">Dedicated Support</a></li>
              <li><a href="#" className="hover:text-white transition">SLA Guarantees</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Technology</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">Infrastructure</a></li>
              <li><a href="#" className="hover:text-white transition">API Documentation</a></li>
              <li><a href="#" className="hover:text-white transition">White Papers</a></li>
              <li><a href="#" className="hover:text-white transition">System Status</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">Case Studies</a></li>
              <li><a href="#" className="hover:text-white transition">AI Benchmarks</a></li>
              <li><a href="#" className="hover:text-white transition">Technical Blog</a></li>
              <li><a href="#" className="hover:text-white transition">Developer Portal</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition">POPIA Compliance</a></li>
              <li><a href="#" className="hover:text-white transition">SLA & DPA</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              © 2025 ACME CORP. All rights reserved.
            </p>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-400">All systems operational</span>
              </div>
              <span className="text-gray-600">•</span>
              <span className="text-gray-600">SOC 2 Type II Certified</span>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-600">
              Enterprise AI SDR Platform | Neural Prospect Intelligence | Real-Time Learning | Multi-Channel Orchestration
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
