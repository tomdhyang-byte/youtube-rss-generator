
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useQuota } from "@/components/providers/QuotaProvider";
import { useAddChannelMutation, useAddPodcastMutation } from "@/hooks/useSubscriptions";
import { ChannelManagerProps, YoutubeChannel } from './types';
import { GuestChannel } from '@/lib/types';
import { SummaryStyle } from '@/components/ui/StyleSelector';
import { SummaryLanguage } from '@/components/ui/LanguageSelector';

export function useChannelManager({
    initialChannels,
    initialPodcasts,
    feedToken,
    onRefresh
}: ChannelManagerProps) {
    const { data: session } = useSession();
    const { quota } = useQuota();
    const queryClient = useQueryClient();
    const locale = useLocale();
    const t = useTranslations('Subscriptions');

    // Mutations (handle optimistic updates via React Query)
    const addChannelMutation = useAddChannelMutation();
    const addPodcastMutation = useAddPodcastMutation();

    // Form state
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [podcastUrl, setPodcastUrl] = useState('');
    const [error, setError] = useState('');

    // Modal state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: 'youtube' | 'podcast'; name: string } | null>(null);
    const [loginModalOpen, setLoginModalOpen] = useState(false);

    // Guest mode state
    const [localChannels, setLocalChannels] = useLocalStorage<GuestChannel[]>('guest_channels', []);

    // Optimistic UI state for deletions (keep for delete flow)
    const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<number[]>([]);

    // Optimistic UI state for style/language changes
    const [optimisticStyles, setOptimisticStyles] = useState<Record<string, SummaryStyle>>({});
    const [optimisticLanguages, setOptimisticLanguages] = useState<Record<string, SummaryLanguage>>({});

    // Determine which channels to display
    // For authenticated users, use initialChannels from React Query cache (includes optimistic data)
    // For guests, use localChannels from localStorage
    const displayChannels = session
        ? initialChannels.filter(channel => !optimisticDeletedIds.includes(channel.id))
        : localChannels.filter(channel => !optimisticDeletedIds.includes(channel.id));

    const displayPodcasts = initialPodcasts
        .filter(podcast => !optimisticDeletedIds.includes(podcast.id));

    // Check if user can add more channels
    const canAddMore = !quota || quota.isAdmin || quota.current < (quota.limit || 1);

    // Loading state comes from mutations
    const loading = addChannelMutation.isPending || addPodcastMutation.isPending;

    // --- Handlers ---

    const handleYouTubeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!youtubeUrl) {
            toast.error(t('add_youtube_placeholder'));
            return;
        }

        // Guest mode: Show login modal if trying to add 2nd channel
        if (!session && localChannels.length >= 1) {
            setLoginModalOpen(true);
            return;
        }

        setError('');

        // Guest mode: Fetch real channel info via backend proxy
        if (!session) {
            try {
                toast.info('Fetching channel information...');
                const response = await fetch('/api/channel-info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: youtubeUrl }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || 'Failed to fetch channel info');
                }

                const { youtube_id, title, description } = await response.json();
                const mockId = -(Date.now());
                const mockChannel: GuestChannel = {
                    id: mockId,
                    youtube_id: youtube_id || 'guest-' + mockId,
                    title: title || 'YouTube Channel',
                    description: description,
                    rss_url: null,
                    last_updated: new Date().toISOString(),
                    url: youtubeUrl,
                    cached_metadata: {
                        youtube_id: youtube_id || 'guest-' + mockId,
                        title: title || 'YouTube Channel',
                        description: description,
                    },
                };

                setLocalChannels([...localChannels, mockChannel]);
                setYoutubeUrl('');
                toast.success('Channel added! Sign in to save permanently.');
            } catch (err: any) {
                setError(err.message);
                toast.error(err.message);
            }
            return;
        }

        // Authenticated mode: Use mutation (handles optimistic update automatically)
        const urlToSubmit = youtubeUrl;
        setYoutubeUrl('');

        addChannelMutation.mutate(
            { url: urlToSubmit, locale },
            {
                onSuccess: () => {
                    toast.success(t('channel_added_success'));
                },
                onError: (err) => {
                    setError(err.message);
                    toast.error(err.message);
                },
            }
        );
    };

    const handlePodcastSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!podcastUrl) {
            toast.error("Please enter a Podcast URL");
            return;
        }

        setError('');
        const urlToSubmit = podcastUrl;
        setPodcastUrl('');

        addPodcastMutation.mutate(
            { url: urlToSubmit, locale },
            {
                onSuccess: () => {
                    toast.success(t('podcast_added_success'));
                },
                onError: (err) => {
                    setError(err.message);
                    toast.error(err.message);
                },
            }
        );
    };

    const handleUnsubscribe = (channelId: number, type: 'youtube' | 'podcast', name: string) => {
        setDeleteTarget({ id: channelId, type, name });
        setShowDeleteDialog(true);
    };

    const confirmUnsubscribe = async () => {
        if (!deleteTarget) return;

        const { id: targetId, type: targetType, name: targetName } = deleteTarget;

        setShowDeleteDialog(false);
        setOptimisticDeletedIds(prev => [...prev, targetId]);

        if (!session && targetType === 'youtube') {
            const updatedLocal = localChannels.filter(c => c.id !== targetId);
            setLocalChannels(updatedLocal);
            toast.success(`Successfully unsubscribed from ${targetName}!`);
            setDeleteTarget(null);
            return;
        }

        toast.success(`Successfully unsubscribed from ${targetName}!`);

        try {
            const endpoint = targetType === 'youtube' ? '/api/channels' : '/api/podcasts';
            const idKey = targetType === 'youtube' ? 'channelId' : 'podcastId';

            const res = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [idKey]: targetId }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to unsubscribe');
            }

            // Invalidate to refresh data
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
        } catch (err: any) {
            setOptimisticDeletedIds(prev => prev.filter(id => id !== targetId));
            toast.error(err.message || "Failed to unsubscribe");
        } finally {
            setDeleteTarget(null);
        }
    };

    const copyRssLink = (id: number, type: 'youtube' | 'podcast') => {
        if (!session) {
            setLoginModalOpen(true);
            return;
        }

        if (!feedToken) {
            toast.error('Feed token not found. Please try refreshing the page.');
            return;
        }

        const path = type === 'youtube'
            ? `/feed/user/${feedToken}/channel/${id}`
            : `/feed/user/${feedToken}/podcast/${id}`;
        const link = `${window.location.origin}${path}`;
        navigator.clipboard.writeText(link);
        toast.success('RSS Feed link copied to clipboard!');
    };

    const handleStyleChange = (subscriptionId: number, type: 'youtube' | 'podcast', newStyle: SummaryStyle) => {
        const key = `${type}-${subscriptionId}`;

        setOptimisticStyles(prev => ({ ...prev, [key]: newStyle }));
        toast.success(t('style_updated'));

        fetch('/api/subscriptions/style', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId, type, newStyle }),
        })
            .then(async res => {
                if (!res.ok) throw new Error('Failed to update style');
                queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
                setOptimisticStyles(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            })
            .catch(err => {
                setOptimisticStyles(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
                toast.error(err.message || 'Failed to update style');
            });
    };

    const getEffectiveStyle = (subscriptionId: number, type: 'youtube' | 'podcast', realStyle: SummaryStyle): SummaryStyle => {
        const key = `${type}-${subscriptionId}`;
        return optimisticStyles[key] ?? realStyle;
    };

    const handleLanguageChange = (subscriptionId: number, type: 'youtube' | 'podcast', newLanguage: SummaryLanguage) => {
        const key = `${type}-${subscriptionId}`;

        setOptimisticLanguages(prev => ({ ...prev, [key]: newLanguage }));
        toast.success(t('language_updated'));

        fetch('/api/subscriptions/style', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId, type, newLanguage }),
        })
            .then(async res => {
                if (!res.ok) throw new Error('Failed to update language');
                queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
                setOptimisticLanguages(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            })
            .catch(err => {
                setOptimisticLanguages(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
                toast.error(err.message || 'Failed to update language');
            });
    };

    const getEffectiveLanguage = (subscriptionId: number, type: 'youtube' | 'podcast', realLanguage: SummaryLanguage): SummaryLanguage => {
        const key = `${type}-${subscriptionId}`;
        return optimisticLanguages[key] ?? realLanguage;
    };

    return {
        // State
        youtubeUrl, setYoutubeUrl,
        podcastUrl, setPodcastUrl,
        loading, error,
        displayChannels, displayPodcasts,
        canAddMore,
        session,

        // Modal State
        showDeleteDialog, setShowDeleteDialog,
        deleteTarget, setDeleteTarget,
        loginModalOpen, setLoginModalOpen,

        // Actions
        handleYouTubeSubmit,
        handlePodcastSubmit,
        handleUnsubscribe,
        confirmUnsubscribe,
        copyRssLink,
        handleStyleChange,
        handleLanguageChange,
        getEffectiveStyle,
        getEffectiveLanguage,
    };
}
