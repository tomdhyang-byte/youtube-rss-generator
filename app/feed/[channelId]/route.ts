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

        const channel = await prisma.youtubeChannel.findUnique({
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
            image_url: '', // We could fetch the avatar if we stored it
            language: 'en',
            pubDate: channel.last_updated,
        });

        // Add welcome message if no videos yet
        if (channel.videos.length === 0) {
            feed.item({
                title: "Welcome to Your RSS Feed!",
                description: "This feed is empty because no videos have been processed yet. Our AI worker processes new channels every few hours. Please check back in a few minutes, or up to 6 hours for the first update. Thank you for your patience!",
                url: `https://www.youtube.com/channel/${channel.youtube_id}`,
                guid: `welcome-msg-channel-${channelId}`,
                date: channel.last_updated,
                author: channel.title,
            });
        }

        const origin = new URL(request.url).origin;

        channel.videos.forEach((video: any) => {
            const summaryContent = video.summary || 'No summary available.';

            feed.item({
                title: video.title,
                description: summaryContent,
                // Link to our summary page instead of YouTube
                // This prevents RSS readers from fetching content from YouTube
                url: `${origin}/video/${video.youtube_video_id}`,
                guid: video.youtube_video_id,
                date: video.published_at,
                author: channel.title,
                custom_elements: [
                    { 'content:encoded': summaryContent },
                ],
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
