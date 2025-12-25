/**
 * Feed Types
 * 
 * Type definitions for raw SQL query results in feed APIs.
 * These ensure type safety when using prisma.$queryRaw.
 */

import { SummaryStyle } from './summary-style';

/**
 * Result type for video queries with locked styles
 * Used by: /feed/user/[token], /api/feed
 */
export interface VideoQueryResult {
    id: number;
    title: string;
    youtube_video_id: string;
    published_at: Date;
    channel_title: string;
    channel_youtube_id: string;
    summary: string | null;
    locked_style: SummaryStyle;
}

/**
 * Result type for episode queries with locked styles
 * Used by: /feed/user/[token], /api/feed
 */
export interface EpisodeQueryResult {
    id: number;
    title: string;
    guid: string;
    audio_url: string;
    published_at: Date;
    podcast_title: string;
    podcast_id: number;
    feed_url?: string;
    image_url: string | null;
    site_url: string | null;
    summary: string | null;
    locked_style: SummaryStyle;
}
