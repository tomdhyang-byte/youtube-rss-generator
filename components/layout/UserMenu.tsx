'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { useState, useRef, useEffect, useTransition } from 'react';
import { LogIn, LogOut, ChevronDown, RefreshCw, Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslations, useLocale } from 'next-intl';
import { useQuota } from '@/components/providers/QuotaProvider';
import { usePathname, useRouter } from '@/routing';

const LANGUAGE_OPTIONS = [
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'zh-TW', label: '中文 (繁體)', flag: '🇹🇼' },
];

export function UserMenu() {
    const { data: session, status } = useSession();
    const { quota } = useQuota();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // ✅ All hooks MUST be called before any conditional returns
    const t = useTranslations('Navigation');
    const tCommon = useTranslations('Common');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleLanguageChange = (nextLocale: string) => {
        if (nextLocale !== locale) {
            startTransition(() => {
                router.replace(pathname, { locale: nextLocale });
            });
        }
        setIsOpen(false);
    };

    if (status === 'loading') {
        return (
            <Button variant="ghost" disabled loading>
                {tCommon('loading')}
            </Button>
        );
    }

    if (session) {
        return (
            <div className="relative" ref={menuRef}>
                {/* User Avatar + Name + Dropdown Trigger */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    {session.user?.image && (
                        <img
                            src={session.user.image}
                            alt={session.user.name || 'User'}
                            className="w-8 h-8 rounded-full ring-2 ring-gray-200 dark:ring-gray-700"
                        />
                    )}
                    <div className="hidden sm:block text-left">
                        <p className="text-sm font-medium">{session.user?.name}</p>
                        {quota?.isAdmin && (
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                {t('admin')}
                            </span>
                        )}
                    </div>
                    <ChevronDown
                        className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''
                            }`}
                    />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-50">
                        <div className="py-1">
                            {/* Switch Account */}
                            <button
                                onClick={async () => {
                                    setIsOpen(false);
                                    await signOut({ redirect: false });
                                    signIn('google', undefined, { prompt: 'select_account' });
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                {t('switch_account')}
                            </button>

                            {/* Divider */}
                            <div className="my-1 h-px bg-gray-200 dark:bg-slate-700" />

                            {/* Language Section */}
                            <div className="px-4 py-2">
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                    <Globe className="w-3 h-3" />
                                    {t('language')}
                                </div>
                                <div className="space-y-1">
                                    {LANGUAGE_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleLanguageChange(option.value)}
                                            disabled={isPending}
                                            className="flex w-full items-center justify-between px-3 py-1.5 text-sm rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span>{option.flag}</span>
                                                <span>{option.label}</span>
                                            </span>
                                            {locale === option.value && (
                                                <Check className="w-4 h-4 text-green-500" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="my-1 h-px bg-gray-200 dark:bg-slate-700" />

                            {/* Sign Out */}
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    signOut();
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                {t('sign_out')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Not signed in - show sign in button
    return (
        <Button
            variant="secondary"
            size="lg"
            onClick={() => signIn('google')}
            leftIcon={<LogIn className="w-5 h-5" />}
            className="hidden md:inline-flex"
        >
            {tCommon('sign_in_google')}
        </Button>
    );
}
