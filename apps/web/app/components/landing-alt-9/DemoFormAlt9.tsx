import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { trackEvent } from '~/lib/posthog';

export function DemoFormAlt9() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    trackEvent('form_submitted', { location: 'landing-alt-9', type: 'demo_request' });
    setIsSuccess(true);
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <section id="demo-form" className="py-32 text-center font-mono">
        <div className="text-[#64ffda] text-xl">
          {'>'} Request received.<br/>
          {'>'} Initializing sequence...<br/>
          {'>'} Check your terminal (inbox).
        </div>
      </section>
    );
  }

  return (
    <section id="demo-form" className="py-32 relative">
      <div className="container mx-auto px-4 max-w-xl">
        <div className="border border-[#64ffda] p-1">
          <div className="border border-[#64ffda] p-8 bg-[#112240]/50 backdrop-blur-sm">
            <div className="font-mono text-center mb-8">
              <h2 className="text-2xl text-white font-bold mb-2">INITIALIZE_ACCESS</h2>
              <p className="text-[#64ffda] text-sm">Enter credentials to proceed.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-mono text-[#64ffda] uppercase">User_Email</label>
                <input 
                  type="email" 
                  required 
                  className="w-full bg-[#0a192f] border border-[#233554] text-white p-3 font-mono focus:border-[#64ffda] focus:outline-none"
                  placeholder="admin@company.com"
                />
              </div>
              
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#64ffda] text-[#0a192f] hover:bg-[#64ffda]/80 font-mono font-bold h-12 rounded-none"
              >
                {isSubmitting ? '[ PROCESSING... ]' : '[ REQUEST_ACCESS ]'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
