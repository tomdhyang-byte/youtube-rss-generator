import { useQuery } from '@tanstack/react-query';
import { FeedItem } from '@/lib/types';

type FilterType = 'all' | 'youtube' | 'podcast';

export const fetchFeed = async (filter: FilterType): Promise<{ items: FeedItem[] }> => {
    const res = await fetch(`/api/feed?filter=${filter}`);
    if (!res.ok) {
        throw new Error('Failed to fetch feed');
    }
    return res.json();
};

export function useFeed(filter: FilterType) {
    return useQuery({
        queryKey: ['feed', filter],
        queryFn: () => fetchFeed(filter),
    });
}
