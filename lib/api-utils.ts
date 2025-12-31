
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';
import { User } from 'next-auth';
import {
    SubscriptionTier,
    TIER_LIMITS,
    getEffectiveTier,
    getMaxSubscriptions,
    TierInfo
} from '@/lib/types/subscription-tier';

interface QuotaCheckResult {
    allowed: boolean;
    error?: string;
    quota?: {
        current: number;
        limit: number;
        tier: SubscriptionTier;
        effectiveTier: SubscriptionTier;
        expiresAt: string | null;
        isExpired: boolean;
        isAdmin: boolean;
    };
}

/**
 * Check if the user has reached their subscription limit.
 * Admin users bypass this check.
 * Quota is based on user's subscription tier (FREE=1, PLUS=5, PRO=10).
 */
export async function checkUserQuota(user: User): Promise<QuotaCheckResult> {
    if (!user.email || !user.id) {
        return { allowed: false, error: 'User email/id missing' };
    }

    // 1. Admin Bypass - preserve existing behavior
    if (isAdmin(user.email)) {
        console.log(`[API] Admin user detected - skipping quota check`);
        return { allowed: true };
    }

    console.log(`[API] Checking quota for user ${user.id}`);

    // Fetch user with tier info and subscription counts
    const [dbUser, ytSubCount, podcastSubCount] = await Promise.all([
        prisma.user.findUnique({
            where: { id: user.id },
            select: { tier: true, tierExpiresAt: true }
        }),
        prisma.youtubeSubscription.count({ where: { userId: user.id } }),
        prisma.podcastSubscription.count({ where: { userId: user.id } }),
    ]);

    const totalSubs = ytSubCount + podcastSubCount;

    // Get tier info with fallback for safety
    const tier = (dbUser?.tier as SubscriptionTier) || 'FREE';
    const expiresAt = dbUser?.tierExpiresAt || null;
    const effectiveTier = getEffectiveTier(tier, expiresAt);
    const isExpired = tier !== 'FREE' && effectiveTier === 'FREE';
    const limit = getMaxSubscriptions(effectiveTier);

    console.log(`[API] User tier: ${tier}, effective: ${effectiveTier}, expires: ${expiresAt}, subs: ${totalSubs}/${limit}`);

    const quotaInfo = {
        current: totalSubs,
        limit,
        tier,
        effectiveTier,
        expiresAt: expiresAt?.toISOString() || null,
        isExpired,
        isAdmin: false,
    };

    if (totalSubs >= limit) {
        const tierMessage = effectiveTier === 'FREE'
            ? 'Free users can only subscribe to 1 channel/podcast total.'
            : `${effectiveTier} users can subscribe to up to ${limit} channels/podcasts.`;

        return {
            allowed: false,
            error: `Subscription quota reached. ${tierMessage} Please unsubscribe from another to add this one.`,
            quota: quotaInfo
        };
    }

    return { allowed: true, quota: quotaInfo };
}

/**
 * Trigger the background worker for a new channel/podcast.
 * Creates a job in the ProcessingQueue if one doesn't already exist.
 */
export async function triggerWorker(type: 'YOUTUBE' | 'PODCAST', entityId: number) {
    try {
        // Check if there's already a pending/processing job for this entity
        const existingJob = await prisma.processingQueue.findFirst({
            where: {
                entityId,
                type,
                status: {
                    in: ['PENDING', 'PROCESSING']
                }
            }
        });

        if (!existingJob) {
            console.log(`[API] Triggering worker for ${type} ${entityId}`);
            await prisma.processingQueue.create({
                data: {
                    type,
                    entityId,
                    status: 'PENDING',
                    priority: 10 // High priority for new user request
                }
            });
        } else {
            console.log(`[API] Worker job already exists for ${type} ${entityId}`);
        }
    } catch (queueError) {
        console.error('[API] Failed to trigger worker:', queueError);
        // We log but don't throw, to avoid failing the whole request
    }
}
