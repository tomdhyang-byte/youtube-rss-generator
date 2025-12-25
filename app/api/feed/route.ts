import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { FeedItem } from '@/lib/types';
import { VideoQueryResult, EpisodeQueryResult } from '@/lib/types/feed';

/**
 * GET /api/feed
 * 
 * Web Feed API using Design B (locked styles).
 * Returns videos and episodes with their locked summary styles.
 */
export async function GET(request: Request) {
    // 1. Authentication Check
    const session = await getSession();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    try {
        const items: FeedItem[] = [];

        if (filter === 'all' || filter === 'youtube') {
            // Query videos with locked styles
            const videoItems = await prisma.$queryRaw<VideoQueryResult[]>`
                SELECT 
                    v.id,
                    v.title,
                    v.youtube_video_id,
                    v.published_at,
                    c.title as channel_title,
                    c.youtube_id as channel_youtube_id,
                    vs.content as summary,
                    uvs.style as locked_style
                FROM user_video_styles uvs
                INNER JOIN youtube_videos v ON v.id = uvs.video_id
                INNER JOIN youtube_channels c ON c.id = v.channel_id
                INNER JOIN video_summaries vs ON vs.video_id = v.id AND vs.style::text = uvs.style::text
                WHERE uvs.user_id = ${userId}
                ORDER BY v.published_at DESC
                LIMIT 50
            `;

            items.push(...videoItems.map(video => ({
                type: 'video' as const,
                id: video.youtube_video_id,
                title: video.title,
                source: video.channel_title,
                sourceId: video.channel_youtube_id,
                summary: video.summary || 'No summary available.',
                publishedAt: new Date(video.published_at).toISOString(),
                thumbnail: `https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg`,
                youtubeVideoId: video.youtube_video_id,
            })));
        }

        if (filter === 'all' || filter === 'podcast') {
            // Query episodes with locked styles
            const episodeItems = await prisma.$queryRaw<EpisodeQueryResult[]>`
                SELECT 
                    e.id,
                    e.title,
                    e.guid,
                    e.audio_url,
                    e.published_at,
                    p.title as podcast_title,
                    p.id as podcast_id,
                    p.image_url,
                    p.site_url,
                    es.content as summary,
                    ues.style as locked_style
                FROM user_episode_styles ues
                INNER JOIN podcast_episodes e ON e.id = ues.episode_id
                INNER JOIN podcast_channels p ON p.id = e.podcast_id
                INNER JOIN episode_summaries es ON es.episode_id = e.id AND es.style::text = ues.style::text
                WHERE ues.user_id = ${userId}
                ORDER BY e.published_at DESC
                LIMIT 50
            `;

            items.push(...episodeItems.map(episode => ({
                type: 'episode' as const,
                id: episode.id.toString(),
                title: episode.title,
                source: episode.podcast_title || 'Unknown Podcast',
                sourceId: episode.podcast_id.toString(),
                summary: episode.summary || '',
                publishedAt: new Date(episode.published_at).toISOString(),
                thumbnail: episode.image_url || null,
                audioUrl: episode.audio_url,
                siteUrl: episode.site_url,
            })));
        }

        // Sort combined items by publishedAt
        items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        return NextResponse.json({ items });

    } catch (error) {
        console.error('Error fetching feed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
