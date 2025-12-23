'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import { LogIn, LogOut, Loader2, ChevronDown, RefreshCw } from 'lucide-react';

export function UserMenu() {
    const { data: session, status } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    if (status === 'loading') {
        return (
            <button
                disabled
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-not-allowed"
            >
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
            </button>
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
                        {session.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                ADMIN
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
                                    // Sign out first, then redirect to sign in with Google account picker
                                    await signOut({ redirect: false });
                                    // Use signIn with prompt to force account selection
                                    signIn('google', undefined, { prompt: 'select_account' });
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Switch Account
                            </button>

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
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Not signed in - show sign in button
    return (
        <button
            onClick={() => signIn('google')}
            className="flex items-center gap-2 px-3 py-2 md:px-6 md:py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 md:text-white md:bg-blue-600 md:hover:bg-blue-700 rounded-lg transition-colors md:shadow-lg md:hover:shadow-xl"
        >
            <LogIn className="w-5 h-5" />
            <span className="hidden md:inline">Sign in with Google</span>
            <span className="md:hidden">Sign in</span>
        </button>
    );
}
