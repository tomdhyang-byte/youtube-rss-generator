/**
 * Subscription Tier Types
 * 
 * Defines the tier system for user subscriptions.
 * Tiers determine the maximum number of feeds a user can have.
 */

export type SubscriptionTier = 'FREE' | 'PLUS' | 'PRO' | 'ADMIN';

export const TIER_LIMITS: Record<SubscriptionTier, number> = {
    FREE: 1,
    PLUS: 5,
    PRO: 10,
    ADMIN: Infinity,
};

export interface TierInfo {
    /** The tier stored in the database */
    tier: SubscriptionTier;
    /** The effective tier after checking expiration */
    effectiveTier: SubscriptionTier;
    /** Expiration timestamp, null means never expires */
    expiresAt: string | null;
    /** Whether the subscription has expired */
    isExpired: boolean;
    /** Maximum number of subscriptions allowed */
    maxSubscriptions: number;
}

/**
 * Get the effective tier considering expiration
 */
export function getEffectiveTier(
    tier: SubscriptionTier | null | undefined,
    expiresAt: Date | string | null | undefined
): SubscriptionTier {
    const currentTier = tier || 'FREE';

    if (!expiresAt) {
        return currentTier;
    }

    const expirationDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;

    if (expirationDate < new Date()) {
        return 'FREE';
    }

    return currentTier;
}

/**
 * Get the maximum number of subscriptions for a tier
 */
export function getMaxSubscriptions(tier: SubscriptionTier): number {
    return TIER_LIMITS[tier] ?? 1;
}
