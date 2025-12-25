'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoginModal } from "@/components/auth/LoginModal";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { GuestChannel } from "@/lib/types";
import { useQuota } from "@/components/providers/QuotaProvider";

// Import sub-components
import { AddChannelForm } from './AddChannelForm';
import { SubscriptionCard } from './SubscriptionCard';
import { ChannelManagerProps, YoutubeChannel } from './types';
import { SummaryStyle } from '@/components/ui/StyleSelector';

/**
 * ChannelManager Component
 * Main component for managing YouTube channel and Podcast subscriptions.
 * 
 * Features:
 * - Add/remove YouTube channels and Podcasts
 * - Guest mode with localStorage persistence
 * - Optimistic UI updates
 * - Copy RSS links
 */
import { useTranslations } from 'next-intl';

// ...

export default function ChannelManager({
    initialChannels,
    initialPodcasts,
    onRefresh
}: ChannelManagerProps) {
    const { data: session } = useSession();
    const { quota, refreshQuota } = useQuota();
    const t = useTranslations('Subscriptions');
    const tFeed = useTranslations('Feed');

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
    const [optimisticPodcasts, setOptimisticPodcasts] = useState<any[]>([]); // Using any for podcast for simplicity or correct type if available

    // Recently added items (Bridging state to prevent flicker)
    // Used to keep the card visible after optimistic removal but before re-fetch validation
    const [recentlyAddedChannels, setRecentlyAddedChannels] = useState<YoutubeChannel[]>([]);
    const [recentlyAddedPodcasts, setRecentlyAddedPodcasts] = useState<any[]>([]);

    // Optimistic UI state for style changes (key: `${type}-${subscriptionId}`, value: SummaryStyle)
    const [optimisticStyles, setOptimisticStyles] = useState<Record<string, SummaryStyle>>({});


    // Determine which channels to display
    const realChannels = session ? initialChannels : localChannels;
    // Memoized deduping: recently added items that are NOT yet in realChannels
    const uniqueRecentChannels = recentlyAddedChannels.filter(
        recent => !realChannels.some(real => real.id === recent.id)
    );
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
            toast.error(t('add_youtube_placeholder')); // Using placeholder as error for empty input or generic error
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
            // ... existing guest mode logic ...
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
        const urlToSubmit = youtubeUrl; // Capture before clearing
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
                body: JSON.stringify({ url: urlToSubmit }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add channel');
            }

            toast.success('YouTube channel added successfully!');
            // toast.info("Don't Panic. If the feed is empty, wait for 5 mins and retry.");

            const data = await res.json();

            // Success! Transition from Optimistic -> Recently Added -> Real (eventually)
            // 1. Add to recently added (keeps it visible)
            setRecentlyAddedChannels(prev => [data.channel, ...prev]);

            // 2. Remove optimistic channel
            setOptimisticChannels(prev => prev.filter(c => c.id !== optimisticId));

            // 3. Trigger refresh (fetching real data)
            onRefresh?.(data.channel);

            // 4. Refresh global quota state
            refreshQuota();
        } catch (err: any) {
            // Revert optimistic
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
        const urlToSubmit = podcastUrl; // Capture before clearing
        // Optimistic Podcast Item
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
                body: JSON.stringify({ url: urlToSubmit }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add podcast');
            }

            toast.success('Podcast added successfully!');
            // toast.info("Don't Panic. If the feed is empty, wait. The AI backend is working on the backlog.");

            const data = await res.json();

            // Bridging state: Add to recently added to prevent flicker
            if (data.podcast) {
                setRecentlyAddedPodcasts(prev => [data.podcast, ...prev]);
            }

            setOptimisticPodcasts(prev => prev.filter(p => p.id !== optimisticId));
            onRefresh?.();

            // Refresh global quota state
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

        // Optimistic Update: Hide immediately
        setShowDeleteDialog(false);
        setOptimisticDeletedIds(prev => [...prev, targetId]);

        // Guest mode: Remove from local storage immediately
        if (!session && targetType === 'youtube') {
            const updatedLocal = localChannels.filter(c => c.id !== targetId);
            setLocalChannels(updatedLocal);
            toast.success(`Successfully unsubscribed from ${targetName}!`);
            setDeleteTarget(null);
            return;
        }

        // Authenticated mode
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

            // Refresh global quota state
            refreshQuota();
        } catch (err: any) {
            // Revert optimistic update on failure
            setOptimisticDeletedIds(prev => prev.filter(id => id !== targetId));
            toast.error(err.message || "Failed to unsubscribe");
        } finally {
            setLoading(false);
            setDeleteTarget(null);
        }
    };

    const copyRssLink = (id: number, type: 'youtube' | 'podcast') => {
        if (!session) {
            setLoginModalOpen(true);
            return;
        }

        const path = type === 'youtube' ? `/feed/${id}` : `/feed/podcast/${id}`;
        const link = `${window.location.origin}${path}`;
        navigator.clipboard.writeText(link);
        toast.success('RSS Link copied to clipboard!');
    };

    const handleStyleChange = (subscriptionId: number, type: 'youtube' | 'podcast', newStyle: SummaryStyle) => {
        const key = `${type}-${subscriptionId}`;

        // 1. Optimistic update - immediately update UI
        setOptimisticStyles(prev => ({ ...prev, [key]: newStyle }));

        // 2. Show toast immediately
        toast.success(t('style_updated'));

        // 3. Fire API call in background (no await)
        fetch('/api/subscriptions/style', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId, type, newStyle }),
        })
            .then(res => {
                if (!res.ok) {
                    throw new Error('Failed to update style');
                }
                // Success - clear optimistic state (real data will come from next refresh)
                setOptimisticStyles(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
                onRefresh?.();
            })
            .catch(err => {
                // Revert optimistic update on error
                setOptimisticStyles(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
                toast.error(err.message || 'Failed to update style');
            });
    };

    // Helper to get effective style (optimistic or real)
    const getEffectiveStyle = (subscriptionId: number, type: 'youtube' | 'podcast', realStyle: SummaryStyle): SummaryStyle => {
        const key = `${type}-${subscriptionId}`;
        return optimisticStyles[key] ?? realStyle;
    };

    // --- Render ---

    return (
        <>
            <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
            <ConfirmDialog
                isOpen={showDeleteDialog}
                title="Confirm Unsubscribe"
                message={`Are you sure you want to unsubscribe from "${deleteTarget?.name}"? You can always subscribe again later.`}
                confirmText="Unsubscribe"
                cancelText="Cancel"
                variant="danger"
                onConfirm={confirmUnsubscribe}
                onCancel={() => {
                    setShowDeleteDialog(false);
                    setDeleteTarget(null);
                }}
            />

            <div className="space-y-8">
                <Tabs defaultValue="youtube" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-orange-950/30 rounded-lg p-1 h-auto">
                        <TabsTrigger
                            value="youtube"
                            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-orange-200/70 hover:text-orange-100 transition-colors py-2"
                        >
                            YouTube
                        </TabsTrigger>
                        <TabsTrigger
                            value="podcast"
                            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-orange-200/70 hover:text-orange-100 transition-colors py-2"
                        >
                            Podcast
                        </TabsTrigger>
                    </TabsList>

                    {/* YouTube Tab */}
                    <TabsContent value="youtube" className="space-y-8">
                        <AddChannelForm
                            type="youtube"
                            value={youtubeUrl}
                            onChange={setYoutubeUrl}
                            onSubmit={handleYouTubeSubmit}
                            loading={loading}
                            canAddMore={canAddMore}
                            error={error}
                        />

                        <div className="flex flex-col items-center gap-4 w-full">
                            {displayChannels.map((channel) => (
                                <SubscriptionCard
                                    key={channel.id}
                                    type="youtube"
                                    id={channel.id}
                                    title={channel.title}
                                    description={channel.description}
                                    lastUpdated={channel.last_updated}
                                    externalUrl={`https://youtube.com/channel/${channel.youtube_id}`}
                                    summaryStyle={getEffectiveStyle((channel as any).subscriptionId || channel.id, 'youtube', (channel as any).summaryStyle || 'DEFAULT')}
                                    onUnsubscribe={() => handleUnsubscribe(channel.id, 'youtube', channel.title)}
                                    onCopyRss={() => copyRssLink(channel.id, 'youtube')}
                                    onStyleChange={session ? (style) => handleStyleChange((channel as any).subscriptionId || channel.id, 'youtube', style) : undefined}
                                    onLoginRequired={() => setLoginModalOpen(true)}
                                    isAuthenticated={!!session}
                                    loading={loading}
                                />
                            ))}

                            {displayChannels.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    {t('empty_youtube')}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Podcast Tab */}
                    <TabsContent value="podcast" className="space-y-8">
                        <AddChannelForm
                            type="podcast"
                            value={podcastUrl}
                            onChange={setPodcastUrl}
                            onSubmit={handlePodcastSubmit}
                            loading={loading}
                            canAddMore={canAddMore}
                            error={error}
                        />

                        <div className="flex flex-col items-center gap-4 w-full">
                            {displayPodcasts.map((podcast) => (
                                <SubscriptionCard
                                    key={podcast.id}
                                    type="podcast"
                                    id={podcast.id}
                                    title={podcast.title || 'Untitled Podcast'}
                                    description={podcast.description}
                                    lastUpdated={podcast.last_updated}
                                    externalUrl={podcast.site_url}
                                    summaryStyle={getEffectiveStyle((podcast as any).subscriptionId || podcast.id, 'podcast', (podcast as any).summaryStyle || 'DEFAULT')}
                                    onUnsubscribe={() => handleUnsubscribe(podcast.id, 'podcast', podcast.title || 'this podcast')}
                                    onCopyRss={() => copyRssLink(podcast.id, 'podcast')}
                                    onStyleChange={session ? (style) => handleStyleChange((podcast as any).subscriptionId || podcast.id, 'podcast', style) : undefined}
                                    loading={loading}
                                />
                            ))}

                            {displayPodcasts.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    {t('empty_podcast')}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
