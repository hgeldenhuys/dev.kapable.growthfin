/**
 * Contact Lifecycle Stage Badge Component
 * Color-coded badge for contact lifecycle stage
 */

import { Badge } from '~/components/ui/badge';

interface ContactLifecycleBadgeProps {
  lifecycleStage: 'raw' | 'verified' | 'engaged' | 'customer';
  className?: string;
}

export function ContactLifecycleBadge({ lifecycleStage, className }: ContactLifecycleBadgeProps) {
  const variants = {
    raw: { label: 'Raw', variant: 'secondary' as const },
    verified: { label: 'Verified', variant: 'default' as const },
    engaged: { label: 'Engaged', variant: 'default' as const },
    customer: { label: 'Customer', variant: 'default' as const },
  };

  const config = variants[lifecycleStage] || variants.raw;

  const customColors = {
    raw: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    verified: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    engaged: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    customer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  };

  return (
    <Badge className={`${customColors[lifecycleStage]} ${className || ''}`}>
      {config.label}
    </Badge>
  );
}
