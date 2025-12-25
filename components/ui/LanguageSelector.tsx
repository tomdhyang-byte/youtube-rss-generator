'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SummaryLanguage } from '@/lib/types/summary-language';
import { useTranslations } from 'next-intl';

// Re-export for convenience
export type { SummaryLanguage } from '@/lib/types/summary-language';

export interface SummaryLanguageOption {
    value: SummaryLanguage;
    labelKey: string;
    emoji: string;
    descriptionKey: string;
}

// Options with translation keys instead of hardcoded text
const SUMMARY_LANGUAGE_OPTIONS: SummaryLanguageOption[] = [
    { value: 'EN', labelKey: 'language_en', emoji: '🇺🇸', descriptionKey: 'language_en_desc' },
    { value: 'ZH_TW', labelKey: 'language_zh', emoji: '🇹🇼', descriptionKey: 'language_zh_desc' },
];

interface LanguageSelectorProps {
    value: SummaryLanguage;
    onChange: (value: SummaryLanguage) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * LanguageSelector Component
 * 
 * A dropdown for selecting summary language.
 */
export function LanguageSelector({
    value,
    onChange,
    disabled = false,
    className,
}: LanguageSelectorProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const t = useTranslations('Subscriptions');

    const selectedOption = SUMMARY_LANGUAGE_OPTIONS.find(opt => opt.value === value) || SUMMARY_LANGUAGE_OPTIONS[0];

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

    const handleSelect = (optionValue: SummaryLanguage) => {
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
                <span className="text-foreground">{t(selectedOption.labelKey)}</span>
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
                    {SUMMARY_LANGUAGE_OPTIONS.map((option) => (
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
                                    {t(option.labelKey)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t(option.descriptionKey)}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
