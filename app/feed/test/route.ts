import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import RSS from 'rss';

/**
 * TEST RSS Feed
 * 
 * This feed is for testing whether Readwise Reader will correctly
 * display content when <link> points to our own page instead of YouTube.
 * 
 * Usage: Subscribe to /feed/test in Readwise Reader
 */
export async function GET(request: Request) {
    try {
        const origin = new URL(request.url).origin;

        // Get the first 3 videos from any channel (for testing)
        const videos = await prisma.youtubeVideo.findMany({
            take: 3,
            orderBy: { published_at: 'desc' },
            include: { channel: true },
        });

        const feed = new RSS({
            title: '[TEST] AI Summarized Videos',
            description: 'This is a test feed to verify Readwise Reader behavior. Links point to our custom summary pages instead of YouTube.',
            feed_url: `${origin}/feed/test`,
            site_url: origin,
            language: 'zh-TW',
            pubDate: new Date(),
        });

        if (videos.length === 0) {
            // Add a dummy item if no videos exist
            feed.item({
                title: 'Test Item - No Videos Found',
                description: '<p>This is a test item. No videos have been processed yet.</p>',
                url: origin,
                guid: 'test-item-no-videos',
                date: new Date(),
                author: 'Test',
                custom_elements: [
                    { 'content:encoded': '<p>This is a test item. No videos have been processed yet.</p>' },
                ],
            });
        } else {
            videos.forEach((video) => {
                const summaryContent = video.summary || 'No summary available.';

                // Key difference: link points to OUR summary page, not YouTube
                const summaryPageUrl = `${origin}/video/${video.youtube_video_id}`;

                feed.item({
                    title: video.title,
                    description: summaryContent,
                    url: summaryPageUrl,  // ← Points to our page, not YouTube
                    guid: `test-${video.youtube_video_id}`,  // Different guid to avoid conflict
                    date: video.published_at,
                    author: video.channel.title,
                    custom_elements: [
                        { 'content:encoded': summaryContent },
                    ],
                });
            });
        }

        return new NextResponse(feed.xml({ indent: true }), {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });
    } catch (error) {
        console.error('Error generating test RSS:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
