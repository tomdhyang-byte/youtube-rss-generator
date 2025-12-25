
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';
import { User } from 'next-auth';

interface QuotaCheckResult {
    allowed: boolean;
    error?: string;
    quota?: {
        current: number;
        limit: number;
    };
}

/**
 * Check if the user has reached their subscription limit.
 * Admin users bypass this check.
 */
export async function checkUserQuota(user: User): Promise<QuotaCheckResult> {
    if (!user.email || !user.id) {
        return { allowed: false, error: 'User email/id missing' };
    }

    // 1. Admin Bypass
    if (isAdmin(user.email)) {
        console.log(`[API] Admin user detected - skipping quota check`);
        return { allowed: true };
    }

    console.log(`[API] Checking quota for user ${user.id}`);

    const [ytSubCount, podcastSubCount] = await Promise.all([
        prisma.youtubeSubscription.count({ where: { userId: user.id } }),
        prisma.podcastSubscription.count({ where: { userId: user.id } }),
    ]);

    const totalSubs = ytSubCount + podcastSubCount;
    // Hardcoded limit for now, as per original code
    const LIMIT = 1;

    console.log(`[API] User has ${totalSubs} total subscriptions (YT: ${ytSubCount}, Podcast: ${podcastSubCount})`);

    if (totalSubs >= LIMIT) {
        return {
            allowed: false,
            error: 'Subscription quota reached. Free users can only subscribe to 1 channel/podcast total. Please unsubscribe from another to add this one.',
            quota: { current: totalSubs, limit: LIMIT }
        };
    }

    return { allowed: true };
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
