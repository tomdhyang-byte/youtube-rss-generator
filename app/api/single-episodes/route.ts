import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SINGLE_EPISODE_LIMIT = 50;

export async function GET() {
    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        const records = await prisma.userSingleEpisode.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                video: {
                    select: {
                        youtube_video_id: true,
                        title: true,
                    },
                },
                episode: {
                    select: {
                        guid: true,
                        title: true,
                    },
                },
            },
        });

        const items = records.map((record) => {
            if (record.video) {
                return {
                    id: record.id,
                    type: 'video' as const,
                    externalId: record.video.youtube_video_id,
                    title: record.video.title,
                    thumbnailUrl: `https://img.youtube.com/vi/${record.video.youtube_video_id}/mqdefault.jpg`,
                    style: record.style,
                    language: record.language,
                    status: record.status,
                    failureReason: record.failureReason,
                    createdAt: record.createdAt.toISOString(),
                };
            } else if (record.episode) {
                return {
                    id: record.id,
                    type: 'podcast' as const,
                    externalId: record.episode.guid,
                    title: record.episode.title,
                    thumbnailUrl: null,
                    style: record.style,
                    language: record.language,
                    status: record.status,
                    failureReason: record.failureReason,
                    createdAt: record.createdAt.toISOString(),
                };
            }
            // This shouldn't happen due to DB constraints
            throw new Error('Invalid record: neither video nor episode');
        });

        return NextResponse.json({
            items,
            total: records.length,
            limit: SINGLE_EPISODE_LIMIT,
        });
    } catch (error) {
        console.error('Error fetching single episodes:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
