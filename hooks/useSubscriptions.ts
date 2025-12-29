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
            console.log('[useAddChannelMutation] onSuccess called with data:', data);
            console.log('[useAddChannelMutation] subscription.channel:', data?.subscription?.channel);
            // Merge real subscription data into cache, replacing optimistic entry
            if (data?.subscription) {
                if (!data.subscription.channel) {
                    console.error('[useAddChannelMutation] WARNING: subscription.channel is missing!');
                }
                console.log('[useAddChannelMutation] Merging subscription into cache:', JSON.stringify(data.subscription, null, 2));
                queryClient.setQueryData<SubscriptionData>(['subscriptions'], (old) => {
                    console.log('[useAddChannelMutation] Old youtube array:', old?.youtube);
                    if (!old) return old;
                    // Remove optimistic entry (negative id) and add real subscription
                    const filteredYoutube = old.youtube.filter(s => s.id > 0);
                    console.log('[useAddChannelMutation] Filtered youtube (removed optimistic):', filteredYoutube);
                    const newData = {
                        ...old,
                        youtube: [data.subscription, ...filteredYoutube],
                    };
                    console.log('[useAddChannelMutation] New youtube array:', newData.youtube);
                    return newData;
                });
            } else {
                console.log('[useAddChannelMutation] No subscription in response, skipping cache update');
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
