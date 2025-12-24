'use client';

import { cn } from '@/lib/utils';

export interface BadgeProps {
    /** Badge style variant */
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'youtube' | 'podcast';
    /** Badge size */
    size?: 'sm' | 'md';
    /** Badge content */
    children: React.ReactNode;
    /** Additional class names */
    className?: string;
}

const variantStyles = {
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    warning: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    youtube: 'bg-red-500/10 text-red-500 border-red-500/20',
    podcast: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
};

/**
 * Badge Component
 * 
 * A small label component for displaying status, categories, or tags.
 * 
 * @example
 * <Badge variant="youtube">YouTube</Badge>
 * <Badge variant="success" size="sm">Active</Badge>
 */
export function Badge({
    variant = 'default',
    size = 'sm',
    children,
    className,
}: BadgeProps) {
    return (
        <span
            className={cn(
                // Base styles
                'inline-flex items-center font-medium rounded border',
                // Variant styles
                variantStyles[variant],
                // Size styles
                sizeStyles[size],
                // Custom className
                className
            )}
        >
            {children}
        </span>
    );
}
