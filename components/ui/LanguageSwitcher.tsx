'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/routing';
import { cn } from '@/lib/utils';
import { Globe, ChevronDown } from 'lucide-react';

interface LanguageOption {
    value: string;
    label: string;
    flag: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'zh-TW', label: '中文 (繁體)', flag: '🇹🇼' },
];

export default function LanguageSwitcher({ className }: { className?: string }) {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = React.useTransition();
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const selectedOption = LANGUAGE_OPTIONS.find(opt => opt.value === locale) || LANGUAGE_OPTIONS[0];

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

    const handleSelect = (nextLocale: string) => {
        setIsOpen(false);
        if (nextLocale !== locale) {
            startTransition(() => {
                router.replace(pathname, { locale: nextLocale });
            });
        }
    };

    return (
        <div ref={dropdownRef} className={cn("relative", className)}>
            <button
                type="button"
                onClick={() => !isPending && setIsOpen(!isOpen)}
                disabled={isPending}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors",
                    "bg-card border-border",
                    "hover:border-primary/50",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                    isPending && "opacity-50 cursor-not-allowed"
                )}
            >
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{selectedOption.flag} {selectedOption.label}</span>
                <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    isOpen && "transform rotate-180"
                )} />
            </button>

            {isOpen && (
                <div className={cn(
                    "absolute z-50 mt-1 right-0 w-44 rounded-lg border shadow-lg",
                    "bg-card border-border"
                )}>
                    {LANGUAGE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelect(option.value)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                                "hover:bg-accent",
                                "first:rounded-t-lg last:rounded-b-lg",
                                option.value === locale && "bg-primary/10"
                            )}
                        >
                            <span className="text-lg">{option.flag}</span>
                            <span className={cn(
                                "text-sm font-medium",
                                option.value === locale
                                    ? "text-primary"
                                    : "text-foreground"
                            )}>
                                {option.label}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
