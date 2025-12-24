/**
 * ChannelManager Types
 * Shared type definitions for YouTube and Podcast channel management.
 */

// YouTube Channel from Prisma model
export interface YoutubeChannel {
    id: number;
    youtube_id: string;
    title: string;
    description: string | null;
    rss_url: string | null;
    last_updated: string;
}

// Podcast Channel from Prisma model
export interface PodcastChannel {
    id: number;
    feed_url: string;
    title: string | null;
    description: string | null;
    site_url: string | null;
    image_url: string | null;
    last_updated: Date;
}

// Props for the main ChannelManager component
export interface ChannelManagerProps {
    initialChannels: YoutubeChannel[];
    initialPodcasts: PodcastChannel[];
    quota?: {
        current: number;
        limit: number | null;
        isAdmin: boolean;
    };
    onRefresh?: (newChannel?: any) => void;
}

// Props for AddChannelForm component
export interface AddChannelFormProps {
    type: 'youtube' | 'podcast';
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    loading: boolean;
    canAddMore: boolean;
    error: string;
}

// Props for ChannelCard component
export interface ChannelCardProps {
    channel: YoutubeChannel;
    onUnsubscribe: (id: number, type: 'youtube' | 'podcast', name: string) => void;
    onCopyRss: (id: number, type: 'youtube' | 'podcast') => void;
    onLoginRequired: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

// Props for PodcastCard component
export interface PodcastCardProps {
    podcast: PodcastChannel;
    onUnsubscribe: (id: number, type: 'youtube' | 'podcast', name: string) => void;
    onCopyRss: (id: number, type: 'youtube' | 'podcast') => void;
    loading: boolean;
}
