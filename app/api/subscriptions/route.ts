import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isAdmin } from '@/lib/auth';

// Ensure this route is always dynamic and never cached statically
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    console.log('[API] GET /api/subscriptions called');

    // 1. Authentication Check
    const session = await getSession();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    try {
        // 2. Fetch user's feedToken and subscriptions
        const [user, youtubeSubscriptions, podcastSubscriptions] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { feedToken: true },
            }),
            prisma.youtubeSubscription.findMany({
                where: { userId },
                include: {
                    channel: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            prisma.podcastSubscription.findMany({
                where: { userId },
                include: {
                    podcast: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
        ]);

        const totalSubs = youtubeSubscriptions.length + podcastSubscriptions.length;
        const isAdminUser = isAdmin(userEmail);
        const quota = {
            current: totalSubs,
            limit: isAdminUser ? null : 1,
            isAdmin: isAdminUser,
        };

        return NextResponse.json({
            youtube: youtubeSubscriptions,
            podcasts: podcastSubscriptions,
            quota,
            feedToken: user?.feedToken,
        });

    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
