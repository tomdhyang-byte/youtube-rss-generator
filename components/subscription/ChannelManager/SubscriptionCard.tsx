'use client';

import { Rss, ExternalLink, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

export interface SubscriptionCardProps {
    /** Type of subscription - determines color theme */
    type: 'youtube' | 'podcast';
    /** Subscription ID */
    id: number;
    /** Title of the channel/podcast */
    title: string;
    /** Description (optional) */
    description?: string | null;
    /** Last updated date */
    lastUpdated: string | Date;
    /** External URL (YouTube channel or podcast website) */
    externalUrl?: string | null;
    /** Called when unsubscribe button is clicked */
    onUnsubscribe: () => void;
    /** Called when RSS copy button is clicked */
    onCopyRss: () => void;
    /** Optional: Called when unauthenticated user tries to unsubscribe */
    onLoginRequired?: () => void;
    /** Whether user is authenticated (only needed if onLoginRequired is provided) */
    isAuthenticated?: boolean;
    /** Whether an operation is in progress */
    loading?: boolean;
}

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
 * SubscriptionCard Component
 * 
 * A unified card component for displaying YouTube channels and Podcasts.
 * 
 * @example
 * <SubscriptionCard
 *   type="youtube"
 *   id={channel.id}
 *   title={channel.title}
 *   description={channel.description}
 *   lastUpdated={channel.last_updated}
 *   externalUrl={`https://youtube.com/channel/${channel.youtube_id}`}
 *   onUnsubscribe={() => handleUnsubscribe(channel.id)}
 *   onCopyRss={() => handleCopyRss(channel.id)}
 * />
 */
export function SubscriptionCard({
    type,
    id,
    title,
    description,
    lastUpdated,
    externalUrl,
    onUnsubscribe,
    onCopyRss,
    onLoginRequired,
    isAuthenticated = true,
    loading = false,
}: SubscriptionCardProps) {
    const handleUnsubscribe = () => {
        if (onLoginRequired && !isAuthenticated) {
            onLoginRequired();
        } else {
            onUnsubscribe();
        }
    };

    const formattedDate = new Date(lastUpdated).toLocaleDateString();

    return (
        <div
            className={cn(
                "bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700",
                "flex items-center justify-between group transition-all w-full max-w-xl",
                type === 'youtube'
                    ? "hover:border-blue-100 dark:hover:border-blue-900"
                    : "hover:border-purple-100 dark:hover:border-purple-900"
            )}
        >
            <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {decodeHtml(title)}
                </h3>
                {description && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                        {decodeHtml(description)}
                    </p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                    <span>Updated: {formattedDate}</span>
                </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
                <IconButton
                    aria-label={!isAuthenticated && onLoginRequired ? "Sign in to manage subscriptions" : "Unsubscribe"}
                    variant="danger"
                    onClick={handleUnsubscribe}
                    disabled={loading}
                >
                    <Trash2 className="w-5 h-5" />
                </IconButton>
                <IconButton
                    aria-label="Copy RSS Link"
                    variant="warning"
                    onClick={onCopyRss}
                >
                    <Rss className="w-5 h-5" />
                </IconButton>
                {externalUrl && (
                    <a
                        href={externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        title={type === 'youtube' ? "Open in YouTube" : "Open Website"}
                    >
                        <ExternalLink className="w-5 h-5" />
                    </a>
                )}
            </div>
        </div>
    );
}
