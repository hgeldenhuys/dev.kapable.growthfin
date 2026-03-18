import { Shield, CheckCircle2 } from 'lucide-react';

export function FooterAlt3() {
  return (
    <footer className="bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950 text-gray-400 border-t border-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Top section with trust badges */}
        <div className="mb-12 pb-8 border-b border-gray-800">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-black text-white mb-2">ACME CORP</h3>
            <p className="text-gray-400">Performance-based SDRs. No hiring risk. Guaranteed results.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2 bg-purple-900/20 rounded-lg p-3 border border-purple-800/30">
              <Shield className="h-5 w-5 text-purple-400" />
              <span className="text-sm text-purple-300">Risk-Free Guarantees</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-indigo-900/20 rounded-lg p-3 border border-indigo-800/30">
              <CheckCircle2 className="h-5 w-5 text-indigo-400" />
              <span className="text-sm text-indigo-300">15% Conversion Rate</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-purple-900/20 rounded-lg p-3 border border-purple-800/30">
              <Shield className="h-5 w-5 text-purple-400" />
              <span className="text-sm text-purple-300">60% Cost Reduction</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-indigo-900/20 rounded-lg p-3 border border-indigo-800/30">
              <CheckCircle2 className="h-5 w-5 text-indigo-400" />
              <span className="text-sm text-indigo-300">24-Hour Setup</span>
            </div>
          </div>
        </div>

        {/* Link sections */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
          <div>
            <h4 className="font-bold text-white mb-4">Why ACME CORP</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">No Hiring Risk</a></li>
              <li><a href="#" className="hover:text-white transition">Performance Guarantees</a></li>
              <li><a href="#" className="hover:text-white transition">Transparent Pricing</a></li>
              <li><a href="#" className="hover:text-white transition">Full Visibility</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">AI Research</a></li>
              <li><a href="#" className="hover:text-white transition">Multi-Channel Outreach</a></li>
              <li><a href="#" className="hover:text-white transition">Qualification</a></li>
              <li><a href="#" className="hover:text-white transition">Live Dashboard</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">ROI Calculator</a></li>
              <li><a href="#" className="hover:text-white transition">Case Studies</a></li>
              <li><a href="#" className="hover:text-white transition">Performance Reports</a></li>
              <li><a href="#" className="hover:text-white transition">Documentation</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">About</a></li>
              <li><a href="#" className="hover:text-white transition">Blog</a></li>
              <li><a href="#" className="hover:text-white transition">Careers</a></li>
              <li><a href="#" className="hover:text-white transition">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition">POPIA Compliance</a></li>
              <li><a href="#" className="hover:text-white transition">SLA</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              © 2025 ACME CORP. All rights reserved.
            </p>

            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">Built for B2B sales teams who want results, not risk.</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
