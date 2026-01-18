/**
 * Single Episode Service
 *
 * Business logic for managing single episode summaries.
 * Handles FIFO deletion when limit is reached, deduplication, and queue management.
 */

import { prisma } from '@/lib/prisma';
import type { SummaryStyle } from '@/lib/types/summary-style';
import type { SummaryLanguage } from '@/lib/types/summary-language';
import type { SingleEpisodeStatus } from '@prisma/client';

const SINGLE_EPISODE_LIMIT = 50;
const SINGLE_EPISODE_PRIORITY = 10;

export type SingleEpisodeType = 'video' | 'podcast';

export interface CreateSingleEpisodeParams {
    userId: string;
    type: SingleEpisodeType;
    videoId?: number;
    episodeId?: number;
    style: SummaryStyle;
    language: SummaryLanguage;
}

export interface SingleEpisodeResult {
    id: number;
    status: 'queued' | 'ready';
    linkedToSubscription: boolean;
    summary?: string;
}

export interface SingleEpisodeListItem {
    id: number;
    type: SingleEpisodeType;
    externalId: string;
    title: string;
    thumbnailUrl?: string;
    style: SummaryStyle;
    language: SummaryLanguage;
    status: SingleEpisodeStatus;
    failureReason?: string | null;
    createdAt: Date;
}

/**
 * Error codes for single episode operations
 */
export type SingleEpisodeError =
    | 'NOT_FOUND'
    | 'NOT_FAILED'
    | 'FORBIDDEN'
    | 'ALREADY_EXISTS';

/**
 * Check if an error code allows retry
 */
export function isRetryableError(failureReason: string | null | undefined): boolean {
    if (!failureReason) return false;

    const retryableCodes = ['API_ERROR', 'TRANSCRIPTION_ERROR', 'SUMMARIZATION_ERROR'];
    return retryableCodes.includes(failureReason);
}

/**
 * Get user-friendly error message for failure reason
 */
export function getErrorMessage(failureReason: string | null | undefined, locale: string = 'en'): string {
    const messages: Record<string, Record<string, string>> = {
        en: {
            NO_TRANSCRIPT: 'This video has no subtitles and cannot be summarized',
            AGE_RESTRICTED: 'This video is age-restricted and cannot be processed',
            REGION_BLOCKED: 'This video is not available in our server region',
            VIDEO_TOO_LONG: 'Videos longer than 4 hours are not supported',
            VIDEO_NOT_FOUND: 'This video does not exist or is private',
            API_ERROR: 'An error occurred, please try again later',
            TRANSCRIPTION_ERROR: 'Transcription service temporarily unavailable, please try again later',
            SUMMARIZATION_ERROR: 'Summary service temporarily unavailable, please try again later',
        },
        'zh-TW': {
            NO_TRANSCRIPT: '此影片沒有字幕，無法產生摘要',
            AGE_RESTRICTED: '此影片有年齡限制，無法處理',
            REGION_BLOCKED: '此影片在我們的伺服器所在地區無法播放',
            VIDEO_TOO_LONG: '影片長度超過 4 小時，暫不支援',
            VIDEO_NOT_FOUND: '影片不存在或已設為私人',
            API_ERROR: '處理時發生錯誤，請稍後再試',
            TRANSCRIPTION_ERROR: '轉錄服務暫時無法使用，請稍後再試',
            SUMMARIZATION_ERROR: '摘要服務暫時無法使用，請稍後再試',
        },
    };

    const langMessages = messages[locale] || messages.en;
    return langMessages[failureReason || ''] || langMessages.API_ERROR;
}

/**
 * Create or retrieve a single episode record with FIFO deletion.
 * Uses a transaction to prevent race conditions.
 */
export async function createSingleEpisode(
    params: CreateSingleEpisodeParams
): Promise<SingleEpisodeResult> {
    const { userId, type, videoId, episodeId, style, language } = params;

    // Validate polymorphic constraint
    if (type === 'video' && !videoId) {
        throw new Error('videoId is required for video type');
    }
    if (type === 'podcast' && !episodeId) {
        throw new Error('episodeId is required for podcast type');
    }

    return await prisma.$transaction(async (tx) => {
        // Check for existing record
        const existingRecord = await tx.userSingleEpisode.findFirst({
            where: {
                userId,
                ...(type === 'video' ? { videoId } : { episodeId }),
            },
        });

        if (existingRecord) {
            // Check if summary already exists with matching style/language
            const existingSummary = await findExistingSummary(tx, type, videoId, episodeId, style, language);

            return {
                id: existingRecord.id,
                status: existingSummary ? 'ready' : (existingRecord.status === 'COMPLETED' ? 'ready' : 'queued'),
                linkedToSubscription: await checkSubscriptionLink(tx, userId, type, videoId, episodeId),
                summary: existingSummary?.content,
            };
        }

        // Check current count
        const count = await tx.userSingleEpisode.count({
            where: { userId },
        });

        // FIFO deletion if at limit
        if (count >= SINGLE_EPISODE_LIMIT) {
            const oldest = await tx.userSingleEpisode.findFirst({
                where: { userId },
                orderBy: { createdAt: 'asc' },
            });
            if (oldest) {
                await tx.userSingleEpisode.delete({
                    where: { id: oldest.id },
                });
            }
        }

        // Check if summary already exists
        const existingSummary = await findExistingSummary(tx, type, videoId, episodeId, style, language);
        const initialStatus = existingSummary ? 'COMPLETED' : 'PENDING';

        // Create new record
        const newRecord = await tx.userSingleEpisode.create({
            data: {
                userId,
                videoId: type === 'video' ? videoId : null,
                episodeId: type === 'podcast' ? episodeId : null,
                style,
                language,
                status: initialStatus,
            },
        });

        // If no existing summary, add to processing queue
        if (!existingSummary) {
            await tx.processingQueue.create({
                data: {
                    type: type === 'video' ? 'SINGLE_VIDEO' : 'SINGLE_EPISODE',
                    entityId: type === 'video' ? videoId! : episodeId!,
                    priority: SINGLE_EPISODE_PRIORITY,
                    requestedByUserId: userId,
                    requestedStyle: style,
                    requestedLanguage: language,
                },
            });
        }

        return {
            id: newRecord.id,
            status: existingSummary ? 'ready' : 'queued',
            linkedToSubscription: await checkSubscriptionLink(tx, userId, type, videoId, episodeId),
            summary: existingSummary?.content,
        };
    });
}

