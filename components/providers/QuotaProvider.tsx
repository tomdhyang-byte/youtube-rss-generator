'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

export interface Quota {
    current: number;
    limit: number | null;
    isAdmin: boolean;
}

interface QuotaContextType {
    quota: Quota | null;
    isLoading: boolean;
    refreshQuota: () => Promise<void>;
}

const QuotaContext = createContext<QuotaContextType | undefined>(undefined);

export function QuotaProvider({ children }: { children: ReactNode }) {
    const { status } = useSession();
    const [quota, setQuota] = useState<Quota | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const refreshQuota = useCallback(async () => {
        if (status !== 'authenticated') {
            setQuota(null);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/subscriptions');
            const data = await res.json();
            if (data.quota) {
                setQuota(data.quota);
            }
        } catch (err) {
            console.error('Failed to fetch quota:', err);
        } finally {
            setIsLoading(false);
        }
    }, [status]);

    // Fetch quota when auth status changes
    useEffect(() => {
        if (status === 'authenticated') {
            refreshQuota();
        } else if (status === 'unauthenticated') {
            setQuota(null);
        }
    }, [status, refreshQuota]);

    return (
        <QuotaContext.Provider value={{ quota, isLoading, refreshQuota }}>
            {children}
        </QuotaContext.Provider>
    );
}

/**
 * Hook to access quota state throughout the app
 * 
 * @example
 * const { quota, isLoading, refreshQuota } = useQuota();
 * 
 * // After subscribing/unsubscribing, refresh the quota:
 * await handleSubscribe();
 * refreshQuota();
 */
export function useQuota() {
    const context = useContext(QuotaContext);
    if (context === undefined) {
        throw new Error('useQuota must be used within a QuotaProvider');
    }
    return context;
}
