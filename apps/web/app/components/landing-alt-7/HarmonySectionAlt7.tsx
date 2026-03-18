import { Check, Bot, User } from 'lucide-react';

export function HarmonySectionAlt7() {
  return (
    <section className="py-32 bg-white dark:bg-stone-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-serif text-stone-900 dark:text-stone-50 mb-6">
            Perfect Harmony
          </h2>
          <p className="text-xl text-stone-500 max-w-2xl mx-auto">
            We don't replace humans. We replace the robotic parts of your job.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          
          {/* AI Column */}
          <div className="bg-stone-50 dark:bg-stone-900 rounded-3xl p-10 border border-stone-100 dark:border-stone-800">
            <div className="w-12 h-12 bg-stone-200 dark:bg-stone-800 rounded-2xl flex items-center justify-center mb-8">
              <Bot className="w-6 h-6 text-stone-600 dark:text-stone-400" />
            </div>
            <h3 className="text-2xl font-bold mb-6 text-stone-900 dark:text-stone-50">What AI Does Best</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Check className="w-5 h-5 text-stone-400" />
                <span>Reducing costs by 60%</span>
              </li>
              <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Check className="w-5 h-5 text-stone-400" />
                <span>Ensuring POPIA compliance</span>
              </li>
              <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Check className="w-5 h-5 text-stone-400" />
                <span>Booking meetings at 15% conversion</span>
              </li>
              <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Check className="w-5 h-5 text-stone-400" />
                <span>Generating R2M+ pipeline</span>
              </li>
            </ul>
          </div>

          {/* Human Column */}
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-3xl p-10 border border-amber-100 dark:border-amber-900/20">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-8">
              <User className="w-6 h-6 text-amber-700 dark:text-amber-500" />
            </div>
            <h3 className="text-2xl font-bold mb-6 text-stone-900 dark:text-stone-50">What You Do Best</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Check className="w-5 h-5 text-amber-600" />
                <span>Building trust and rapport</span>
              </li>
              <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Check className="w-5 h-5 text-amber-600" />
                <span>Understanding nuance</span>
              </li>
              <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Check className="w-5 h-5 text-amber-600" />
                <span>Solving complex problems</span>
              </li>
              <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Check className="w-5 h-5 text-amber-600" />
                <span>Closing the deal</span>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}
