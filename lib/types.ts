// Shared type definitions for the application

export interface Channel {
    id: number;
    youtube_id: string;
    title: string;
    description: string | null;
    rss_url: string | null;
    last_updated: string;
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
