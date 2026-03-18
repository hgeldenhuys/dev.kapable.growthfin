import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { trackEvent } from '~/lib/posthog';

const demoFormSchema = z.object({
  firstName: z.string().min(2, 'First name required'),
  lastName: z.string().min(2, 'Last name required'),
  email: z.string().email('Valid email required'),
  company: z.string().min(2, 'Company name required'),
  monthlyLeadVolume: z.enum(['0-500', '500-2000', '2000-10000', '10000+'])
});

type DemoFormData = z.infer<typeof demoFormSchema>;

export function DemoFormAlt1() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<DemoFormData>({
    resolver: zodResolver(demoFormSchema)
  });

  const monthlyLeadVolume = watch('monthlyLeadVolume');

  const onSubmit = async (data: DemoFormData) => {
    setIsSubmitting(true);
    trackEvent('form_submitted', { form_id: 'demo_request', lead_volume: data.monthlyLeadVolume, test_variant: 'alt-1' });

    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 5000);
  };

  if (isSuccess) {
    return (
      <section id="demo-form" className="py-20 sm:py-32 bg-green-50 dark:bg-green-900/20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <Card className="border-0 shadow-2xl bg-white dark:bg-gray-800">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Perfect!</h3>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                We'll analyze your specific situation and send you a personalized ROI report within 24 hours.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
                Look for an email from our sales team with your custom ROI analysis and next steps.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="demo-form" className="py-20 sm:py-32 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <Card className="border-0 shadow-2xl dark:bg-gray-800">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              Get Your Free ROI Analysis
            </CardTitle>
            <CardDescription className="text-base dark:text-gray-300">
              See exactly how much you could save and earn. Takes 2 minutes.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="dark:text-gray-200">First Name *</Label>
                  <Input id="firstName" {...register('firstName')} placeholder="Sarah" className="mt-1" />
                  {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName.message}</p>}
                </div>

                <div>
                  <Label htmlFor="lastName" className="dark:text-gray-200">Last Name *</Label>
                  <Input id="lastName" {...register('lastName')} placeholder="Chen" className="mt-1" />
                  {errors.lastName && <p className="text-sm text-red-600 mt-1">{errors.lastName.message}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="dark:text-gray-200">Work Email *</Label>
                <Input id="email" type="email" {...register('email')} placeholder="sarah@company.com" className="mt-1" />
                {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <Label htmlFor="company" className="dark:text-gray-200">Company Name *</Label>
                <Input id="company" {...register('company')} placeholder="TechCorp" className="mt-1" />
                {errors.company && <p className="text-sm text-red-600 mt-1">{errors.company.message}</p>}
              </div>

              <div>
                <Label htmlFor="leadVolume" className="dark:text-gray-200">Monthly Lead Volume *</Label>
                <Select value={monthlyLeadVolume || ''} onValueChange={(value) => setValue('monthlyLeadVolume', value as any)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-500">0-500 leads</SelectItem>
                    <SelectItem value="500-2000">500-2,000 leads</SelectItem>
                    <SelectItem value="2000-10000">2,000-10,000 leads</SelectItem>
                    <SelectItem value="10000+">10,000+ leads</SelectItem>
                  </SelectContent>
                </Select>
                {errors.monthlyLeadVolume && <p className="text-sm text-red-600 mt-1">{errors.monthlyLeadVolume.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 text-lg min-h-[44px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  'Send Me My ROI Analysis'
                )}
              </Button>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                By submitting this form, you agree to our Privacy Policy. We'll send you a personalized ROI report.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
