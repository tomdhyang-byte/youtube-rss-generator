/**
 * URL Parser Service
 *
 * Parses and validates YouTube and Podcast URLs for the single episode feature.
 * Supports:
 * - YouTube video URLs (standard, short, music)
 * - Apple Podcasts episode URLs
 *
 * Rejects:
 * - YouTube Shorts
 * - Invalid URLs
 */

export type UrlType =
    | 'youtube_channel'
    | 'youtube_video'
    | 'podcast_channel'
    | 'podcast_episode';

export type ParseResult =
    | { success: true; type: 'youtube_video'; videoId: string }
    | { success: true; type: 'youtube_channel'; channelId: string }
    | { success: true; type: 'podcast_episode'; episodeUrl: string }
    | { success: true; type: 'podcast_channel'; feedUrl: string }
    | { success: false; error: UrlParseError };

export type UrlParseError =
    | 'INVALID_URL'
    | 'SHORTS_NOT_SUPPORTED'
    | 'UNSUPPORTED_PLATFORM';

/**
 * Detect the type of URL (channel vs single episode)
 */
export function detectUrlType(url: string): 'channel' | 'episode' | 'unknown' {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        // YouTube
        if (isYouTubeHost(hostname)) {
            const pathname = parsed.pathname;

            // Video URLs
            if (pathname.startsWith('/watch') ||
                pathname.startsWith('/shorts/') ||
                hostname === 'youtu.be') {
                return 'episode';
            }

            // Channel URLs
            if (pathname.startsWith('/@') ||
                pathname.startsWith('/channel/') ||
                pathname.startsWith('/c/') ||
                pathname.startsWith('/user/')) {
                return 'channel';
            }
        }

        // Apple Podcasts
        if (hostname.includes('podcasts.apple.com')) {
            // Episode URLs contain /episode/
            if (parsed.pathname.includes('/episode/')) {
                return 'episode';
            }
            // Podcast (channel) URLs contain /podcast/ but not /episode/
            if (parsed.pathname.includes('/podcast/')) {
                return 'channel';
            }
        }

        return 'unknown';
    } catch {
        return 'unknown';
    }
}

/**
 * Parse a YouTube video URL and extract the video ID
 */
export function parseYoutubeVideoUrl(url: string): ParseResult {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        if (!isYouTubeHost(hostname)) {
            return { success: false, error: 'INVALID_URL' };
        }

        const pathname = parsed.pathname;

        // Reject YouTube Shorts
        if (pathname.startsWith('/shorts/')) {
            return { success: false, error: 'SHORTS_NOT_SUPPORTED' };
        }

        // Standard video URL: youtube.com/watch?v=xxx
        // Also handles: music.youtube.com/watch?v=xxx
        if (pathname.startsWith('/watch')) {
            const videoId = parsed.searchParams.get('v');
            if (videoId && isValidVideoId(videoId)) {
                return { success: true, type: 'youtube_video', videoId };
            }
            return { success: false, error: 'INVALID_URL' };
        }

        // Short URL: youtu.be/xxx
        if (hostname === 'youtu.be') {
            const videoId = pathname.slice(1); // Remove leading /
            if (videoId && isValidVideoId(videoId)) {
                return { success: true, type: 'youtube_video', videoId };
            }
            return { success: false, error: 'INVALID_URL' };
        }

        return { success: false, error: 'INVALID_URL' };
    } catch {
        return { success: false, error: 'INVALID_URL' };
    }
}

/**
 * Parse a YouTube channel URL and extract the channel identifier
 */
