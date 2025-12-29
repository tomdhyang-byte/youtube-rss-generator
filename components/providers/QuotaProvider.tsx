'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useSubscriptions } from '@/hooks/useSubscriptions';

export interface Quota {
    current: number;
    limit: number | null;
    isAdmin: boolean;
}

interface QuotaContextType {
    quota: Quota | null;
    isLoading: boolean;
    /**
     * @deprecated No longer needed - quota is derived from React Query cache.
     * Mutations automatically update the cache, so quota stays in sync.
     */
    refreshQuota: () => void;
}

const QuotaContext = createContext<QuotaContextType | undefined>(undefined);

/**
 * QuotaProvider - Now derives quota from React Query cache (single source of truth).
 * 
 * Previously, this component made independent API calls to fetch quota,
 * which could desync from the subscription list. Now it reads directly from
 * the same cache that useSubscriptions() uses.
 */
export function QuotaProvider({ children }: { children: ReactNode }) {
    const { status } = useSession();
    const { data, isLoading } = useSubscriptions();

    // Derive quota from React Query cache (single source of truth)
    const quota: Quota | null = status === 'authenticated' && data?.quota
        ? data.quota
        : null;

    // refreshQuota is now a no-op since mutations handle cache updates
    const refreshQuota = () => {
        // No-op: React Query mutations automatically update the cache
        // This function is kept for backward compatibility with existing code
    };

    return (
        <QuotaContext.Provider value={{ quota, isLoading, refreshQuota }}>
            {children}
        </QuotaContext.Provider>
    );
}

/**
 * Hook to access quota state throughout the app.
 * Quota is now derived from the same React Query cache as subscriptions,
 * ensuring consistency.
 * 
 * @example
 * const { quota, isLoading } = useQuota();
 * if (quota && quota.current >= (quota.limit || Infinity)) {
 *     // Show quota exceeded message
 * }
 */
export function useQuota() {
    const context = useContext(QuotaContext);
    if (context === undefined) {
        throw new Error('useQuota must be used within a QuotaProvider');
    }
    return context;
}
