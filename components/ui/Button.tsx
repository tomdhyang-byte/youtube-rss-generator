'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Button style variant */
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
    /** Button size */
    size?: 'sm' | 'md' | 'lg';
    /** Show loading spinner */
    loading?: boolean;
    /** Make button full width */
    fullWidth?: boolean;
    /** Icon to show before text */
    leftIcon?: React.ReactNode;
    /** Icon to show after text */
    rightIcon?: React.ReactNode;
}

const variantStyles = {
    primary: 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm',
    secondary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl',
    ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
    danger: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20',
    outline: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
};

const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-sm',
};

/**
 * Button Component
 * 
 * A versatile button component with multiple variants and sizes.
 * 
 * @example
 * <Button variant="primary" size="lg">Click me</Button>
 * <Button variant="ghost" leftIcon={<Settings />}>Settings</Button>
 * <Button loading>Saving...</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = 'primary',
            size = 'md',
            loading = false,
            fullWidth = false,
            leftIcon,
            rightIcon,
            disabled,
            children,
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                className={cn(
                    // Base styles
                    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors',
                    // Focus styles
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500/50',
                    // Disabled styles
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    // Variant styles
                    variantStyles[variant],
                    // Size styles
                    sizeStyles[size],
                    // Full width
                    fullWidth && 'w-full',
                    // Custom className
                    className
                )}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : leftIcon ? (
                    leftIcon
                ) : null}
                {children}
                {!loading && rightIcon}
            </button>
        );
    }
);

Button.displayName = 'Button';
