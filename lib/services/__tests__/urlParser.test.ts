import {
    detectUrlType,
    parseYoutubeVideoUrl,
    parseYoutubeChannelUrl,
    parseApplePodcastsEpisodeUrl,
    parseApplePodcastsChannelUrl,
    parseSingleEpisodeUrl,
    parseChannelUrl,
} from '../urlParser';

describe('urlParser', () => {
    describe('detectUrlType', () => {
        it('detects YouTube video URL as episode', () => {
            expect(detectUrlType('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('episode');
            expect(detectUrlType('https://youtu.be/dQw4w9WgXcQ')).toBe('episode');
            expect(detectUrlType('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('episode');
        });

        it('detects YouTube Shorts URL as episode', () => {
            expect(detectUrlType('https://www.youtube.com/shorts/abc12345678')).toBe('episode');
        });

        it('detects YouTube channel URL as channel', () => {
            expect(detectUrlType('https://www.youtube.com/@channelname')).toBe('channel');
            expect(detectUrlType('https://www.youtube.com/channel/UCxxxxxx')).toBe('channel');
            expect(detectUrlType('https://www.youtube.com/c/channelname')).toBe('channel');
            expect(detectUrlType('https://www.youtube.com/user/username')).toBe('channel');
        });

        it('detects Apple Podcasts episode URL as episode', () => {
            expect(detectUrlType('https://podcasts.apple.com/us/podcast/example/id123/episode/id456')).toBe('episode');
        });

        it('detects Apple Podcasts channel URL as channel', () => {
            expect(detectUrlType('https://podcasts.apple.com/us/podcast/example/id123')).toBe('channel');
        });

        it('returns unknown for invalid URLs', () => {
            expect(detectUrlType('not a url')).toBe('unknown');
            expect(detectUrlType('https://example.com')).toBe('unknown');
        });
    });

    describe('parseYoutubeVideoUrl', () => {
        it('parses standard YouTube video URL', () => {
            const result = parseYoutubeVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result).toEqual({
                success: true,
                type: 'youtube_video',
                videoId: 'dQw4w9WgXcQ',
            });
        });

        it('parses YouTube short URL (youtu.be)', () => {
            const result = parseYoutubeVideoUrl('https://youtu.be/dQw4w9WgXcQ');
            expect(result).toEqual({
                success: true,
                type: 'youtube_video',
                videoId: 'dQw4w9WgXcQ',
            });
        });

        it('parses YouTube Music URL', () => {
            const result = parseYoutubeVideoUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result).toEqual({
                success: true,
                type: 'youtube_video',
                videoId: 'dQw4w9WgXcQ',
            });
        });

        it('ignores playlist parameter and extracts video ID', () => {
            const result = parseYoutubeVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxxxx');
            expect(result).toEqual({
                success: true,
                type: 'youtube_video',
                videoId: 'dQw4w9WgXcQ',
            });
        });

        it('rejects YouTube Shorts URL', () => {
            const result = parseYoutubeVideoUrl('https://www.youtube.com/shorts/abc12345678');
            expect(result).toEqual({
                success: false,
                error: 'SHORTS_NOT_SUPPORTED',
            });
        });

        it('rejects invalid video ID', () => {
            const result = parseYoutubeVideoUrl('https://www.youtube.com/watch?v=invalid');
            expect(result).toEqual({
                success: false,
                error: 'INVALID_URL',
            });
        });

        it('rejects non-YouTube URL', () => {
            const result = parseYoutubeVideoUrl('https://vimeo.com/123456');
            expect(result).toEqual({
                success: false,
                error: 'INVALID_URL',
            });
        });

        it('rejects malformed URL', () => {
            const result = parseYoutubeVideoUrl('not a url');
            expect(result).toEqual({
                success: false,
                error: 'INVALID_URL',
            });
        });
    });

    describe('parseYoutubeChannelUrl', () => {
        it('parses @username format', () => {
            const result = parseYoutubeChannelUrl('https://www.youtube.com/@channelname');
            expect(result).toEqual({
                success: true,
                type: 'youtube_channel',
                channelId: '@channelname',
            });
        });

        it('parses /channel/UC... format', () => {
            const result = parseYoutubeChannelUrl('https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx');
            expect(result).toEqual({
                success: true,
                type: 'youtube_channel',
                channelId: 'UCxxxxxxxxxxxxxxxxxxxxxx',
            });
        });

        it('parses /c/name format', () => {
            const result = parseYoutubeChannelUrl('https://www.youtube.com/c/channelname');
            expect(result).toEqual({
                success: true,
                type: 'youtube_channel',
                channelId: '/c/channelname',
            });
        });

        it('parses /user/name format', () => {
            const result = parseYoutubeChannelUrl('https://www.youtube.com/user/username');
            expect(result).toEqual({
                success: true,
                type: 'youtube_channel',
                channelId: '/user/username',
            });
        });

        it('rejects video URL', () => {
            const result = parseYoutubeChannelUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result).toEqual({
                success: false,
                error: 'INVALID_URL',
            });
        });
    });

    describe('parseApplePodcastsEpisodeUrl', () => {
        it('parses Apple Podcasts episode URL', () => {
            const url = 'https://podcasts.apple.com/us/podcast/example-show/id123456/episode/episode-title/id789';
            const result = parseApplePodcastsEpisodeUrl(url);
            expect(result).toEqual({
                success: true,
                type: 'podcast_episode',
                episodeUrl: url,
            });
        });

        it('rejects Apple Podcasts channel URL (no /episode/)', () => {
            const result = parseApplePodcastsEpisodeUrl('https://podcasts.apple.com/us/podcast/example-show/id123456');
            expect(result).toEqual({
                success: false,
                error: 'INVALID_URL',
            });
        });

        it('rejects non-Apple Podcasts URL', () => {
            const result = parseApplePodcastsEpisodeUrl('https://spotify.com/episode/xyz');
            expect(result).toEqual({
                success: false,
                error: 'INVALID_URL',
            });
        });
    });

    describe('parseApplePodcastsChannelUrl', () => {
        it('parses Apple Podcasts channel URL', () => {
            const url = 'https://podcasts.apple.com/us/podcast/example-show/id123456';
            const result = parseApplePodcastsChannelUrl(url);
            expect(result).toEqual({
                success: true,
                type: 'podcast_channel',
                feedUrl: url,
            });
        });

        it('rejects Apple Podcasts episode URL', () => {
            const result = parseApplePodcastsChannelUrl('https://podcasts.apple.com/us/podcast/example-show/id123456/episode/ep1/id789');
            expect(result).toEqual({
                success: false,
                error: 'INVALID_URL',
            });
        });
    });

    describe('parseSingleEpisodeUrl', () => {
        it('parses YouTube video URL', () => {
            const result = parseSingleEpisodeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.type).toBe('youtube_video');
            }
        });

        it('parses Apple Podcasts episode URL', () => {
            const url = 'https://podcasts.apple.com/us/podcast/show/id123/episode/ep/id456';
            const result = parseSingleEpisodeUrl(url);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.type).toBe('podcast_episode');
            }
        });

        it('returns SHORTS_NOT_SUPPORTED for Shorts', () => {
            const result = parseSingleEpisodeUrl('https://www.youtube.com/shorts/abc12345678');
            expect(result).toEqual({
                success: false,
                error: 'SHORTS_NOT_SUPPORTED',
            });
        });

        it('returns INVALID_URL for unsupported URLs', () => {
            const result = parseSingleEpisodeUrl('https://example.com/video');
            expect(result).toEqual({
                success: false,
                error: 'INVALID_URL',
            });
        });
    });

    describe('parseChannelUrl', () => {
        it('parses YouTube channel URL', () => {
            const result = parseChannelUrl('https://www.youtube.com/@channelname');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.type).toBe('youtube_channel');
            }
        });

        it('parses Apple Podcasts channel URL', () => {
            const url = 'https://podcasts.apple.com/us/podcast/show/id123';
            const result = parseChannelUrl(url);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.type).toBe('podcast_channel');
            }
        });

        it('returns INVALID_URL for video URLs', () => {
            const result = parseChannelUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(result).toEqual({
                success: false,
                error: 'INVALID_URL',
            });
        });
    });
});
