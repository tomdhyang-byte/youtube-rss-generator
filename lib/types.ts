// Shared type definitions for the application

export interface YoutubeChannel {
    id: number;
    youtube_id: string;
    title: string;
    description: string | null;
    rss_url: string | null;
    last_updated: string;
}

// Alias for backward compatibility if needed, or prefer YoutubeChannel
export type Channel = YoutubeChannel;

export interface PodcastChannel {
    id: number;
    feed_url: string;
    title: string | null;
    description: string | null;
    site_url: string | null;
    image_url: string | null;
    last_updated: string; // Serialized date from API
}

export interface GuestChannel {
    id: number; // Negative ID for guest channels
    youtube_id: string;
    title: string;
    description: string | null;
    rss_url: string | null;
    last_updated: string;
    url: string; // Store original URL for sync
    cached_metadata?: { // Cache fetched metadata for faster sync
        youtube_id: string;
        title: string;
        description: string | null;
    };
}

export interface FeedItem {
    type: 'video' | 'episode';
    id: string;
    title: string;
    source: string;
    sourceId: string;
    summary: string;
    publishedAt: string;
    thumbnail: string | null;
    youtubeVideoId?: string;
    audioUrl?: string;
    siteUrl?: string | null;
    isSingleEpisode?: boolean;
    singleEpisodeStyle?: string;
    singleEpisodeLanguage?: string;
}

// Single Episode Types
export type SingleEpisodeStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface SingleEpisodeItem {
    id: number;
    type: 'video' | 'podcast';
    externalId: string;
    title: string;
    thumbnailUrl?: string;
    style: string;
    language: string;
    status: SingleEpisodeStatus;
    failureReason?: string | null;
    createdAt: string;
}
