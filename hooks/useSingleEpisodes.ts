import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SingleEpisodeItem, SingleEpisodeStatus } from '@/lib/types';

// --- Type Definitions ---

export interface SingleEpisodeData {
    items: SingleEpisodeItem[];
    total: number;
    limit: number;
}

export interface SubmitSingleEpisodeParams {
    url: string;
    style: string;
    language: string;
}

export interface SubmitSingleEpisodeResponse {
    status: 'queued' | 'ready';
    episodeType: 'video' | 'podcast';
    id: number;
    externalId: string;
    linkedToSubscription?: boolean;
    summary?: string;
}

// --- Query Functions ---

export const fetchSingleEpisodes = async (): Promise<SingleEpisodeData> => {
    const res = await fetch('/api/single-episodes', {
        cache: 'no-store',
        headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });

    if (!res.ok) {
        throw new Error('Failed to fetch single episodes');
    }
    return res.json();
};

// --- Hooks ---

/**
 * Hook to fetch and cache single episode data.
 * Automatically polls when there are pending/processing items.
 */
export function useSingleEpisodes() {
    return useQuery({
        queryKey: ['single-episodes'],
        queryFn: fetchSingleEpisodes,
        refetchInterval: (query) => {
            const data = query.state.data;
            if (!data) return false;

            // Poll every 5 seconds if any items are pending or processing
            const hasPending = data.items.some(
                (item) => item.status === 'PENDING' || item.status === 'PROCESSING'
            );
            return hasPending ? 5000 : false;
        },
    });
}

/**
 * Mutation hook for submitting a single episode.
 */
export function useSubmitSingleEpisodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: SubmitSingleEpisodeParams): Promise<SubmitSingleEpisodeResponse> => {
            const res = await fetch('/api/single-episode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || data.error || 'Failed to submit single episode');
            }

            return data;
        },

        onSuccess: () => {
            // Invalidate to refetch the list
            queryClient.invalidateQueries({ queryKey: ['single-episodes'] });
        },
    });
}

/**
 * Mutation hook for deleting a single episode.
 */
export function useDeleteSingleEpisodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/single-episodes/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to delete single episode');
            }

            return res.json();
        },

        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['single-episodes'] });
            const previousData = queryClient.getQueryData<SingleEpisodeData>(['single-episodes']);

            // Optimistically remove the item
            queryClient.setQueryData<SingleEpisodeData>(['single-episodes'], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    items: old.items.filter((item) => item.id !== id),
                    total: old.total - 1,
                };
            });

            return { previousData };
        },

        onError: (err, id, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['single-episodes'], context.previousData);
            }
        },
    });
}

/**
 * Mutation hook for retrying a failed single episode.
 */
export function useRetrySingleEpisodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/single-episodes/${id}/retry`, {
                method: 'POST',
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to retry single episode');
            }

            return res.json();
        },

        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['single-episodes'] });
            const previousData = queryClient.getQueryData<SingleEpisodeData>(['single-episodes']);

            // Optimistically update status to PENDING
            queryClient.setQueryData<SingleEpisodeData>(['single-episodes'], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    items: old.items.map((item) =>
                        item.id === id
                            ? { ...item, status: 'PENDING' as SingleEpisodeStatus, failureReason: null }
                            : item
                    ),
                };
            });

            return { previousData };
        },

        onError: (err, id, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['single-episodes'], context.previousData);
            }
        },
    });
}
