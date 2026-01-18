import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SINGLE_EPISODE_PRIORITY = 10;

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await params;
    const recordId = parseInt(id, 10);

    if (isNaN(recordId)) {
        return NextResponse.json(
            { error: 'INVALID_ID', message: 'Invalid ID' },
            { status: 400 }
        );
    }

    try {
        // Find the record
        const record = await prisma.userSingleEpisode.findUnique({
            where: { id: recordId },
        });

        if (!record) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Record not found' },
                { status: 404 }
            );
        }

        // Check ownership
        if (record.userId !== userId) {
            return NextResponse.json(
                { error: 'FORBIDDEN', message: 'Access denied' },
                { status: 403 }
            );
        }

        // Check if status is FAILED
        if (record.status !== 'FAILED') {
            return NextResponse.json(
                { error: 'NOT_FAILED', message: 'Can only retry failed records' },
                { status: 400 }
            );
        }

        // Reset status and re-add to queue in a transaction
        await prisma.$transaction(async (tx) => {
            // Reset status
            await tx.userSingleEpisode.update({
                where: { id: recordId },
                data: {
                    status: 'PENDING',
                    failureReason: null,
                },
            });

            // Determine queue type and entity ID
            const queueType = record.videoId ? 'SINGLE_VIDEO' : 'SINGLE_EPISODE';
            const entityId = record.videoId || record.episodeId;

            if (!entityId) {
                throw new Error('Invalid record: no video or episode ID');
            }

            // Add to processing queue
            await tx.processingQueue.create({
                data: {
                    type: queueType,
                    entityId,
                    priority: SINGLE_EPISODE_PRIORITY,
                    requestedByUserId: userId,
                    requestedStyle: record.style,
                    requestedLanguage: record.language,
                },
            });
        });

        return NextResponse.json({
            status: 'queued',
            id: recordId,
        });
    } catch (error) {
        console.error('Error retrying single episode:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
