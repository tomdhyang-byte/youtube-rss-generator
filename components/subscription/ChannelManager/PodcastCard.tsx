'use client';

import { Rss, ExternalLink, Trash2 } from 'lucide-react';
import { PodcastCardProps } from './types';

/**
 * PodcastCard Component
 * Displays a single podcast with action buttons.
 */
export function PodcastCard({
    podcast,
    onUnsubscribe,
    onCopyRss,
    loading
}: PodcastCardProps) {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:border-purple-100 dark:hover:border-purple-900 transition-all w-full max-w-xl">
            <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {podcast.title || 'Untitled Podcast'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                    {podcast.description || ''}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                    <span>Updated: {new Date(podcast.last_updated).toLocaleDateString()}</span>
                </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
                <button
                    onClick={() => onUnsubscribe(podcast.id, 'podcast', podcast.title || 'this podcast')}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                    title="Unsubscribe"
                    disabled={loading}
                >
                    <Trash2 className="w-5 h-5" />
                </button>
                <button
                    onClick={() => onCopyRss(podcast.id, 'podcast')}
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
    );
}
