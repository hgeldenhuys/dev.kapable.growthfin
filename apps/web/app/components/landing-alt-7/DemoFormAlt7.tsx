import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { trackEvent } from '~/lib/posthog';
import { Send } from 'lucide-react';

export function DemoFormAlt7() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    trackEvent('form_submitted', { location: 'landing-alt-7', type: 'demo_request' });
    setIsSuccess(true);
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <section id="demo-form" className="py-32 bg-amber-50 dark:bg-amber-950/20">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Send className="w-8 h-8 text-amber-700 dark:text-amber-500" />
          </div>
          <h3 className="text-3xl font-serif mb-4 text-stone-900 dark:text-stone-50">Let's Chat.</h3>
          <p className="text-stone-600 dark:text-stone-400 text-lg">
            We've received your request. A real human (not a bot) will reach out shortly to understand your needs.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="demo-form" className="py-32 bg-stone-100 dark:bg-stone-900">
      <div className="container mx-auto px-4">
        <div className="bg-white dark:bg-stone-950 rounded-[2rem] shadow-xl p-8 md:p-16 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-serif text-stone-900 dark:text-stone-50 mb-4">
              Start a Conversation
            </h2>
            <p className="text-stone-500 text-lg">
              No pressure. No aggressive tactics. Just a chat about how we can help you reclaim your time.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
            <div className="grid grid-cols-2 gap-6">
              <Input 
                placeholder="First Name" 
                required
                className="h-14 rounded-2xl bg-stone-50 border-stone-200 dark:bg-stone-900 dark:border-stone-800 px-6 text-lg focus:ring-amber-500" 
              />
              <Input 
                placeholder="Last Name" 
                required
                className="h-14 rounded-2xl bg-stone-50 border-stone-200 dark:bg-stone-900 dark:border-stone-800 px-6 text-lg focus:ring-amber-500" 
              />
            </div>
            
            <Input 
              type="email"
              placeholder="Work Email" 
              required
              className="h-14 rounded-2xl bg-stone-50 border-stone-200 dark:bg-stone-900 dark:border-stone-800 px-6 text-lg focus:ring-amber-500" 
            />
            
            <Input 
              placeholder="Company Name" 
              required
              className="h-14 rounded-2xl bg-stone-50 border-stone-200 dark:bg-stone-900 dark:border-stone-800 px-6 text-lg focus:ring-amber-500" 
            />

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full h-14 rounded-2xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-900 text-lg font-medium transition-all hover:scale-[1.02]"
            >
              {isSubmitting ? 'Sending...' : 'Request a Consultation'}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
