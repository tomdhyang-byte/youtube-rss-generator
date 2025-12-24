'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { UserMenu } from './UserMenu';
import { cn } from '@/lib/utils';

interface Quota {
    current: number;
    limit: number;
    isAdmin: boolean;
}

export function TopNav() {
    const pathname = usePathname();
    const { status } = useSession();
    const [quota, setQuota] = useState<Quota | null>(null);

    // Fetch quota when authenticated
    useEffect(() => {
        if (status === 'authenticated') {
            fetch('/api/subscriptions')
                .then(res => res.json())
                .then(data => {
                    if (data.quota) {
                        setQuota(data.quota);
                    }
                })
                .catch(err => console.error('Failed to fetch quota:', err));
        }
    }, [status]);

    const navItems = [
        { href: '/feed', label: 'Feed' },
        { href: '/subscriptions', label: 'Subscriptions' },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-5xl mx-auto flex h-14 items-center px-4">
                {/* Logo */}
                <Link href="/feed" className="mr-6 flex items-center space-x-2">
                    <span className="text-xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                        TubeReader
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
                {quota && (
                    quota.isAdmin ? (
                        <div className="mr-3 px-3 py-1 rounded-full text-xs border bg-purple-600 text-white border-purple-500 font-bold">
                            Admin ∞
                        </div>
                    ) : (
                        <div className={cn(
                            "mr-3 px-3 py-1 rounded-full text-xs border font-medium",
                            quota.current >= quota.limit
                                ? "text-red-400 bg-red-900/20 border-red-900/50"
                                : "text-green-400 bg-green-900/20 border-green-900/50"
                        )}>
                            Free • {quota.limit - quota.current} left
                        </div>
                    )
                )}

                {/* User Menu */}
                <UserMenu />
            </div>
        </header>
    );
}

