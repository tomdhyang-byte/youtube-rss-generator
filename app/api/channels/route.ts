import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { localeToSummaryLanguage } from '@/lib/types/summary-language';
import { checkUserQuota, triggerWorker } from '@/lib/api-utils';

import { isValidYoutubeUrl } from '@/lib/security';

export async function POST(request: Request) {
    console.log('[API] POST /api/channels called');

    // 1. Authentication Check
    const session = await getSession();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    try {
        const body = await request.json();
        const { url, metadata, locale } = body;
        console.log(`[API] Received URL: ${url}, locale: ${locale || 'default'}`);

        if (metadata) {
            console.log(`[API] Using cached metadata (skip YouTube fetch)`);
        }

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // SSRF Protection
        if (!isValidYoutubeUrl(url)) {
            console.warn(`[API] Blocked potentially unsafe Youtube URL: ${url}`);
            return NextResponse.json({ error: 'Invalid URL. Only YouTube links are allowed.' }, { status: 400 });
        }

        let channelId = '';

        // 2. Try to use cached metadata first (performance optimization)
        if (metadata?.youtube_id) {
            channelId = metadata.youtube_id;
            console.log(`[API] Using cached channel ID: ${channelId}`);
        }
        // 3. Try to extract ID from URL regex (channel/ID)
        else {
            const channelIdMatch = url.match(/channel\/(UC[\w-]{22})/);
            if (channelIdMatch) {
                channelId = channelIdMatch[1];
                console.log(`[API] Extracted ID from URL: ${channelId}`);
            } else {
                // 4. If not a direct ID, we must fetch the page to resolve Handle or Custom URL
                console.log('[API] Fetching page to resolve ID...');
                try {
                    const response = await fetch(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept-Language': 'en-US,en;q=0.9',
                        }
                    });
                    const text = await response.text();

                    // Try og:url (Most reliable)
                    const ogMatch = text.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/);
                    if (ogMatch) {
                        channelId = ogMatch[1];
                        console.log(`[API] Found ID in og:url: ${channelId}`);
                    } else {
                        // Try itemprop="channelId"
                        const metaMatch = text.match(/itemprop="channelId" content="(UC[\w-]{22})"/);
                        if (metaMatch) {
                            channelId = metaMatch[1];
                            console.log(`[API] Found ID in meta tag: ${channelId}`);
                        } else {
                            // Fallback: look for "channelId":"UC..."
                            const jsonMatch = text.match(/"channelId":"(UC[\w-]{22})"/);
                            if (jsonMatch) {
                                channelId = jsonMatch[1];
                                console.log(`[API] Found ID in JSON: ${channelId}`);
                            }
                        }
                    }
                } catch (e) {
                    console.error("[API] Failed to fetch page for ID extraction", e);
                }
            }
        }

        if (!channelId) {
            console.warn('[API] Could not resolve Channel ID');
            return NextResponse.json({
                error: 'Could not resolve Channel ID. Please try using the full Channel ID URL (e.g. youtube.com/channel/UC...)'
            }, { status: 400 });
        }

        // 4. Quota Check (via shared utility)
        const quotaResult = await checkUserQuota(session.user);
        if (!quotaResult.allowed) {
            return NextResponse.json({
                error: quotaResult.error,
                quota: quotaResult.quota
            }, { status: 403 });
        }

        // 6. Fetch Channel Details (Title, Desc)
        let title = 'New Channel';
        let description = 'Waiting for worker to update...';

        try {
            console.log(`[API] Fetching metadata for ${channelId}...`);
            const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            });
            const text = await response.text();

            // Extract Title
            const titleMatch = text.match(/<meta property="og:title" content="([^"]+)">/);
            if (titleMatch) {
                title = titleMatch[1];
            }

            // Extract Description
            const descMatch = text.match(/<meta property="og:description" content="([^"]+)">/);
            if (descMatch) {
                description = descMatch[1];
            }
            console.log(`[API] Metadata resolved: ${title}`);

        } catch (e) {
            console.warn(`[API] Failed to fetch channel info for ${channelId}`, e);
        }

        // 7. Upsert Channel & Create Subscription
        console.log('[API] Saving to DB...');
        const channel = await prisma.youtubeChannel.upsert({
            where: { youtube_id: channelId },
            update: {
                ...(title !== 'New Channel' ? { title, description } : {}),
                rss_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            },
            create: {
                youtube_id: channelId,
                title,
                description,
                rss_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            },
        });

        // 8. Create Subscription with default language based on locale
        const defaultLanguage = localeToSummaryLanguage(locale || 'en');
        console.log(`[API] Creating subscription with language: ${defaultLanguage}`);

        let subscription;
        try {
            subscription = await prisma.youtubeSubscription.create({
                data: {
                    userId,
                    channelId: channel.id,
                    summaryLanguage: defaultLanguage,
                },
                include: {
                    channel: true,  // Include the full channel object
                },
            });
        } catch (error: any) {
            // Handle unique constraint violation (P2002) - User double-clicked or race condition
            if (error.code === 'P2002') {
                console.log('[API] Subscription already exists (race condition handled)');
                // Fetch existing subscription to return consistent response
                const existingSub = await prisma.youtubeSubscription.findFirst({
                    where: { userId, channelId: channel.id },
                    include: { channel: true },
                });
                return NextResponse.json({
                    success: true,
                    subscription: existingSub,
                    channel,
                    message: 'Already subscribed'
                });
            }
            throw error;
        }

        // 9. Trigger Background Worker
        await triggerWorker('YOUTUBE', channel.id);

        console.log('[API] Subscription created successfully');

        return NextResponse.json({
            success: true,
            subscription,  // Full subscription object with nested channel
            channel,       // Keep for backward compatibility
            message: 'Successfully subscribed to channel'
        });

    } catch (error) {
        console.error('Error adding channel:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE: Unsubscribe from a channel
export async function DELETE(request: Request) {
    console.log('[API] DELETE /api/channels called');

    // 1. Authentication Check
    const session = await getSession();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        const body = await request.json();
        const { channelId } = body;

        if (!channelId) {
            return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
        }

        console.log(`[API] Unsubscribing user ${userId} from channel ${channelId}`);

        // 2. Delete the subscription (NOT the channel itself)
        const deleted = await prisma.youtubeSubscription.deleteMany({
            where: {
                userId,
                channelId: parseInt(channelId),
            }
        });

        if (deleted.count === 0) {
            return NextResponse.json({
                error: 'Subscription not found or already removed'
            }, { status: 404 });
        }

        console.log('[API] Subscription removed successfully');

        return NextResponse.json({
            success: true,
            message: 'Successfully unsubscribed from channel'
        });

    } catch (error) {
        console.error('Error removing subscription:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
