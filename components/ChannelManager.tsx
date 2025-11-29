'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Rss, ExternalLink, Loader2, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
}

export default function ChannelManager({
    initialChannels,
    initialPodcasts
}: ChannelManagerProps) {
    const [url, setUrl] = useState('');
    const [podcastUrl, setPodcastUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleYouTubeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) {
            toast.error("Please enter a YouTube channel URL");
            return;
        }

        setLoading(true);
        setError('');

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
            router.refresh();
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
            router.refresh();
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyRssLink = (id: number, type: 'youtube' | 'podcast') => {
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

    return (
        <div className="space-y-8">
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
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        {initialChannels.map((channel) => (
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
                                        onClick={() => copyRssLink(channel.id, 'youtube')}
                                        className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors title='Copy RSS Link'"
                                        title="Copy RSS Link"
                                    >
                                        <Rss className="w-5 h-5" />
                                    </button>
                                    <a
                                        href={`https://youtube.com/channel/${channel.youtube_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                        title="Open in YouTube"
                                    >
                                        <ExternalLink className="w-5 h-5" />
                                    </a>
                                </div>
                            </div>
                        ))}

                        {initialChannels.length === 0 && (
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
                                disabled={loading}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        onClick={() => copyRssLink(podcast.id, 'podcast')}
                                        className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors title='Copy RSS Link'"
                                        title="Copy RSS Link"
                                    >
                                        <Rss className="w-5 h-5" />
                                    </button>
                                    {podcast.site_url && (
                                        <a
                                            href={podcast.site_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
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
    );
}
