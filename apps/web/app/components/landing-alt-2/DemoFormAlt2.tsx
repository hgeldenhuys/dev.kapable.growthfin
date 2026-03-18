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

export function DemoFormAlt2() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<DemoFormData>({
    resolver: zodResolver(demoFormSchema)
  });

  const monthlyLeadVolume = watch('monthlyLeadVolume');

  const onSubmit = async (data: DemoFormData) => {
    setIsSubmitting(true);
    trackEvent('form_submitted', {
      form_id: 'demo_request',
      lead_volume: data.monthlyLeadVolume,
      test_variant: 'alt-2',
      email: data.email,
      company: data.company
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 5000);
  };

  if (isSuccess) {
    return (
      <section id="demo-form" className="py-20 sm:py-32 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <Card className="border-2 border-emerald-200 dark:border-emerald-800 shadow-xl bg-white dark:bg-gray-900">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-gray-950 dark:text-white mb-4">Perfect!</h3>
              <p className="text-lg text-gray-700 dark:text-gray-300">
                We've received your request. Our team will reach out within 24 hours to schedule your strategy call.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
                Check your email for next steps.
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
        <Card className="border border-gray-200 dark:border-gray-800 shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
          <CardHeader className="text-center border-b border-gray-200 dark:border-gray-800">
            <CardTitle className="text-3xl sm:text-4xl font-black text-gray-950 dark:text-white">
              Book Your Strategy Call
            </CardTitle>
            <CardDescription className="text-base dark:text-gray-400">
              Let's discuss how ACME CORP can 10x your outbound sales
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="dark:text-gray-200 font-semibold">First Name *</Label>
                  <Input id="firstName" {...register('firstName')} placeholder="John" className="mt-2" />
                  {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName.message}</p>}
                </div>

                <div>
                  <Label htmlFor="lastName" className="dark:text-gray-200 font-semibold">Last Name *</Label>
                  <Input id="lastName" {...register('lastName')} placeholder="Doe" className="mt-2" />
                  {errors.lastName && <p className="text-sm text-red-600 mt-1">{errors.lastName.message}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="dark:text-gray-200 font-semibold">Work Email *</Label>
                <Input id="email" type="email" {...register('email')} placeholder="john@company.com" className="mt-2" />
                {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <Label htmlFor="company" className="dark:text-gray-200 font-semibold">Company Name *</Label>
                <Input id="company" {...register('company')} placeholder="Acme Corp" className="mt-2" />
                {errors.company && <p className="text-sm text-red-600 mt-1">{errors.company.message}</p>}
              </div>

              <div>
                <Label htmlFor="leadVolume" className="dark:text-gray-200 font-semibold">Monthly Lead Volume *</Label>
                <Select value={monthlyLeadVolume || ''} onValueChange={(value) => setValue('monthlyLeadVolume', value as any)}>
                  <SelectTrigger className="mt-2">
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
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 dark:from-teal-500 dark:to-emerald-500 dark:hover:from-teal-600 dark:hover:to-emerald-600 text-white font-black py-6 text-lg min-h-[44px]"
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
