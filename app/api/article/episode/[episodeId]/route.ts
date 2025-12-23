import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface RouteParams {
    params: Promise<{ episodeId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    const { episodeId } = await params;
    const id = parseInt(episodeId);

    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid episode ID' }, { status: 400 });
    }

    try {
        const episode = await prisma.podcastEpisode.findUnique({
            where: { id },
            include: { podcast: true },
        });

        if (!episode) {
            return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
        }

        return NextResponse.json({
            title: episode.title,
            source: episode.podcast.title,
            publishedAt: episode.published_at.toISOString(),
            summary: episode.summary || '',
            audioUrl: episode.audio_url,
            siteUrl: episode.podcast.site_url,
        });
    } catch (error) {
        console.error('Error fetching episode:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
