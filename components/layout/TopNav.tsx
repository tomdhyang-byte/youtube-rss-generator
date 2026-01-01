'use client';

import { Link, usePathname } from '@/routing';
import { useSession } from 'next-auth/react';
import { UserMenu } from './UserMenu';
import { cn } from '@/lib/utils';
import { useQuota } from '@/components/providers/QuotaProvider';
import { useTranslations } from 'next-intl';

export function TopNav() {
    const pathname = usePathname();
    const { status } = useSession();
    const { quota, isLoading } = useQuota();
    const t = useTranslations('Navigation');

    const navItems = [
        { href: '/feed', label: t('dashboard') },
        { href: '/subscriptions', label: t('subscriptions') },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-5xl mx-auto flex h-14 items-center px-4">
                {/* Logo */}
                <Link href="/feed" className="mr-6 flex items-center space-x-2">
                    <span className="text-xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                        TubeSummary
                    </span>
                </Link>

                {/* Navigation Tabs */}
                <nav className="flex items-center space-x-1 flex-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                                pathname === item.href
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* Quota Badge */}
                {status === 'authenticated' && (
                    quota ? (
                        quota.tier === 'ADMIN' ? (
                            <div className="mr-3 px-3 py-1 rounded-full text-xs border bg-purple-600 text-white border-purple-500 font-bold">
                                {t('admin')} ∞
                            </div>
                        ) : quota.tier === 'PRO' ? (
                            <div className="mr-3 px-3 py-1 rounded-full text-xs border font-medium text-blue-400 bg-blue-900/20 border-blue-900/50">
                                Pro • {(quota.limit ?? 0) - quota.current} {t('left')}
                            </div>
                        ) : quota.tier === 'PLUS' ? (
                            <div className="mr-3 px-3 py-1 rounded-full text-xs border font-medium text-yellow-400 bg-yellow-900/20 border-yellow-900/50">
                                Plus • {(quota.limit ?? 0) - quota.current} {t('left')}
                            </div>
                        ) : (
                            <div className={cn(
                                "mr-3 px-3 py-1 rounded-full text-xs border font-medium",
                                quota.limit !== null && quota.current >= quota.limit
                                    ? "text-red-400 bg-red-900/20 border-red-900/50"
                                    : "text-green-400 bg-green-900/20 border-green-900/50"
                            )}>
                                {t('free_plan')} • {t('quota_remaining', { count: (quota.limit ?? 0) - quota.current })}
                            </div>
                        )
                    ) : isLoading ? (
                        // Only show loading placeholder if we have NO data yet (initial load)
                        <div className="mr-3 px-3 py-1 rounded-full text-xs border bg-gray-800 border-gray-700 min-w-[80px] text-center">
                            <span className="opacity-50 animate-pulse">• • •</span>
                        </div>
                    ) : null
                )}

                {/* User Menu (includes language switcher) */}
                <UserMenu />
            </div>
        </header>
    );
}
