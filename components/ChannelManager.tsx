'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Rss, ExternalLink, Loader2, Mic, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { LoginModal } from "@/components/LoginModal"
import { useLocalStorage } from "@/lib/hooks/useLocalStorage"
import { GuestChannel } from "@/lib/types"

// Define types based on the Prisma model
interface YoutubeChannel {
    id: number;
    youtube_id: string;
    title: string;
    description: string | null;
    rss_url: string | null;
    last_updated: string;
};

type PodcastChannel = {
    id: number;
    feed_url: string;
    title: string | null;
    description: string | null;
    site_url: string | null;
    image_url: string | null;
    last_updated: Date;
};

interface ChannelManagerProps {
    initialChannels: YoutubeChannel[];
    initialPodcasts: PodcastChannel[];
    quota?: {
        current: number;
        limit: number | null;
        isAdmin: boolean;
    };
    onRefresh?: () => void;
}

export default function ChannelManager({
    initialChannels,
    initialPodcasts,
    quota,
    onRefresh
}: ChannelManagerProps) {
    const { data: session } = useSession();
    const [url, setUrl] = useState('');
    const [podcastUrl, setPodcastUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: 'youtube' | 'podcast'; name: string } | null>(null);
    const [loginModalOpen, setLoginModalOpen] = useState(false);

    // Guest mode state
    const [localChannels, setLocalChannels, removeLocalChannels] = useLocalStorage<GuestChannel[]>('guest_channels', []);

    // Determine which channels to display
    const displayChannels = session ? initialChannels : localChannels;

    const handleYouTubeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) {
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

                // Call backend proxy to avoid CORS
                const response = await fetch('/api/channel-info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
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
                    url: url, // Store original URL for sync
                };

                setLocalChannels([...localChannels, mockChannel]);
                setUrl('');
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
                body: JSON.stringify({ url }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add channel');
            }

            setUrl('');
            toast.success('YouTube channel added successfully!');
            toast.info("Don't Panic. If the feed is empty, wait for 5 mins and retry.");
            onRefresh?.();
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

        setShowDeleteDialog(false);
        setLoading(true);

        try {
            const endpoint = deleteTarget.type === 'youtube' ? '/api/channels' : '/api/podcasts';
            const idKey = deleteTarget.type === 'youtube' ? 'channelId' : 'podcastId';

            const res = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [idKey]: deleteTarget.id }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to unsubscribe');
            }

            toast.success(`Successfully unsubscribed from ${deleteTarget.name}!`);
            onRefresh?.();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
            setDeleteTarget(null);
        }
    };

    const copyRssLink = (id: number, type: 'youtube' | 'podcast') => {
        // Guest mode: Show login modal
        if (!session) {
            setLoginModalOpen(true);
            return;
        }

        const path = type === 'youtube' ? `/feed/${id}` : `/feed/podcast/${id}`;
        const link = `${window.location.origin}${path}`;
        navigator.clipboard.writeText(link);
        toast.success('RSS Link copied to clipboard!');
    };

    const decodeHtml = (html: string) => {
        if (typeof window === 'undefined') return html;
        if (!html) return '';
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    };

    const canAddMore = !quota || quota.isAdmin || quota.current < (quota.limit || 1);
    const quotaText = quota?.isAdmin
        ? '∞ (Admin)'
        : `${quota?.current || 0}/${quota?.limit || 1}`;

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
                {quota && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Subscription Quota
                                </p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {quotaText}
                                </p>
                            </div>
                            {quota.isAdmin && (
                                <div className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
                                    ADMIN
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <Tabs defaultValue="youtube" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-8">
                        <TabsTrigger value="youtube">YouTube Channels</TabsTrigger>
                        <TabsTrigger value="podcast">Podcasts</TabsTrigger>
                    </TabsList>

                    <TabsContent value="youtube" className="space-y-8">
                        {/* Add Channel Form */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                            <form onSubmit={handleYouTubeSubmit} className="flex gap-4">
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="Paste YouTube Channel URL (e.g. https://youtube.com/@channel)"
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.5)] outline-none transition-all text-black dark:text-white bg-white dark:bg-gray-700 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                                    disabled={loading}
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !canAddMore}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!canAddMore ? 'Quota reached - please unsubscribe from another to add' : ''}
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                    Add Channel
                                </button>
                            </form>
                            {error && (
                                <p className="mt-3 text-red-500 text-sm flex items-center gap-1">
                                    ⚠️ {error}
                                </p>
                            )}
                        </div>

                        {/* Channel List */}
                        <div className="flex flex-col items-center gap-4 w-full">
                            {displayChannels.map((channel) => (
                                <div key={channel.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:border-blue-100 dark:hover:border-blue-900 transition-all w-full max-w-xl">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{decodeHtml(channel.title)}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3">{channel.description ? decodeHtml(channel.description) : ''}</p>
                                        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                                            <span>Updated: {new Date(channel.last_updated).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => {
                                                if (!session) {
                                                    setLoginModalOpen(true);
                                                } else {
                                                    handleUnsubscribe(channel.id, 'youtube', channel.title);
                                                }
                                            }}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                                            title={!session ? "Sign in to manage subscriptions" : "Unsubscribe"}
                                            disabled={loading}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => copyRssLink(channel.id, 'youtube')}
                                            className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950 rounded-lg transition-colors"
                                            title="Copy RSS Link"
                                        >
                                            <Rss className="w-5 h-5" />
                                        </button>
                                        <a
                                            href={`https://youtube.com/channel/${channel.youtube_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                            title="Open in YouTube"
                                        >
                                            <ExternalLink className="w-5 h-5" />
                                        </a>
                                    </div>
                                </div>
                            ))}

                            {displayChannels.length === 0 && (
                                <div className="text-center py-12 text-gray-400">
                                    No YouTube channels added yet.
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="podcast" className="space-y-8">
                        {/* Add Podcast Form */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                            <form onSubmit={handlePodcastSubmit} className="flex gap-4">
                                <input
                                    type="text"
                                    value={podcastUrl}
                                    onChange={(e) => setPodcastUrl(e.target.value)}
                                    placeholder="Paste Apple Podcast Link or RSS URL"
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-purple-500 focus:shadow-[0_0_0_4px_rgba(168,85,247,0.5)] outline-none transition-all text-black dark:text-white bg-white dark:bg-gray-700 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                                    disabled={loading}
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !canAddMore}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!canAddMore ? 'Quota reached - please unsubscribe from another to add' : ''}
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                                    Add Podcast
                                </button>
                            </form>
                            {error && (
                                <p className="mt-3 text-red-500 text-sm flex items-center gap-1">
                                    ⚠️ {error}
                                </p>
                            )}
                        </div>

                        {/* Podcast List */}
                        <div className="flex flex-col items-center gap-4 w-full">
                            {initialPodcasts.map((podcast) => (
                                <div key={podcast.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:border-purple-100 dark:hover:border-purple-900 transition-all w-full max-w-xl">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{podcast.title || 'Untitled Podcast'}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3">{podcast.description || ''}</p>
                                        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                                            <span>Updated: {new Date(podcast.last_updated).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => handleUnsubscribe(podcast.id, 'podcast', podcast.title || 'this podcast')}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                                            title="Unsubscribe"
                                            disabled={loading}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => copyRssLink(podcast.id, 'podcast')}
                                            className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950 rounded-lg transition-colors"
                                            title="Copy RSS Link"
                                        >
                                            <Rss className="w-5 h-5" />
                                        </button>
                                        {podcast.site_url && (
                                            <a
                                                href={podcast.site_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                                title="Open Website"
                                            >
                                                <ExternalLink className="w-5 h-5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {initialPodcasts.length === 0 && (
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
