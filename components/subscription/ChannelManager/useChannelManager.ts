
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useQuota } from "@/components/providers/QuotaProvider";
import { ChannelManagerProps, YoutubeChannel, YoutubeChannelWithSubscription, PodcastWithSubscription } from './types';
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
    const { quota, refreshQuota } = useQuota();
    const locale = useLocale();
    const t = useTranslations('Subscriptions');

    // Form state
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [podcastUrl, setPodcastUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Modal state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: 'youtube' | 'podcast'; name: string } | null>(null);
    const [loginModalOpen, setLoginModalOpen] = useState(false);

    // Guest mode state
    const [localChannels, setLocalChannels] = useLocalStorage<GuestChannel[]>('guest_channels', []);

    // Optimistic UI state for deletions
    const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<number[]>([]);

    // Optimistic UI state for additions
    const [optimisticChannels, setOptimisticChannels] = useState<YoutubeChannel[]>([]);
    const [optimisticPodcasts, setOptimisticPodcasts] = useState<any[]>([]);

    // Recently added items (Bridging state to prevent flicker)
    const [recentlyAddedChannels, setRecentlyAddedChannels] = useState<YoutubeChannel[]>([]);
    const [recentlyAddedPodcasts, setRecentlyAddedPodcasts] = useState<any[]>([]);

    // Optimistic UI state for style/language changes
    const [optimisticStyles, setOptimisticStyles] = useState<Record<string, SummaryStyle>>({});
    const [optimisticLanguages, setOptimisticLanguages] = useState<Record<string, SummaryLanguage>>({});

    // Determine which channels to display
    const realChannels = session ? initialChannels : localChannels;

    // Memoized deduping: recently added items that are NOT yet in realChannels
    const uniqueRecentChannels = recentlyAddedChannels.filter(
        recent => !realChannels.some(real => real.id === recent.id)
    );
    // Explicitly cast optimisticChannels to YoutubeChannelWithSubscription[] (or similar) to match displayChannels type if needed, 
    // but here we just combine them. The rendering component handles the display.
    const displayChannels = [...optimisticChannels, ...uniqueRecentChannels, ...realChannels]
        .filter(channel => !optimisticDeletedIds.includes(channel.id));

    const uniqueRecentPodcasts = recentlyAddedPodcasts.filter(
        recent => !initialPodcasts.some(real => real.id === recent.id)
    );
    const displayPodcasts = [...optimisticPodcasts, ...uniqueRecentPodcasts, ...initialPodcasts]
        .filter(podcast => !optimisticDeletedIds.includes(podcast.id));

    // Check if user can add more channels
    const canAddMore = !quota || quota.isAdmin || quota.current < (quota.limit || 1);

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

        setLoading(true);
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
            } finally {
                setLoading(false);
            }
            return;
        }

        // Authenticated mode: Optimistic Update
        const optimisticId = -Date.now();
        const urlToSubmit = youtubeUrl;
        const optimisticChannel: YoutubeChannel = {
            id: optimisticId,
            youtube_id: 'pending-' + optimisticId,
            title: t('adding_channel'),
            description: t('adding_channel_desc'),
            rss_url: '',
            last_updated: new Date().toISOString(),
        };

        setOptimisticChannels(prev => [optimisticChannel, ...prev]);
        setYoutubeUrl('');

        try {
            const res = await fetch('/api/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlToSubmit, locale }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add channel');
            }

            toast.success(t('channel_added_success'));
            const data = await res.json();

            // Success! Transition
            setRecentlyAddedChannels(prev => [data.channel, ...prev]);
            setOptimisticChannels(prev => prev.filter(c => c.id !== optimisticId));
            onRefresh?.(data.channel);
            refreshQuota();
        } catch (err: any) {
            setOptimisticChannels(prev => prev.filter(c => c.id !== optimisticId));
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePodcastSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!podcastUrl) {
            toast.error("Please enter a Podcast URL");
            return;
        }

        setLoading(true);
        setError('');

        const optimisticId = -Date.now();
        const urlToSubmit = podcastUrl;

        const optimisticPodcast = {
            id: optimisticId,
            feed_url: 'pending',
            title: t('adding_podcast'),
            description: t('adding_podcast_desc'),
            site_url: '',
            image_url: null,
            last_updated: new Date(),
        };

        setOptimisticPodcasts(prev => [optimisticPodcast, ...prev]);
        setPodcastUrl('');

        try {
            const res = await fetch('/api/podcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlToSubmit, locale }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add podcast');
            }

            toast.success(t('podcast_added_success'));
            const data = await res.json();

            if (data.podcast) {
                setRecentlyAddedPodcasts(prev => [data.podcast, ...prev]);
            }

            setOptimisticPodcasts(prev => prev.filter(p => p.id !== optimisticId));
            onRefresh?.();
            refreshQuota();
        } catch (err: any) {
            setOptimisticPodcasts(prev => prev.filter(p => p.id !== optimisticId));
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
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

            onRefresh?.();
            refreshQuota();
        } catch (err: any) {
            setOptimisticDeletedIds(prev => prev.filter(id => id !== targetId));
            toast.error(err.message || "Failed to unsubscribe");
        } finally {
            setLoading(false);
            setDeleteTarget(null);
        }
    };

    const copyRssLink = () => {
        if (!session) {
            setLoginModalOpen(true);
            return;
        }

        if (!feedToken) {
            toast.error('Feed token not found. Please try refreshing the page.');
            return;
        }

        const link = `${window.location.origin}/feed/user/${feedToken}`;
        navigator.clipboard.writeText(link);
        toast.success('Personal RSS Feed link copied to clipboard!');
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
                await onRefresh?.();
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
                await onRefresh?.();
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
