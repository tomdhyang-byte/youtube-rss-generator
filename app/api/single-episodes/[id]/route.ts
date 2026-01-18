import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
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

        // Delete the record
        await prisma.userSingleEpisode.delete({
            where: { id: recordId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting single episode:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
