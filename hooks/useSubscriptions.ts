import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Channel, PodcastChannel } from '@/lib/types';
import { SummaryStyle, SummaryLanguage } from '@prisma/client';

// --- Type Definitions ---

export interface YoutubeSubscription {
    id: number;
    userId: string;
    channelId: number;
    summaryStyle: SummaryStyle;
    summaryLanguage: SummaryLanguage;
    createdAt: string;
    channel: Channel;
}

export interface PodcastSubscription {
    id: number;
    userId: string;
    podcastId: number;
    summaryStyle: SummaryStyle;
    summaryLanguage: SummaryLanguage;
    createdAt: string;
    podcast: PodcastChannel;
}

export interface SubscriptionData {
    youtube: YoutubeSubscription[];
    podcasts: PodcastSubscription[];
    quota: {
        current: number;
        limit: number | null;
        isAdmin: boolean;
    };
    feedToken?: string;
}

// --- Query Functions ---

export const fetchSubscriptions = async (): Promise<SubscriptionData> => {
    const res = await fetch('/api/subscriptions', {
        cache: 'no-store',
        headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
    });

    if (!res.ok) {
        throw new Error('Failed to fetch subscriptions');
    }
    return res.json();
};

// --- Hooks ---

/**
 * Hook to fetch and cache subscription data.
 * No special staleTime or refetchOnMount hacks needed - mutations handle optimistic updates properly.
 */
export function useSubscriptions() {
    return useQuery({
        queryKey: ['subscriptions'],
        queryFn: fetchSubscriptions,
    });
}

/**
 * Mutation hook for adding a YouTube channel.
 * Implements proper optimistic update with cancelQueries protection.
 */
export function useAddChannelMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ url, locale }: { url: string; locale: string }) => {
            const res = await fetch('/api/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, locale }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add channel');
            }
            return res.json();
        },

        onMutate: async ({ url, locale }) => {
            // 1. Cancel any in-flight refetches to prevent overwriting optimistic data
            await queryClient.cancelQueries({ queryKey: ['subscriptions'] });

            // 2. Snapshot current data for rollback
            const previousData = queryClient.getQueryData<SubscriptionData>(['subscriptions']);

            // 3. Optimistically update cache
            const optimisticId = -Date.now();
            queryClient.setQueryData<SubscriptionData>(['subscriptions'], (old) => {
                if (!old) return old;

                const optimisticSub: YoutubeSubscription = {
                    id: optimisticId,
                    channelId: optimisticId,
                    userId: 'optimistic',
                    summaryStyle: 'DEFAULT',
                    summaryLanguage: locale === 'zh-TW' ? 'ZH_TW' : 'EN',
                    createdAt: new Date().toISOString(),
                    channel: {
                        id: optimisticId,
                        youtube_id: 'pending-' + optimisticId,
                        title: 'Adding channel...',
                        description: 'Please wait while we fetch channel info...',
                        rss_url: '',
                        last_updated: new Date().toISOString(),
                    }
                };

                return {
                    ...old,
                    youtube: [optimisticSub, ...old.youtube],
                    quota: {
                        ...old.quota,
                        current: old.quota.current + 1,
                    },
                };
            });

            return { previousData, optimisticId };
        },

        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(['subscriptions'], context.previousData);
            }
        },

        onSettled: () => {
            // Always refetch to get fresh data after mutation completes
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
        },
    });
}

/**
 * Mutation hook for adding a Podcast.
 * Implements proper optimistic update with cancelQueries protection.
 */
export function useAddPodcastMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ url, locale }: { url: string; locale: string }) => {
            const res = await fetch('/api/podcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, locale }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add podcast');
            }
            return res.json();
        },

        onMutate: async ({ url, locale }) => {
            await queryClient.cancelQueries({ queryKey: ['subscriptions'] });
            const previousData = queryClient.getQueryData<SubscriptionData>(['subscriptions']);

            const optimisticId = -Date.now();
            queryClient.setQueryData<SubscriptionData>(['subscriptions'], (old) => {
                if (!old) return old;

                const optimisticSub: PodcastSubscription = {
                    id: optimisticId,
                    podcastId: optimisticId,
                    userId: 'optimistic',
                    summaryStyle: 'DEFAULT',
                    summaryLanguage: locale === 'zh-TW' ? 'ZH_TW' : 'EN',
                    createdAt: new Date().toISOString(),
                    podcast: {
                        id: optimisticId,
                        feed_url: 'pending',
                        title: 'Adding podcast...',
                        description: 'Please wait while we fetch podcast info...',
                        site_url: '',
                        image_url: null,
                        last_updated: new Date().toISOString(),
                    }
                };

                return {
                    ...old,
                    podcasts: [optimisticSub, ...old.podcasts],
                    quota: {
                        ...old.quota,
                        current: old.quota.current + 1,
                    },
                };
            });

            return { previousData, optimisticId };
        },

        onError: (err, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['subscriptions'], context.previousData);
            }
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
        },
    });
}
