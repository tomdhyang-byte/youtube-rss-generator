'use client';

import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle, AlertCircle, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { SingleEpisodeStatus as Status } from '@/lib/types';

interface SingleEpisodeStatusProps {
    status: Status;
    failureReason?: string | null;
    externalId: string;
    type: 'video' | 'podcast';
    onRetry?: () => void;
    onDelete?: () => void;
    onView?: () => void;
    loading?: boolean;
}

/**
 * Error code to i18n key mapping
 */
const ERROR_KEY_MAP: Record<string, string> = {
    NO_TRANSCRIPT: 'error_no_transcript',
    AGE_RESTRICTED: 'error_age_restricted',
    REGION_BLOCKED: 'error_region_blocked',
    VIDEO_TOO_LONG: 'error_video_too_long',
    VIDEO_NOT_FOUND: 'error_video_not_found',
    SHORTS_NOT_SUPPORTED: 'error_shorts_not_supported',
    API_ERROR: 'error_api_error',
    TRANSCRIPTION_ERROR: 'error_transcription_error',
    SUMMARIZATION_ERROR: 'error_summarization_error',
    FEATURE_DISABLED: 'error_feature_disabled',
};

/**
 * Determine if error is retryable
 */
function isRetryable(failureReason: string | null | undefined): boolean {
    if (!failureReason) return false;
    const retryableCodes = ['API_ERROR', 'TRANSCRIPTION_ERROR', 'SUMMARIZATION_ERROR'];
    return retryableCodes.includes(failureReason);
}

/**
 * SingleEpisodeStatus Component
 * Displays the processing status of a single episode with appropriate actions.
 */
export function SingleEpisodeStatus({
    status,
    failureReason,
    externalId,
    type,
    onRetry,
    onDelete,
    onView,
    loading,
}: SingleEpisodeStatusProps) {
    const t = useTranslations('Subscriptions');

    // Build view URL
    const viewUrl = type === 'video'
        ? `/video/${externalId}`
        : `/episode/${externalId}`;

    const renderStatus = () => {
        switch (status) {
            case 'PENDING':
                return (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">{t('single_episode_queued')}</span>
                    </div>
                );

            case 'PROCESSING':
                return (
                    <div className="flex items-center gap-2 text-primary">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">{t('single_episode_processing')}</span>
                    </div>
                );

            case 'COMPLETED':
                return (
                    <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">{t('single_episode_completed')}</span>
                        {onView && (
                            <a
                                href={viewUrl}
                                className="ml-2 text-primary hover:underline text-sm flex items-center gap-1"
                            >
                                {t('single_episode_view')}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </div>
                );

            case 'FAILED':
                const errorKey = failureReason ? ERROR_KEY_MAP[failureReason] : 'error_api_error';
                const errorMessage = errorKey ? t(errorKey) : failureReason || t('error_api_error');
                const canRetry = isRetryable(failureReason);

                return (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">{errorMessage}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {canRetry && onRetry && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onRetry}
                                    disabled={loading}
                                    leftIcon={<RefreshCw className="w-3 h-3" />}
                                >
                                    {t('single_episode_retry')}
                                </Button>
                            )}
                            {onDelete && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onDelete}
                                    disabled={loading}
                                    leftIcon={<Trash2 className="w-3 h-3" />}
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    {t('single_episode_delete')}
                                </Button>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="py-2">
            {renderStatus()}
        </div>
    );
}
