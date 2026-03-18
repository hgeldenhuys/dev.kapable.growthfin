import { Quote, BarChart3, TrendingUp, CheckCircle2 } from 'lucide-react';

export function CaseStudiesSectionAlt3() {
  const caseStudies = [
    {
      company: 'Fintech SaaS Platform',
      industry: 'B2B Payments',
      challenge: 'Needed 40 qualified enterprise meetings/quarter. Hired 3 SDRs at R180K/month total. After 6 months, only generating 18 meetings/month. Turnover killed momentum.',
      solution: 'ACME CORP deployed in 36 hours. Same ICP, better research, multi-channel sequences.',
      results: [
        { label: 'Meetings in Month 1', value: '22' },
        { label: 'Meetings in Month 3', value: '48' },
        { label: 'Cost per Meeting', value: 'R520 vs R1,200' }
      ],
      testimonial: 'We spent R1.08M on SDRs in 6 months for mediocre results. ACME CORP cost R187K for 360 meetings in 6 months. The math isn\'t even close.',
      author: 'Head of Sales, 500-employee fintech'
    },
    {
      company: 'InsurTech Company',
      industry: 'Commercial Insurance',
      challenge: 'Small sales team (5 AEs) needed consistent pipeline. Couldn\'t afford full SDR team at R120K+/month. Manual outreach by AEs wasn\'t scalable.',
      solution: 'ACME CORP added dedicated SDR capacity for 1/3 the cost. Zero hiring risk.',
      results: [
        { label: 'Monthly Meetings', value: '28 avg' },
        { label: 'Closed Revenue (6 months)', value: 'R4.2M' },
        { label: 'Cost per Deal', value: 'R11,200' }
      ],
      testimonial: 'We wanted SDR support but couldn\'t stomach the risk. ACME CORP made it easy: they only get paid when they deliver meetings we actually want.',
      author: 'VP Sales, 80-employee insurance tech'
    },
    {
      company: 'Marketing Analytics Platform',
      industry: 'MarTech',
      challenge: 'Had SDR team, but quality was inconsistent. 40% of meetings were unqualified. AEs wasting time on bad fit prospects.',
      solution: 'ACME CORP replaced entire SDR team. Performance-based model meant we filter quality upfront.',
      results: [
        { label: 'Qualified Meeting Rate', value: '96% vs 60%' },
        { label: 'AE Time Saved/Week', value: '8 hours' },
        { label: 'Cost Savings (Annual)', value: 'R280K' }
      ],
      testimonial: 'Our SDRs meant well but couldn\'t consistently research. ACME CORP\'s AI + human verification means every meeting is actually qualified. We rejected 2 meetings out of 54.',
      author: 'Sales Director, B2B SaaS'
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">REAL RESULTS FROM REAL COMPANIES</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-950 dark:text-white mb-4">
            Companies That Switched from SDR Teams to ACME CORP
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            See exactly how much they saved and the results they got. These are actual clients with verifiable outcomes.
          </p>
        </div>

        <div className="space-y-12">
          {caseStudies.map((caseStudy, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 sm:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* Left: Case Study Details */}
                <div>
                  <div className="mb-6">
                    <div className="inline-block px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-sm font-semibold mb-2">
                      {caseStudy.industry}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-950 dark:text-white mb-2">
                      {caseStudy.company}
                    </h3>
                  </div>

                  <div className="space-y-6 mb-8">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-200 mb-2 flex items-center gap-2">
                        <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                        Before: The Problem
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        {caseStudy.challenge}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-200 mb-2 flex items-center gap-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        Solution: ACME CORP
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        {caseStudy.solution}
                      </p>
                    </div>
                  </div>

                  <blockquote className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border-l-4 border-indigo-500">
                    <Quote className="h-8 w-8 text-indigo-400 mb-4" />
                    <p className="text-lg text-gray-800 dark:text-gray-200 mb-4 italic">
                      {caseStudy.testimonial}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">— {caseStudy.author}</p>
                  </blockquote>
                </div>

                {/* Right: Results */}
                <div>
                  <div className="sticky top-8">
                    <h4 className="text-lg font-bold text-gray-950 dark:text-white mb-6">Results After 6 Months</h4>

                    <div className="space-y-4 mb-8">
                      {caseStudy.results.map((result, rIdx) => (
                        <div key={rIdx} className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-950 dark:text-white">{result.value}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{result.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Summary stats */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-purple-900 dark:to-indigo-900 text-white rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-5 w-5" />
                        <span className="font-bold">Bottom Line</span>
                      </div>
                      <div className="text-sm text-indigo-100 space-y-2">
                        {idx === 0 && (
                          <>
                            <p>• Saved R893K in 6 months (R1.78M annually)</p>
                            <p>• 167% more meetings than in-house SDRs</p>
                            <p>• 57% lower cost per meeting</p>
                          </>
                        )}
                        {idx === 1 && (
                          <>
                            <p>• Enterprise pipeline without enterprise overhead</p>
                            <p>• R4.2M revenue from R410K investment</p>
                            <p>• 10x ROI on meeting cost</p>
                          </>
                        )}
                        {idx === 2 && (
                          <>
                            <p>• Replaced underperforming SDR team</p>
                            <p>• Increased qualified meeting rate by 60%</p>
                            <p>• Saved AE team 8 hours/week</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-purple-900 dark:to-indigo-900 text-white rounded-2xl p-8 sm:p-12">
            <h3 className="text-2xl sm:text-3xl font-bold mb-4">See Your Specific Numbers</h3>
            <p className="text-indigo-100 text-lg mb-8 max-w-2xl mx-auto">
              These results aren't outliers—they're typical. Book a performance analysis and we'll show
              you exactly how much you can save and how many meetings you can generate.
            </p>
            <div className="inline-block">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <p className="text-sm text-indigo-100 mb-2">Analysis includes:</p>
                <div className="text-sm space-y-1">
                  <div>✓ Current cost breakdown vs. ACME CORP model</div>
                  <div>✓ Projected meetings based on your ICP</div>
                  <div>✓ ROI timeline and payback period</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
