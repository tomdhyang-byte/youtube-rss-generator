import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import RSS from 'rss';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ channelId: string }> }
) {
    try {
        const { channelId: channelIdStr } = await params;
        const channelId = parseInt(channelIdStr);

        if (isNaN(channelId)) {
            return new NextResponse('Invalid Channel ID', { status: 400 });
        }

        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            include: {
                videos: {
                    orderBy: { published_at: 'desc' },
                    take: 20, // Limit to latest 20 videos for the feed
                },
            },
        });

        if (!channel) {
            return new NextResponse('Channel not found', { status: 404 });
        }

        const feed = new RSS({
            title: `${channel.title} (AI Summarized)`,
            description: channel.description || `AI Summaries for ${channel.title}`,
            feed_url: `${new URL(request.url).origin}/feed/${channelId}`,
            site_url: `https://www.youtube.com/channel/${channel.youtube_id}`,
            image_url: channel.avatar_url || '', // Use channel avatar from YouTube
            language: 'en',
            pubDate: channel.last_updated,
        });

        channel.videos.forEach((video: any) => {
            feed.item({
                title: video.title,
                description: video.summary, // The AI summary
                url: `https://www.youtube.com/watch?v=${video.youtube_video_id}`,
                guid: video.youtube_video_id,
                date: video.published_at,
                author: channel.title,
            });
        });

        return new NextResponse(feed.xml({ indent: true }), {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 's-maxage=0, no-cache, no-store, must-revalidate', // Disable cache for testing
            },
        });

    } catch (error) {
        console.error('Error generating feed:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
