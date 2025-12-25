import { useQuery } from '@tanstack/react-query';
import { Channel, PodcastChannel } from '@/lib/types';

// Summary style type matching Prisma enum
type SummaryStyle = 'DEFAULT' | 'INVESTMENT' | 'TECH_DEEP_DIVE' | 'QUICK_DIGEST';

interface YoutubeSubscription {
    id: number;
    userId: string;
    channelId: number;
    summaryStyle: SummaryStyle;
    createdAt: string;
    channel: Channel;
}

interface PodcastSubscription {
    id: number;
    userId: string;
    podcastId: number;
    summaryStyle: SummaryStyle;
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
}

export const fetchSubscriptions = async (): Promise<SubscriptionData> => {
    const res = await fetch('/api/subscriptions');
    if (!res.ok) {
        throw new Error('Failed to fetch subscriptions');
    }
    return res.json();
};

export function useSubscriptions() {
    return useQuery({
        queryKey: ['subscriptions'],
        queryFn: fetchSubscriptions,
    });
}
