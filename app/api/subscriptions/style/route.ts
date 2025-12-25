import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { SummaryStyle, VALID_STYLES, isValidStyle } from '@/lib/types/summary-style';
import { SummaryLanguage, VALID_LANGUAGES, isValidLanguage } from '@/lib/types/summary-language';

/**
 * PATCH /api/subscriptions/style
 * 
 * Update the summary style and/or language for a subscription.
 * Changes only affect future videos/episodes.
 * 
 * Request body:
 * - subscriptionId: number (required)
 * - type: 'youtube' | 'podcast' (required)
 * - newStyle: SummaryStyle (optional)
 * - newLanguage: SummaryLanguage (optional)
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
        const { subscriptionId, type, newStyle, newLanguage } = body;

        // 2. Validate input
        if (!subscriptionId || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: subscriptionId, type' },
                { status: 400 }
            );
        }

        if (!newStyle && !newLanguage) {
            return NextResponse.json(
                { error: 'At least one of newStyle or newLanguage must be provided' },
                { status: 400 }
            );
        }

        if (!['youtube', 'podcast'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid type. Must be "youtube" or "podcast"' },
                { status: 400 }
            );
        }

        if (newStyle && !isValidStyle(newStyle)) {
            return NextResponse.json(
                { error: `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}` },
                { status: 400 }
            );
        }

        if (newLanguage && !isValidLanguage(newLanguage)) {
            return NextResponse.json(
                { error: `Invalid language. Must be one of: ${VALID_LANGUAGES.join(', ')}` },
                { status: 400 }
            );
        }

        // 3. Build update data
        const updateData: { summaryStyle?: SummaryStyle; summaryLanguage?: SummaryLanguage } = {};
        if (newStyle) updateData.summaryStyle = newStyle as SummaryStyle;
        if (newLanguage) updateData.summaryLanguage = newLanguage as SummaryLanguage;

        // 4. Update subscription based on type
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
                data: updateData,
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
                data: updateData,
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Settings updated! New settings will apply to new content.',
        });

    } catch (error) {
        console.error('Error updating subscription settings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
