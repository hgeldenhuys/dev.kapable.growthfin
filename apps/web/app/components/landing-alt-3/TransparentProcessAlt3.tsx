import { CheckCircle2, Brain, Send, Handshake, Eye, Settings } from 'lucide-react';

export function TransparentProcessAlt3() {
  const steps = [
    {
      icon: Settings,
      title: 'Setup (Day 1)',
      description: 'We audit your current process, define your ICP in detail, and build 3-tier prospect research criteria. No access needed to start.',
      transparency: 'You get: Research criteria doc, ICP definition, messaging framework preview'
    },
    {
      icon: Brain,
      title: 'Research (Week 1-2)',
      description: 'AI identifies prospects matching your exact criteria. Human verification ensures quality. You see the list before we start outreach.',
      transparency: 'You get: Prospect list with research data, approval gate before outreach, sample messages'
    },
    {
      icon: Send,
      title: 'Outreach (Week 2-3)',
      description: 'Multi-channel sequences launch only after your approval. Every message is logged in your dashboard in real-time.',
      transparency: 'You get: Live dashboard access, message copies, response tracking, A/B test results'
    },
    {
      icon: Handshake,
      title: 'Qualification (Ongoing)',
      description: 'AI handles initial conversations using your qualification criteria. Only meetings meeting your standards get scheduled.',
      transparency: 'You get: Conversation transcripts, qualification scores, rejection reasons if any, calendar invites'
    },
    {
      icon: Eye,
      title: 'Review & Approve (Per Meeting)',
      description: 'Every qualified meeting appears in your dashboard. You review details, accept or reject. Only approved meetings are billed.',
      transparency: 'You get: Meeting details, prospect research summary, conversation context, accept/reject button'
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            Complete Transparency: How it Actually Works
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            No black box. No "proprietary algorithms." Here's the exact process, what we do, and what you see at every step.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-16">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="relative">
                {/* Step number */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-white font-black text-lg mb-3">
                      {idx + 1}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-950 dark:text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-700 dark:text-gray-400 text-sm leading-relaxed mb-4">
                  {step.description}
                </p>

                {/* Transparency detail */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border-l-4 border-purple-500">
                  <div className="text-xs text-purple-700 dark:text-purple-300 font-semibold mb-1">YOU GET:</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {step.transparency}
                  </div>
                </div>

                {/* Connection line */}
                {idx < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-7 -right-4 w-8 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-50"></div>
                )}
              </div>
            );
          })}
        </div>

        {/* The Guarantee box */}
        <div className="bg-white dark:bg-gray-900 border-2 border-purple-200 dark:border-purple-800 rounded-xl p-8 sm:p-12">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <CheckCircle2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-950 dark:text-white mb-3">
                The "No Surprises" Promise
              </h3>
              <p className="text-gray-700 dark:text-gray-400 text-lg leading-relaxed mb-4">
                At every stage, you have visibility and control. You'll never wonder "what's happening" or
                "where are my leads." You'll see exactly what's been done, what's working, and what's next.
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  Real-time dashboard access from day 1
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  Every message logged and visible
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  Approval gates before major actions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  Weekly performance reports with raw data
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  Direct Slack/email access to our team
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  No contractual lock-in or minimums
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
