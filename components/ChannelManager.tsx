'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Rss, ExternalLink, Trash2, Loader2 } from 'lucide-react';

// Define the type based on the Prisma model
type Channel = {
    id: number;
    youtube_id: string;
    title: string;
    description: string | null;
    rss_url: string | null;
    last_updated: Date;
};

export default function ChannelManager({ initialChannels }: { initialChannels: Channel[] }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            if (!res.ok) {
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to add channel');
                } else {
                    const text = await res.text();
                    throw new Error(`Server Error (${res.status}): ${text}`);
                }
            }

            setUrl('');
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyRssLink = (channelId: number) => {
        const link = `${window.location.origin}/feed/${channelId}`;
        navigator.clipboard.writeText(link);
        alert('RSS Link copied to clipboard!');
    };

    return (
        <div className="space-y-8">
            {/* Add Channel Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                <form onSubmit={handleSubmit} className="flex gap-4">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste YouTube Channel URL (e.g. https://youtube.com/@channel)"
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-black dark:text-white bg-white dark:bg-gray-700 placeholder:text-gray-500 dark:placeholder:text-gray-400"
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
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{channel.title}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3">{channel.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                                <span>Updated: {new Date(channel.last_updated).toLocaleDateString()}</span>
                                <span className="font-mono bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400">ID: {channel.youtube_id}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                            <button
                                onClick={() => copyRssLink(channel.id)}
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
                        No channels added yet. Add one above!
                    </div>
                )}
            </div>
        </div>
    );
}
