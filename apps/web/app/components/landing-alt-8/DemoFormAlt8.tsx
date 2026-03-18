import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { trackEvent } from '~/lib/posthog';

export function DemoFormAlt8() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // Fast!
    trackEvent('form_submitted', { location: 'landing-alt-8', type: 'demo_request' });
    setIsSuccess(true);
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <section id="demo-form" className="py-32 bg-yellow-400 flex items-center justify-center text-center">
        <div>
          <h2 className="text-6xl font-black italic mb-4">DONE.</h2>
          <p className="text-xl font-bold">Check your inbox. We move fast.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="demo-form" className="py-32 bg-yellow-400">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-black p-8 md:p-12 transform rotate-1 hover:rotate-0 transition-transform duration-300 shadow-[20px_20px_0px_0px_rgba(255,255,255,1)]">
          <h2 className="text-4xl md:text-5xl font-black italic text-white mb-8 tracking-tighter">
            GO FASTER.
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              type="email" 
              required 
              placeholder="WORK EMAIL" 
              className="w-full h-16 bg-white text-black px-6 text-xl font-bold placeholder:text-black/30 focus:outline-none focus:ring-4 focus:ring-yellow-400 uppercase"
            />
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xl uppercase rounded-none"
            >
              {isSubmitting ? 'Processing...' : 'Get Access Now'}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
