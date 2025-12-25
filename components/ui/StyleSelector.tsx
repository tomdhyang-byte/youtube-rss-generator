'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SummaryStyle } from '@/lib/types/summary-style';

// Re-export for convenience
export type { SummaryStyle } from '@/lib/types/summary-style';

export interface SummaryStyleOption {
    value: SummaryStyle;
    label: string;
    emoji: string;
    description: string;
}

export const SUMMARY_STYLE_OPTIONS: SummaryStyleOption[] = [
    { value: 'DEFAULT', label: '深度筆記', emoji: '📚', description: '完整結構化摘要，適合學習' },
    { value: 'QUICK_READ', label: '省時速讀', emoji: '⚡', description: '精簡重點，30秒掌握結論' },
];

interface StyleSelectorProps {
    value: SummaryStyle;
    onChange: (value: SummaryStyle) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * StyleSelector Component
 * 
 * A dropdown for selecting summary style.
 */
export function StyleSelector({
    value,
    onChange,
    disabled = false,
    className,
}: StyleSelectorProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const selectedOption = SUMMARY_STYLE_OPTIONS.find(opt => opt.value === value) || SUMMARY_STYLE_OPTIONS[0];

    // Close dropdown when clicking outside
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: SummaryStyle) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} className={cn("relative", className)}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors",
                    "bg-card border-border",
                    "hover:border-primary/50",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <span>{selectedOption.emoji}</span>
                <span className="text-foreground">{selectedOption.label}</span>
                <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    isOpen && "transform rotate-180"
                )} />
            </button>

            {isOpen && (
                <div className={cn(
                    "absolute z-50 mt-1 w-64 rounded-lg border shadow-lg",
                    "bg-card border-border"
                )}>
                    {SUMMARY_STYLE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelect(option.value)}
                            className={cn(
                                "w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors",
                                "hover:bg-accent",
                                "first:rounded-t-lg last:rounded-b-lg",
                                option.value === value && "bg-primary/10"
                            )}
                        >
                            <span className="text-lg">{option.emoji}</span>
                            <div>
                                <div className={cn(
                                    "text-sm font-medium",
                                    option.value === value
                                        ? "text-primary"
                                        : "text-foreground"
                                )}>
                                    {option.label}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {option.description}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
