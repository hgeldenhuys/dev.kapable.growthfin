import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { trackEvent } from '~/lib/posthog';

export function DemoFormAlt6() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    trackEvent('form_submitted', { location: 'landing-alt-6', type: 'demo_request' });
    setIsSuccess(true);
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <section id="demo-form" className="py-32 bg-zinc-50 dark:bg-zinc-900/30 text-center">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-light tracking-tight mb-4">Received.</h3>
          <p className="text-zinc-500">We will be in touch shortly.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="demo-form" className="py-32 bg-zinc-50 dark:bg-zinc-900/30">
      <div className="container mx-auto px-4 max-w-xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-medium tracking-tight mb-4">Start Your Evaluation</h2>
          <p className="text-zinc-500">Enter your work email to begin.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-0">
          <input
            type="email"
            required
            placeholder="email@company.com"
            className="w-full bg-transparent border-b border-zinc-300 dark:border-zinc-700 px-0 py-4 text-xl focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
          />
          
          <div className="pt-8">
             <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-none h-14 text-base tracking-wide"
            >
              {isSubmitting ? 'Processing...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
