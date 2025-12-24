import { useQuery } from '@tanstack/react-query';
import { Channel, PodcastChannel } from '@/lib/types';

interface SubscriptionData {
    youtube: { channel: Channel }[];
    podcasts: { podcast: PodcastChannel }[];
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
