'use client';

import { Rss, ExternalLink, Trash2 } from 'lucide-react';
import { ChannelCardProps } from './types';

/**
 * Decode HTML entities in a string
 */
function decodeHtml(html: string): string {
    if (typeof window === 'undefined') return html;
    if (!html) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

/**
 * ChannelCard Component
 * Displays a single YouTube channel with action buttons.
 */
export function ChannelCard({
    channel,
    onUnsubscribe,
    onCopyRss,
    onLoginRequired,
    isAuthenticated,
    loading
}: ChannelCardProps) {
    const handleUnsubscribe = () => {
        if (!isAuthenticated) {
            onLoginRequired();
        } else {
            onUnsubscribe(channel.id, 'youtube', channel.title);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:border-blue-100 dark:hover:border-blue-900 transition-all w-full max-w-xl">
            <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {decodeHtml(channel.title)}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                    {channel.description ? decodeHtml(channel.description) : ''}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                    <span>Updated: {new Date(channel.last_updated).toLocaleDateString()}</span>
                </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
                <button
                    onClick={handleUnsubscribe}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                    title={!isAuthenticated ? "Sign in to manage subscriptions" : "Unsubscribe"}
                    disabled={loading}
                >
                    <Trash2 className="w-5 h-5" />
                </button>
                <button
                    onClick={() => onCopyRss(channel.id, 'youtube')}
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
    );
}
