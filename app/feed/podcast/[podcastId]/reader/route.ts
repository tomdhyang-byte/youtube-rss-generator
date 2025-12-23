import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import RSS from 'rss';

/**
 * TEST: Podcast RSS Feed WITHOUT enclosure tag
 * 
 * This feed is for testing whether removing <enclosure> fixes
 * Readwise Reader's HTML stripping behavior.
 * 
 * Usage: Subscribe to /feed/podcast/[id]/reader in Readwise Reader
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ podcastId: string }> }
) {
    try {
        const { podcastId } = await params;
        const id = parseInt(podcastId);

        if (isNaN(id)) {
            return new NextResponse('Invalid Podcast ID', { status: 400 });
        }

        const podcast = await prisma.podcastChannel.findUnique({
            where: { id },
            include: {
                episodes: {
                    orderBy: { published_at: 'desc' },
                    take: 20,
                },
            },
        });

        if (!podcast) {
            return new NextResponse('Podcast not found', { status: 404 });
        }

        const origin = new URL(request.url).origin;

        const feed = new RSS({
            title: `${podcast.title || 'Untitled Podcast'} (AI Summarized - Reader)`,
            description: `AI Summarized version of ${podcast.title}. Reader-optimized feed without audio enclosure. ${podcast.description || ''}`,
            feed_url: `${origin}/feed/podcast/${id}/reader`,
            site_url: podcast.site_url || origin,
            image_url: podcast.image_url || undefined,
            language: 'zh-TW',
            pubDate: podcast.last_updated,
        });

        podcast.episodes.forEach((episode) => {
            const summaryContent = episode.summary || 'No summary available.';

            feed.item({
                title: episode.title,
                description: summaryContent,
                url: `${origin}/episode/${episode.id}`,
                guid: `reader-${episode.guid}`,  // Different guid to avoid conflicts
                date: episode.published_at,
                // NO enclosure tag - this is the key difference
                custom_elements: [
                    { 'content:encoded': summaryContent },
                ],
            });
        });

        return new NextResponse(feed.xml({ indent: true }), {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });
    } catch (error) {
        console.error('Error generating reader RSS:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
