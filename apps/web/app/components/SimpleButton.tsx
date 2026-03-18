/**
 * Simple Button Component
 * Basic button for DOM testing demonstration
 */

import { type ButtonHTMLAttributes } from 'react';

interface SimpleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

export function SimpleButton({
  variant = 'primary',
  children,
  className = '',
  ...props
}: SimpleButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-500 text-white hover:bg-gray-600',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  return (
    <button
      className={`px-4 py-2 rounded ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
