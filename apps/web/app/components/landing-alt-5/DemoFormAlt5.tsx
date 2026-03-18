import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { trackEvent } from '~/lib/posthog';
import { ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export function DemoFormAlt5() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    trackEvent('form_submitted', {
      location: 'landing-alt-5',
      type: 'demo_request'
    });
    
    setIsSuccess(true);
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <section id="demo-form" className="py-32 bg-orange-600 flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-white p-8 max-w-2xl">
          <CheckCircle2 className="w-24 h-24 mx-auto mb-8 text-white animate-bounce" />
          <h3 className="text-5xl font-black mb-6">WELCOME TO THE FUTURE.</h3>
          <p className="text-xl font-medium opacity-90">
            Your strategy session is booked. Prepare to scale.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="demo-form" className="py-32 bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          <div>
            <h2 className="text-6xl font-black text-white mb-8 leading-none">
              READY TO <br />
              <span className="text-orange-500">DOMINATE?</span>
            </h2>
            <p className="text-xl text-gray-400 mb-12 max-w-md">
              Join the top 1% of revenue teams using AI to outpace, outsmart, and outsell the competition.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-gray-300">
                <div className="w-12 h-px bg-orange-500"></div>
                <span>Free ROI Analysis</span>
              </div>
              <div className="flex items-center gap-4 text-gray-300">
                <div className="w-12 h-px bg-orange-500"></div>
                <span>Custom Growth Strategy</span>
              </div>
              <div className="flex items-center gap-4 text-gray-300">
                <div className="w-12 h-px bg-orange-500"></div>
                <span>No Commitments</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 p-8 md:p-12 rounded-3xl backdrop-blur-sm hover:border-orange-500/30 transition-colors duration-500">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-gray-400">First Name</Label>
                  <Input 
                    id="firstName" 
                    required 
                    className="bg-black/50 border-zinc-800 text-white focus:border-orange-500 h-12"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-gray-400">Last Name</Label>
                  <Input 
                    id="lastName" 
                    required 
                    className="bg-black/50 border-zinc-800 text-white focus:border-orange-500 h-12"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-400">Work Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  className="bg-black/50 border-zinc-800 text-white focus:border-orange-500 h-12"
                  placeholder="john@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company" className="text-gray-400">Company</Label>
                <Input 
                  id="company" 
                  required 
                  className="bg-black/50 border-zinc-800 text-white focus:border-orange-500 h-12"
                  placeholder="Acme Inc."
                />
              </div>

              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-14 text-lg mt-4 rounded-xl"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Get Access
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
              
              <p className="text-xs text-center text-gray-600 pt-4">
                By clicking above, you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
