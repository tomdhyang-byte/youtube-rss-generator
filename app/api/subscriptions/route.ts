import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
    SubscriptionTier,
    getEffectiveTier,
    getMaxSubscriptions
} from '@/lib/types/subscription-tier';

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
        // 2. Fetch user's feedToken, tier info, and subscriptions
        const [user, youtubeSubscriptions, podcastSubscriptions] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { feedToken: true, tier: true, tierExpiresAt: true },
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
        const isAdminUser = user?.tier === 'ADMIN';

        // Get tier info with proper expiration handling
        const tier = (user?.tier as SubscriptionTier) || 'FREE';
        const expiresAt = user?.tierExpiresAt || null;
        const effectiveTier = getEffectiveTier(tier, expiresAt);
        const isExpired = tier !== 'FREE' && effectiveTier === 'FREE';

        const quota = {
            current: totalSubs,
            limit: isAdminUser ? null : getMaxSubscriptions(effectiveTier),
            isAdmin: isAdminUser,
            tier,
            effectiveTier,
            expiresAt: expiresAt?.toISOString() || null,
            isExpired,
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

