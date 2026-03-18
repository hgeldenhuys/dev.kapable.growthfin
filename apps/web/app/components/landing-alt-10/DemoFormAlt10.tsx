import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { trackEvent } from '~/lib/posthog';

export function DemoFormAlt10() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    trackEvent('form_submitted', { location: 'landing-alt-10', type: 'demo_request' });
    setIsSuccess(true);
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <section id="demo-form" className="py-32 bg-black text-white text-center">
        <h2 className="text-5xl font-black">GOOD CHOICE.</h2>
        <p className="text-xl font-mono mt-4">We'll be in touch.</p>
      </section>
    );
  }

  return (
    <section id="demo-form" className="py-20 bg-[#FFD6F8]">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white border-[5px] border-black p-10 shadow-[15px_15px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-4xl font-black mb-8 uppercase">
            Fire your agency. <br/>
            Hire ACME CORP.
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="font-black text-xl uppercase">Email Address</label>
              <input 
                type="email" 
                required 
                className="w-full h-16 border-[4px] border-black bg-[#E0E7F1] px-4 text-xl font-bold focus:outline-none focus:bg-white"
              />
            </div>
            
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 bg-black text-white hover:bg-gray-900 font-black text-2xl border-[4px] border-black rounded-none"
            >
              {isSubmitting ? 'WAIT...' : 'GET STARTED'}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