/**
 * Get list of single episodes for a user
 */
export async function getSingleEpisodes(userId: string): Promise<{
    items: SingleEpisodeListItem[];
    total: number;
    limit: number;
}> {
    const records = await prisma.userSingleEpisode.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            video: {
                select: {
                    youtube_video_id: true,
                    title: true,
                },
            },
            episode: {
                select: {
                    guid: true,
                    title: true,
                },
            },
        },
    });

    const items: SingleEpisodeListItem[] = records.map((record) => {
        if (record.video) {
            return {
                id: record.id,
                type: 'video' as const,
                externalId: record.video.youtube_video_id,
                title: record.video.title,
                thumbnailUrl: `https://img.youtube.com/vi/${record.video.youtube_video_id}/mqdefault.jpg`,
                style: record.style as SummaryStyle,
                language: record.language as SummaryLanguage,
                status: record.status,
                failureReason: record.failureReason,
                createdAt: record.createdAt,
            };
        } else if (record.episode) {
            return {
                id: record.id,
                type: 'podcast' as const,
                externalId: record.episode.guid,
                title: record.episode.title,
                style: record.style as SummaryStyle,
                language: record.language as SummaryLanguage,
                status: record.status,
                failureReason: record.failureReason,
                createdAt: record.createdAt,
            };
        }
        throw new Error('Invalid record: neither video nor episode');
    });

    return {
        items,
        total: records.length,
        limit: SINGLE_EPISODE_LIMIT,
    };
}

/**
 * Delete a single episode record
 */
export async function deleteSingleEpisode(
    userId: string,
    id: number
): Promise<{ success: boolean; error?: SingleEpisodeError }> {
    const record = await prisma.userSingleEpisode.findUnique({
        where: { id },
    });

    if (!record) {
        return { success: false, error: 'NOT_FOUND' };
    }

    if (record.userId !== userId) {
        return { success: false, error: 'FORBIDDEN' };
    }

    await prisma.userSingleEpisode.delete({
        where: { id },
    });

    return { success: true };
}

/**
 * Retry a failed single episode
 */
export async function retrySingleEpisode(
    userId: string,
    id: number
): Promise<{ success: boolean; error?: SingleEpisodeError }> {
    const record = await prisma.userSingleEpisode.findUnique({
        where: { id },
    });

    if (!record) {
        return { success: false, error: 'NOT_FOUND' };
    }

    if (record.userId !== userId) {
        return { success: false, error: 'FORBIDDEN' };
    }

    if (record.status !== 'FAILED') {
        return { success: false, error: 'NOT_FAILED' };
    }

    await prisma.$transaction(async (tx) => {
        // Reset status
        await tx.userSingleEpisode.update({
            where: { id },
            data: {
                status: 'PENDING',
                failureReason: null,
            },
        });

        // Re-add to queue
        const type = record.videoId ? 'SINGLE_VIDEO' : 'SINGLE_EPISODE';
        const entityId = record.videoId || record.episodeId!;

        await tx.processingQueue.create({
            data: {
                type,
                entityId,
                priority: SINGLE_EPISODE_PRIORITY,
                requestedByUserId: userId,
                requestedStyle: record.style,
                requestedLanguage: record.language,
            },
        });
    });

    return { success: true };
}

// Helper functions

async function findExistingSummary(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    type: SingleEpisodeType,
    videoId: number | undefined,
    episodeId: number | undefined,
    style: SummaryStyle,
    language: SummaryLanguage
): Promise<{ content: string } | null> {
    if (type === 'video' && videoId) {
        return await tx.videoSummary.findFirst({
            where: { videoId, style, language },
            select: { content: true },
        });
    } else if (type === 'podcast' && episodeId) {
        return await tx.episodeSummary.findFirst({
            where: { episodeId, style, language },
            select: { content: true },
        });
    }
    return null;
}

async function checkSubscriptionLink(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    userId: string,
    type: SingleEpisodeType,
    videoId: number | undefined,
    episodeId: number | undefined
): Promise<boolean> {
    if (type === 'video' && videoId) {
        const video = await tx.youtubeVideo.findUnique({
            where: { id: videoId },
            select: { channel_id: true },
        });
        if (!video) return false;

        const subscription = await tx.youtubeSubscription.findFirst({
            where: { userId, channelId: video.channel_id },
        });
        return !!subscription;
    } else if (type === 'podcast' && episodeId) {
        const episode = await tx.podcastEpisode.findUnique({
            where: { id: episodeId },
            select: { podcast_id: true },
        });
        if (!episode) return false;

        const subscription = await tx.podcastSubscription.findFirst({
            where: { userId, podcastId: episode.podcast_id },
        });
        return !!subscription;
    }
    return false;
}
