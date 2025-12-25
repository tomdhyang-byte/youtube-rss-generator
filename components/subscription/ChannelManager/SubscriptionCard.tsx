import React from 'react';
import { Rss, ExternalLink, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { StyleSelector, SummaryStyle } from '@/components/ui/StyleSelector';
import { LanguageSelector, SummaryLanguage } from '@/components/ui/LanguageSelector';
import { cn } from '@/lib/utils';
import { useFormatter, useTranslations } from 'next-intl';

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
    /** Current summary style */
    summaryStyle?: SummaryStyle;
    /** Current summary language */
    summaryLanguage?: SummaryLanguage;
    /** Called when unsubscribe button is clicked */
    onUnsubscribe: () => void;
    /** Called when RSS copy button is clicked */
    onCopyRss: () => void;
    /** Called when summary style is changed */
    onStyleChange?: (newStyle: SummaryStyle) => void;
    /** Called when summary language is changed */
    onLanguageChange?: (newLanguage: SummaryLanguage) => void;
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
 * Includes selectors for summary style and language.
 */
export function SubscriptionCard({
    type,
    id,
    title,
    description,
    lastUpdated,
    externalUrl,
    summaryStyle = 'DEFAULT',
    summaryLanguage = 'ZH_TW',
    onUnsubscribe,
    onCopyRss,
    onStyleChange,
    onLanguageChange,
    onLoginRequired,
    isAuthenticated = true,
    loading = false,
}: SubscriptionCardProps) {
    const t = useTranslations('Subscriptions');
    const format = useFormatter();

    const handleUnsubscribe = () => {
        if (onLoginRequired && !isAuthenticated) {
            onLoginRequired();
        } else {
            onUnsubscribe();
        }
    };

    const formattedDate = format.dateTime(new Date(lastUpdated), { dateStyle: 'medium' });

    return (
        <div
            className={cn(
                "bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700",
                "flex flex-col gap-4 group transition-all w-full max-w-xl",
                type === 'youtube'
                    ? "hover:border-blue-100 dark:hover:border-blue-900"
                    : "hover:border-purple-100 dark:hover:border-purple-900"
            )}
        >
            {/* Header Row: Title + Actions */}
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                        {decodeHtml(title)}
                    </h3>
                    {description && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2">
                            {decodeHtml(description)}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                    <IconButton
                        aria-label={!isAuthenticated && onLoginRequired ? "Sign in to manage subscriptions" : t('unsubscribe')}
                        variant="danger"
                        onClick={handleUnsubscribe}
                        disabled={loading}
                    >
                        <Trash2 className="w-5 h-5" />
                    </IconButton>
                    <IconButton
                        aria-label={t('copy_rss')}
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
                            title={type === 'youtube' ? t('open_youtube') : t('open_website')}
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                    )}
                </div>
            </div>

            {/* Footer Row: Date + Settings */}
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    {t('updated')}: {formattedDate}
                </span>

                <div className="flex items-center gap-2">
                    {onLanguageChange && (
                        <LanguageSelector
                            value={summaryLanguage}
                            onChange={onLanguageChange}
                            disabled={loading}
                        />
                    )}
                    {onStyleChange && (
                        <StyleSelector
                            value={summaryStyle}
                            onChange={onStyleChange}
                            disabled={loading}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

