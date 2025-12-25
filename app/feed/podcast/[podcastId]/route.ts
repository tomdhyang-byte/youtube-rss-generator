import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import RSS from 'rss';

const prisma = new PrismaClient();

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
                    include: {
                        summaries: true, // Include all summaries
                    },
                    orderBy: { published_at: 'desc' },
                    take: 20,
                },
            },
        });

        if (!podcast) {
            return new NextResponse('Podcast not found', { status: 404 });
        }

        const feed = new RSS({
            title: `${podcast.title || 'Untitled Podcast'} (AI Summarized)`,
            description: `AI Summarized version of ${podcast.title}. ${podcast.description || ''}`,
            feed_url: `${new URL(request.url).origin}/feed/podcast/${id}`,
            site_url: podcast.site_url || new URL(request.url).origin,
            image_url: podcast.image_url || undefined,
            language: 'zh-TW',
            pubDate: podcast.last_updated,
        });

        const origin = new URL(request.url).origin;

        podcast.episodes.forEach((episode) => {
            // Get the DEFAULT summary, or any available summary
            const summary = episode.summaries.find(
                (s: { style: string; content: string }) => s.style === 'DEFAULT'
            ) || episode.summaries[0];
            const summaryContent = summary?.content || 'No summary available.';

            feed.item({
                title: episode.title,
                description: summaryContent,
                url: `${origin}/episode/${episode.id}`,
                guid: episode.guid,
                date: episode.published_at,
                custom_elements: [
                    { 'content:encoded': summaryContent },
                ],
            });
        });

        return new NextResponse(feed.xml({ indent: true }), {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate',
            },
        });
    } catch (error) {
        console.error('Error generating RSS:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