export function parseYoutubeChannelUrl(url: string): ParseResult {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        if (!isYouTubeHost(hostname)) {
            return { success: false, error: 'INVALID_URL' };
        }

        const pathname = parsed.pathname;

        // Handle @username format
        if (pathname.startsWith('/@')) {
            const handle = pathname.slice(2).split('/')[0];
            if (handle) {
                return { success: true, type: 'youtube_channel', channelId: `@${handle}` };
            }
        }

        // Handle /channel/UC... format
        if (pathname.startsWith('/channel/')) {
            const channelId = pathname.slice('/channel/'.length).split('/')[0];
            if (channelId && channelId.startsWith('UC')) {
                return { success: true, type: 'youtube_channel', channelId };
            }
        }

        // Handle /c/channelname format (legacy)
        if (pathname.startsWith('/c/')) {
            const channelName = pathname.slice(3).split('/')[0];
            if (channelName) {
                return { success: true, type: 'youtube_channel', channelId: `/c/${channelName}` };
            }
        }

        // Handle /user/username format (legacy)
        if (pathname.startsWith('/user/')) {
            const username = pathname.slice(6).split('/')[0];
            if (username) {
                return { success: true, type: 'youtube_channel', channelId: `/user/${username}` };
            }
        }

        return { success: false, error: 'INVALID_URL' };
    } catch {
        return { success: false, error: 'INVALID_URL' };
    }
}

/**
 * Parse an Apple Podcasts episode URL
 */
export function parseApplePodcastsEpisodeUrl(url: string): ParseResult {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        if (!hostname.includes('podcasts.apple.com')) {
            return { success: false, error: 'INVALID_URL' };
        }

        // Episode URLs should contain /episode/
        if (parsed.pathname.includes('/episode/')) {
            return { success: true, type: 'podcast_episode', episodeUrl: url };
        }

        return { success: false, error: 'INVALID_URL' };
    } catch {
        return { success: false, error: 'INVALID_URL' };
    }
}

/**
 * Parse an Apple Podcasts channel (podcast) URL
 */
export function parseApplePodcastsChannelUrl(url: string): ParseResult {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        if (!hostname.includes('podcasts.apple.com')) {
            return { success: false, error: 'INVALID_URL' };
        }

        // Channel URLs contain /podcast/ but not /episode/
        if (parsed.pathname.includes('/podcast/') && !parsed.pathname.includes('/episode/')) {
            return { success: true, type: 'podcast_channel', feedUrl: url };
        }

        return { success: false, error: 'INVALID_URL' };
    } catch {
        return { success: false, error: 'INVALID_URL' };
    }
}

/**
 * Parse any single episode URL (YouTube video or Podcast episode)
 */
export function parseSingleEpisodeUrl(url: string): ParseResult {
    // Try YouTube video first
    const youtubeResult = parseYoutubeVideoUrl(url);
    if (youtubeResult.success) {
        return youtubeResult;
    }

    // If it was a Shorts URL, return that specific error
    if (!youtubeResult.success && youtubeResult.error === 'SHORTS_NOT_SUPPORTED') {
        return youtubeResult;
    }

    // Try Apple Podcasts episode
    const podcastResult = parseApplePodcastsEpisodeUrl(url);
    if (podcastResult.success) {
        return podcastResult;
    }

    // Neither worked
    return { success: false, error: 'INVALID_URL' };
}

/**
 * Parse any channel URL (YouTube channel or Podcast channel)
 */
export function parseChannelUrl(url: string): ParseResult {
    // Try YouTube channel first
    const youtubeResult = parseYoutubeChannelUrl(url);
    if (youtubeResult.success) {
        return youtubeResult;
    }

    // Try Apple Podcasts channel
    const podcastResult = parseApplePodcastsChannelUrl(url);
    if (podcastResult.success) {
        return podcastResult;
    }

    return { success: false, error: 'INVALID_URL' };
}

// Helper functions

function isYouTubeHost(hostname: string): boolean {
    return (
        hostname === 'youtube.com' ||
        hostname === 'www.youtube.com' ||
        hostname === 'm.youtube.com' ||
        hostname === 'music.youtube.com' ||
        hostname === 'youtu.be'
    );
}

function isValidVideoId(videoId: string): boolean {
    // YouTube video IDs are 11 characters, alphanumeric with - and _
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}
