'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    /** Error message to display */
    error?: string;
    /** Label for the input */
    label?: string;
    /** Helper text below the input */
    helperText?: string;
    /** Input size variant */
    inputSize?: 'sm' | 'md' | 'lg';
    /** Full width input */
    fullWidth?: boolean;
}

const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm h-9',
    md: 'px-4 py-2 text-sm h-10',
    lg: 'px-4 py-3 text-base h-12',
};

/**
 * Input Component
 * 
 * A styled input field with support for labels, errors, and helper text.
 * 
 * @example
 * <Input 
 *   label="Email" 
 *   placeholder="you@example.com" 
 *   error="Invalid email format"
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            error,
            label,
            helperText,
            inputSize = 'md',
            fullWidth = false,
            id,
            ...props
        },
        ref
    ) => {
        const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

        return (
            <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-sm font-medium text-foreground"
                    >
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={cn(
                        // Base styles
                        'rounded-lg border bg-background text-foreground placeholder:text-muted-foreground',
                        'transition-all outline-none',
                        // Focus styles
                        'focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30',
                        // Error styles
                        error
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                            : 'border-border',
                        // Disabled styles
                        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted',
                        // Size styles
                        sizeStyles[inputSize],
                        // Full width
                        fullWidth && 'w-full',
                        // Custom className
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                        ⚠️ {error}
                    </p>
                )}
                {helperText && !error && (
                    <p className="text-sm text-muted-foreground">
                        {helperText}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
