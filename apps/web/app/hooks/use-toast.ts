/**
 * Toast Hook - Wrapper around sonner
 */

import { toast as sonnerToast } from 'sonner';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

export function useToast() {
  const toast = ({ title, description, variant = 'default', duration }: ToastOptions) => {
    const message = description ? `${title}\n${description}` : title;

    if (variant === 'destructive') {
      sonnerToast.error(title, {
        description,
        duration: duration || 5000,
      });
    } else {
      sonnerToast.success(title, {
        description,
        duration: duration || 3000,
      });
    }
  };

  return { toast };
}
