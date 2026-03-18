import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { ArrowRight, Brain, Zap, Target, Layers, Activity } from 'lucide-react';
import { trackEvent } from '~/lib/posthog';

export function HeroSectionAlt4() {
  const [showTechDialog, setShowTechDialog] = useState(false);

  const handlePrimaryCTA = () => {
    trackEvent('cta_clicked', {
      location: 'hero',
      variant: 'primary',
      text: 'See Live AI in Action',
      test_variant: 'alt-4'
    });
    document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSecondaryCTA = () => {
    trackEvent('cta_clicked', {
      location: 'hero',
      variant: 'secondary',
      text: 'Explore the Technology',
      test_variant: 'alt-4'
    });
    setShowTechDialog(true);
  };

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950 pt-16">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="text-white">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6 w-fit">
                <Brain className="h-4 w-4" />
                <span className="text-sm font-semibold">Advanced AI Technology</span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                Enterprise-Grade AI
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  SDR Intelligence
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl sm:text-2xl text-gray-300 mb-8 max-w-2xl leading-relaxed">
                Powered by 3-tier neural architecture, multi-channel learning, and real-time optimization. Not automation—actual intelligence.
              </p>

              {/* AI Stats */}
              <div className="grid grid-cols-2 gap-4 mb-10 py-6 border-y border-white/10">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">99.7%</div>
                  <div className="text-sm text-gray-400">Uptime SLA</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-400">
                    <Activity className="h-6 w-6 inline mr-1" />
                    24/7
                  </div>
                  <div className="text-sm text-gray-400">Active Learning</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">500M+</div>
                  <div className="text-sm text-gray-400">Data Points</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">18%</div>
                  <div className="text-sm text-gray-400">Avg. Conversion</div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={handlePrimaryCTA}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold px-8 py-6 text-lg min-h-[44px] w-full sm:w-auto"
                >
                  See Live AI in Action
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleSecondaryCTA}
                  className="border-2 border-white/30 bg-transparent text-white hover:bg-white/10 font-semibold px-8 py-6 text-lg min-h-[44px] w-full sm:w-auto transition-colors"
                >
                  <Brain className="mr-2 h-5 w-5" />
                  Explore the Technology
                </Button>
              </div>

              {/* Tech tags */}
              <div className="mt-8 flex flex-wrap gap-2">
                <div className="bg-white/5 rounded-lg px-3 py-1 border border-white/10">
                  <span className="text-xs text-blue-300">Neural Networks</span>
                </div>
                <div className="bg-white/5 rounded-lg px-3 py-1 border border-white/10">
                  <span className="text-xs text-indigo-300">Transformer AI</span>
                </div>
                <div className="bg-white/5 rounded-lg px-3 py-1 border border-white/10">
                  <span className="text-xs text-purple-300">Multi-Modal</span>
                </div>
                <div className="bg-white/5 rounded-lg px-3 py-1 border border-white/10">
                  <span className="text-xs text-blue-300">Real-Time Learning</span>
                </div>
              </div>
            </div>

            {/* Right: AI Architecture Visualization */}
            <div className="hidden lg:block">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <div className="text-white">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-400" />
                    AI Architecture Layers
                  </h3>

                  <div className="space-y-4">
                    <div className="relative bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-lg p-4 border border-blue-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-blue-300">Layer 1: Research AI</div>
                        <Target className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="text-xs text-gray-300">
                        Neural prospect matching, firmographic analysis, intent scoring
                      </div>
                      <div className="mt-2 flex gap-1">
                        <div className="h-1 bg-blue-500 rounded-full flex-1 animate-pulse"></div>
                        <div className="h-1 bg-blue-500 rounded-full flex-1 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-1 bg-blue-500 rounded-full flex-1 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>

                    <div className="relative bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-lg p-4 border border-indigo-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-indigo-300">Layer 2: Outreach AI</div>
                        <Zap className="h-4 w-4 text-indigo-400" />
                      </div>
                      <div className="text-xs text-gray-300">
                        Dynamic messaging, channel optimization, response prediction
                      </div>
                      <div className="mt-2 flex gap-1">
                        <div className="h-1 bg-indigo-500 rounded-full flex-1 animate-pulse"></div>
                        <div className="h-1 bg-indigo-500 rounded-full flex-1 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-1 bg-indigo-500 rounded-full flex-1 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>

                    <div className="relative bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg p-4 border border-purple-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-purple-300">Layer 3: Qualification AI</div>
                        <Brain className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="text-xs text-gray-300">
                        Conversation analysis, BANT scoring, meeting quality prediction
                      </div>
                      <div className="mt-2 flex gap-1">
                        <div className="h-1 bg-purple-500 rounded-full flex-1 animate-pulse"></div>
                        <div className="h-1 bg-purple-500 rounded-full flex-1 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-1 bg-purple-500 rounded-full flex-1 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30">
                    <div className="text-sm font-semibold text-blue-200 mb-1">Continuous Learning</div>
                    <div className="text-xs text-gray-300">
                      Each interaction improves the entire system. Real-time neural optimization across all layers.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="rgb(15 23 42)" />
          </svg>
        </div>
      </section>

      {/* Technology Dialog */}
      <Dialog open={showTechDialog} onOpenChange={setShowTechDialog}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-blue-600" />
              ACME CORP AI Architecture
            </DialogTitle>
            <DialogDescription>
              A deep dive into the three-tier neural architecture that powers ACME CORP's intelligence.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Research AI</h4>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Neural firmographic matching</li>
                  <li>• Intent signal detection</li>
                  <li>• Propensity scoring</li>
                </ul>
              </div>
              <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Outreach AI</h4>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Dynamic sequence generation</li>
                  <li>• Response pattern analysis</li>
                  <li>• Channel optimization</li>
                </ul>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-4">
                <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Qualification AI</h4>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Natural language understanding</li>
                  <li>• BANT scoring</li>
                  <li>• Quality prediction</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowTechDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowTechDialog(false);
                handlePrimaryCTA();
              }}
            >
              See It in Action
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}