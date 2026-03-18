import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { trackEvent } from '~/lib/posthog';

const demoFormSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  company: z.string().min(2, 'Company name is required'),
  monthlyLeadVolume: z.enum(['0-500', '500-2000', '2000-10000', '10000+'], {
    required_error: 'Please select your monthly lead volume'
  })
});

type DemoFormData = z.infer<typeof demoFormSchema>;

export function DemoFormSection() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<DemoFormData>({
    resolver: zodResolver(demoFormSchema)
  });

  const monthlyLeadVolume = watch('monthlyLeadVolume');

  const onSubmit = async (data: DemoFormData) => {
    setIsSubmitting(true);

    trackEvent('form_submitted', {
      form_id: 'demo_request',
      lead_volume: data.monthlyLeadVolume,
      test_variant: 'control',
      email: data.email,
      company: data.company
    });

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // TODO: Replace with actual API call to backend
    // await fetch('/api/demo-requests', { method: 'POST', body: JSON.stringify(data) });

    setIsSubmitting(false);
    setIsSuccess(true);

    // Reset form after 5 seconds
    setTimeout(() => {
      setIsSuccess(false);
    }, 5000);
  };

  const handleFormStart = () => {
    trackEvent('form_started', {
      form_id: 'demo_request'
    });
  };

  if (isSuccess) {
    return (
      <section id="demo-form" className="py-20 sm:py-32 bg-gradient-to-br from-growthfin-primary to-growthfin-secondary dark:bg-gray-900">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <Card className="border-0 shadow-2xl dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-growthfin-success flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-growthfin-dark dark:text-white mb-4">
                Thank You!
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                We've received your request. Our team will reach out within 24 hours to schedule your strategy call.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="demo-form" className="py-20 sm:py-32 bg-gradient-to-br from-growthfin-primary to-growthfin-secondary dark:bg-gray-900">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <Card className="border-0 shadow-2xl dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl sm:text-4xl font-bold text-growthfin-dark dark:text-white">
              Book Your Strategy Call
            </CardTitle>
            <CardDescription className="text-base dark:text-gray-300">
              Let's discuss how ACME CORP can 10x your outbound sales
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" onFocus={handleFormStart}>
              {/* First Name */}
              <div>
                <Label htmlFor="firstName" className="dark:text-gray-200">First Name *</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  placeholder="John"
                  className="mt-1"
                />
                {errors.firstName && (
                  <p className="text-sm text-red-600 mt-1">{errors.firstName.message}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <Label htmlFor="lastName" className="dark:text-gray-200">Last Name *</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  placeholder="Doe"
                  className="mt-1"
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600 mt-1">{errors.lastName.message}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email" className="dark:text-gray-200">Work Email *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="john@company.com"
                  className="mt-1"
                />
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Company */}
              <div>
                <Label htmlFor="company" className="dark:text-gray-200">Company Name *</Label>
                <Input
                  id="company"
                  {...register('company')}
                  placeholder="Acme Corp"
                  className="mt-1"
                />
                {errors.company && (
                  <p className="text-sm text-red-600 mt-1">{errors.company.message}</p>
                )}
              </div>

              {/* Monthly Lead Volume */}
              <div>
                <Label htmlFor="monthlyLeadVolume" className="dark:text-gray-200">Monthly Lead Volume *</Label>
                <Select
                  value={monthlyLeadVolume}
                  onValueChange={(value) => setValue('monthlyLeadVolume', value as any)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select your lead volume" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-500">0-500 leads/month</SelectItem>
                    <SelectItem value="500-2000">500-2,000 leads/month</SelectItem>
                    <SelectItem value="2000-10000">2,000-10,000 leads/month</SelectItem>
                    <SelectItem value="10000+">10,000+ leads/month</SelectItem>
                  </SelectContent>
                </Select>
                {errors.monthlyLeadVolume && (
                  <p className="text-sm text-red-600 mt-1">{errors.monthlyLeadVolume.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-growthfin-primary to-growthfin-secondary hover:opacity-90 text-white font-semibold py-6 text-lg min-h-[44px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Book My Strategy Call'
                )}
              </Button>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                By submitting this form, you agree to our Privacy Policy and Terms of Service.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
