import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
        // Tier info (added for subscription tier system)
        tier: 'FREE' | 'PLUS' | 'PRO' | 'ADMIN';
        effectiveTier: 'FREE' | 'PLUS' | 'PRO' | 'ADMIN';
        expiresAt: string | null;
        isExpired: boolean;
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
/**
 * Mutation hook for adding a YouTube channel.
 * Implements proper optimistic update with cancelQueries protection.
 */
export function useAddChannelMutation() {
    const queryClient = useQueryClient();
    // Dynamically load translations for optimistic UI
    // Note: We need to use a namespace that is available. 'Subscriptions' seems appropriate.
    // However, hooks run in components, so this is valid.
    // Ensure 'Subscriptions' namespace is loaded in the page calling this.
    // If not, we might need a fallback. But standard setup usually loads common namespaces.
    // Let's assume 'Subscriptions' is available as it is used in ChannelManager.
    const t = useTranslations('Subscriptions');

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
                        title: t('adding_channel'),
                        description: t('adding_channel_desc'),
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

        onSuccess: (data, variables, context) => {
            // Merge real subscription data into cache, replacing optimistic entry
            if (data?.subscription) {
                queryClient.setQueryData<SubscriptionData>(['subscriptions'], (old) => {
                    if (!old) return old;
                    // Remove optimistic entry (negative id) and add real subscription
                    const filteredYoutube = old.youtube.filter(s => s.id > 0);
                    const newData = {
                        ...old,
                        youtube: [data.subscription, ...filteredYoutube],
                    };
                    return newData;
                });
            }
        },

        onSettled: () => {
            // Invalidate feed to show new content when available
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
    const t = useTranslations('Subscriptions');

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
                        title: t('adding_podcast'),
                        description: t('adding_podcast_desc'),
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

        onSuccess: (data, variables, context) => {
            // Merge real subscription data into cache, replacing optimistic entry
            if (data?.subscription) {
                queryClient.setQueryData<SubscriptionData>(['subscriptions'], (old) => {
                    if (!old) return old;
                    // Remove optimistic entry (negative id) and add real subscription
                    const filteredPodcasts = old.podcasts.filter(s => s.id > 0);
                    return {
                        ...old,
                        podcasts: [data.subscription, ...filteredPodcasts],
                    };
                });
            }
        },

        onSettled: () => {
            // Invalidate feed to show new content when available
            queryClient.invalidateQueries({ queryKey: ['feed'] });
        },
    });
}

/**
 * Mutation hook for deleting a YouTube channel.
 */
export function useDeleteChannelMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ channelId }: { channelId: number }) => {
            const res = await fetch('/api/channels', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to delete channel');
            }
            return res.json();
        },

        onMutate: async ({ channelId }) => {
            // 1. Cancel any in-flight refetches
            await queryClient.cancelQueries({ queryKey: ['subscriptions'] });

            // 2. Snapshot current data
            const previousData = queryClient.getQueryData<SubscriptionData>(['subscriptions']);

            // 3. Optimistically update: Remove the channel
            queryClient.setQueryData<SubscriptionData>(['subscriptions'], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    youtube: old.youtube.filter(s => s.channelId !== channelId),
                    quota: {
                        ...old.quota,
                        current: Math.max(0, old.quota.current - 1),
                    }
                };
            });

            return { previousData };
        },

        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(['subscriptions'], context.previousData);
            }
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['feed'] });
        },
    });
}

/**
 * Mutation hook for deleting a Podcast.
 */
export function useDeletePodcastMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ podcastId }: { podcastId: number }) => {
            const res = await fetch('/api/podcasts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ podcastId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to delete podcast');
            }
            return res.json();
        },

        onMutate: async ({ podcastId }) => {
            await queryClient.cancelQueries({ queryKey: ['subscriptions'] });
            const previousData = queryClient.getQueryData<SubscriptionData>(['subscriptions']);

            queryClient.setQueryData<SubscriptionData>(['subscriptions'], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    podcasts: old.podcasts.filter(s => s.podcastId !== podcastId),
                    quota: {
                        ...old.quota,
                        current: Math.max(0, old.quota.current - 1),
                    }
                };
            });

            return { previousData };
        },

        onError: (err, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['subscriptions'], context.previousData);
            }
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['feed'] });
        },
    });
}
