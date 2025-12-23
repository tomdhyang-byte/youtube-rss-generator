import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { FeedItem } from '@/lib/types';

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
        // 2. Fetch content based on filter
        const items: FeedItem[] = [];

        if (filter === 'all' || filter === 'youtube') {
            const youtubeVideos = await prisma.youtubeVideo.findMany({
                where: {
                    channel: {
                        subscriptions: {
                            some: { userId }
                        }
                    }
                },
                include: {
                    channel: {
                        select: { title: true, youtube_id: true }
                    }
                },
                orderBy: { published_at: 'desc' },
                take: 50,
            });

            items.push(...youtubeVideos.map(video => ({
                type: 'video' as const,
                id: video.youtube_video_id,
                title: video.title,
                source: video.channel.title,
                sourceId: video.channel.youtube_id,
                summary: video.summary,
                publishedAt: video.published_at.toISOString(),
                thumbnail: `https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg`,
                youtubeVideoId: video.youtube_video_id,
            })));
        }

        if (filter === 'all' || filter === 'podcast') {
            const podcastEpisodes = await prisma.podcastEpisode.findMany({
                where: {
                    podcast: {
                        subscriptions: {
                            some: { userId }
                        }
                    },
                    summary: { not: null }
                },
                include: {
                    podcast: {
                        select: { title: true, image_url: true, id: true, site_url: true }
                    }
                },
                orderBy: { published_at: 'desc' },
                take: 50,
            });

            items.push(...podcastEpisodes.map(episode => ({
                type: 'episode' as const,
                id: episode.id.toString(),
                title: episode.title,
                source: episode.podcast.title || 'Unknown Podcast',
                sourceId: episode.podcast.id.toString(),
                summary: episode.summary || '',
                publishedAt: episode.published_at.toISOString(),
                thumbnail: episode.podcast.image_url || null,
                audioUrl: episode.audio_url,
                siteUrl: episode.podcast.site_url,
            })));
        }

        // 3. Sort combined items by publishedAt
        items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        return NextResponse.json({ items });

    } catch (error) {
        console.error('Error fetching feed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


