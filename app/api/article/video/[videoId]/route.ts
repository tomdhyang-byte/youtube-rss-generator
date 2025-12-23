import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface RouteParams {
    params: Promise<{ videoId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    const { videoId } = await params;

    try {
        const video = await prisma.youtubeVideo.findUnique({
            where: { youtube_video_id: videoId },
            include: { channel: true },
        });

        if (!video) {
            return NextResponse.json({ error: 'Video not found' }, { status: 404 });
        }

        return NextResponse.json({
            title: video.title,
            source: video.channel.title,
            publishedAt: video.published_at.toISOString(),
            summary: video.summary,
            youtubeVideoId: video.youtube_video_id,
        });
    } catch (error) {
        console.error('Error fetching video:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
