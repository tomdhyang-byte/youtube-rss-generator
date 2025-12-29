import { useQuery } from '@tanstack/react-query';
import { Channel, PodcastChannel } from '@/lib/types';
import { SummaryStyle, SummaryLanguage } from '@prisma/client';

interface YoutubeSubscription {
    id: number;
    userId: string;
    channelId: number;
    summaryStyle: SummaryStyle;
    summaryLanguage: SummaryLanguage;
    createdAt: string;
    channel: Channel;
}

interface PodcastSubscription {
    id: number;
    userId: string;
    podcastId: number;
    summaryStyle: SummaryStyle;
    summaryLanguage: SummaryLanguage;
    createdAt: string;
    podcast: PodcastChannel;
}

interface SubscriptionData {
    youtube: YoutubeSubscription[];
    podcasts: PodcastSubscription[];
    quota: {
        current: number;
        limit: number | null;
        isAdmin: boolean;
    };
    feedToken?: string;
}

export const fetchSubscriptions = async (): Promise<SubscriptionData> => {
    // Prevent caching to ensure fresh data on navigation
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

export function useSubscriptions() {
    return useQuery({
        queryKey: ['subscriptions'],
        queryFn: fetchSubscriptions,
        staleTime: 0,
        refetchOnMount: false, // Prevent auto-refetch from overwriting optimistic updates
    });
}
