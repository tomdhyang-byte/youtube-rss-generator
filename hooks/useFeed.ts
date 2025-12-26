import { useInfiniteQuery } from '@tanstack/react-query';
import { FeedItem } from '@/lib/types';

type FilterType = 'all' | 'youtube' | 'podcast';

interface FeedPage {
    items: FeedItem[];
    nextCursor: string | null;
}

export const fetchFeed = async (filter: FilterType, cursor?: string): Promise<FeedPage> => {
    const params = new URLSearchParams({ filter });
    if (cursor) {
        params.set('cursor', cursor);
    }

    const res = await fetch(`/api/feed?${params.toString()}`);
    if (!res.ok) {
        throw new Error('Failed to fetch feed');
    }
    return res.json();
};

export function useFeed(filter: FilterType) {
    return useInfiniteQuery({
        queryKey: ['feed', filter],
        queryFn: ({ pageParam }) => fetchFeed(filter, pageParam),
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialPageParam: undefined as string | undefined,
    });
}

