'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoginModal } from "@/components/LoginModal";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { GuestChannel } from "@/lib/types";

// Import sub-components
import { AddChannelForm } from './AddChannelForm';
import { ChannelCard } from './ChannelCard';
import { PodcastCard } from './PodcastCard';
import { ChannelManagerProps, YoutubeChannel } from './types';

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
export default function ChannelManager({
    initialChannels,
    initialPodcasts,
    quota,
    onRefresh
}: ChannelManagerProps) {
    const { data: session } = useSession();

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

    // Determine which channels to display
    const displayChannels = (session ? initialChannels : localChannels)
        .filter(channel => !optimisticDeletedIds.includes(channel.id));

    const displayPodcasts = initialPodcasts
        .filter(podcast => !optimisticDeletedIds.includes(podcast.id));

    // Check if user can add more channels
    const canAddMore = !quota || quota.isAdmin || quota.current < (quota.limit || 1);

    // --- Handlers ---

    const handleYouTubeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!youtubeUrl) {
            toast.error("Please enter a YouTube channel URL");
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

                // Generate negative ID for guest channel
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
                toast.info('You can add 1 free channel. Sign in to add more.');
            } catch (err: any) {
                setError(err.message);
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
            return;
        }

        // Authenticated mode: Normal API call
        try {
            const res = await fetch('/api/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: youtubeUrl }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add channel');
            }

            setYoutubeUrl('');
            toast.success('YouTube channel added successfully!');
            toast.info("Don't Panic. If the feed is empty, wait for 5 mins and retry.");

            const data = await res.json();
            onRefresh?.(data.channel);
        } catch (err: any) {
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

        try {
            const res = await fetch('/api/podcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: podcastUrl }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add podcast');
            }

            setPodcastUrl('');
            toast.success('Podcast added successfully!');
            toast.info("Don't Panic. If the feed is empty, wait. The AI backend is working on the backlog.");
            onRefresh?.();
        } catch (err: any) {
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
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-800/50 rounded-lg p-1 h-auto">
                        <TabsTrigger
                            value="youtube"
                            className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 hover:text-slate-200 transition-colors py-2"
                        >
                            YouTube Channels
                        </TabsTrigger>
                        <TabsTrigger
                            value="podcast"
                            className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 hover:text-slate-200 transition-colors py-2"
                        >
                            Podcasts
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
                                <ChannelCard
                                    key={channel.id}
                                    channel={channel as YoutubeChannel}
                                    onUnsubscribe={handleUnsubscribe}
                                    onCopyRss={copyRssLink}
                                    onLoginRequired={() => setLoginModalOpen(true)}
                                    isAuthenticated={!!session}
                                    loading={loading}
                                />
                            ))}

                            {displayChannels.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    No YouTube channels added yet.
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
                                <PodcastCard
                                    key={podcast.id}
                                    podcast={podcast}
                                    onUnsubscribe={handleUnsubscribe}
                                    onCopyRss={copyRssLink}
                                    loading={loading}
                                />
                            ))}

                            {displayPodcasts.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    No podcasts added yet.
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
