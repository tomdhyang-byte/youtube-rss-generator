import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { SummaryStyle, VALID_STYLES, isValidStyle } from '@/lib/types/summary-style';

/**
 * PATCH /api/subscriptions/style
 * 
 * Update the summary style for a subscription.
 * Changes only affect future videos/episodes.
 */
export async function PATCH(request: Request) {
    // 1. Authentication Check
    const session = await getSession();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        const body = await request.json();
        const { subscriptionId, type, newStyle } = body;

        // 2. Validate input
        if (!subscriptionId || !type || !newStyle) {
            return NextResponse.json(
                { error: 'Missing required fields: subscriptionId, type, newStyle' },
                { status: 400 }
            );
        }

        if (!['youtube', 'podcast'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid type. Must be "youtube" or "podcast"' },
                { status: 400 }
            );
        }

        if (!isValidStyle(newStyle)) {
            return NextResponse.json(
                { error: `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}` },
                { status: 400 }
            );
        }

        // 3. Update subscription based on type
        if (type === 'youtube') {
            // Verify ownership
            const subscription = await prisma.youtubeSubscription.findFirst({
                where: { id: subscriptionId, userId },
            });

            if (!subscription) {
                return NextResponse.json(
                    { error: 'Subscription not found or not owned by user' },
                    { status: 404 }
                );
            }

            await prisma.youtubeSubscription.update({
                where: { id: subscriptionId },
                data: { summaryStyle: newStyle as SummaryStyle },
            });
        } else {
            // Podcast
            const subscription = await prisma.podcastSubscription.findFirst({
                where: { id: subscriptionId, userId },
            });

            if (!subscription) {
                return NextResponse.json(
                    { error: 'Subscription not found or not owned by user' },
                    { status: 404 }
                );
            }

            await prisma.podcastSubscription.update({
                where: { id: subscriptionId },
                data: { summaryStyle: newStyle as SummaryStyle },
            });
        }

        return NextResponse.json({
            success: true,
            message: '摘要風格已更新！新設定將從下一部新影片開始生效。',
        });

    } catch (error) {
        console.error('Error updating subscription style:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
