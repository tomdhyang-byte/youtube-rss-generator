'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Button style variant */
    variant?: 'default' | 'danger' | 'warning' | 'muted';
    /** Button size */
    size?: 'sm' | 'md' | 'lg';
    /** Accessible label for the button */
    'aria-label': string;
}

const variantStyles = {
    default: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
    danger: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950',
    warning: 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950',
    muted: 'text-muted-foreground hover:text-foreground hover:bg-accent',
};

const sizeStyles = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
};

/**
 * IconButton Component
 * 
 * A button specifically designed for icon-only interactions.
 * Requires an aria-label for accessibility.
 * 
 * @example
 * <IconButton aria-label="Delete" variant="danger" onClick={handleDelete}>
 *   <Trash2 className="w-5 h-5" />
 * </IconButton>
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    (
        {
            className,
            variant = 'default',
            size = 'md',
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
                    'inline-flex items-center justify-center rounded-lg transition-colors',
                    // Focus styles
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500/50',
                    // Disabled styles
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    // Variant styles
                    variantStyles[variant],
                    // Size styles
                    sizeStyles[size],
                    // Custom className
                    className
                )}
                disabled={disabled}
                {...props}
            >
                {children}
            </button>
        );
    }
);

IconButton.displayName = 'IconButton';
