import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { localeToSummaryLanguage } from '@/lib/types/summary-language';
import { checkUserQuota, triggerWorker } from '@/lib/api-utils';

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

        // 5. Check if already subscribed
        const existingSub = await prisma.youtubeSubscription.findUnique({
            where: {
                userId_channelId: {
                    userId,
                    channelId: 0, // We need the DB ID, not youtube_id
                }
            }
        });

        // First, find or create the channel
        let channel = await prisma.youtubeChannel.findUnique({
            where: { youtube_id: channelId }
        });

        if (channel) {
            // Check if user already subscribed
            const alreadySubscribed = await prisma.youtubeSubscription.findUnique({
                where: {
                    userId_channelId: {
                        userId,
                        channelId: channel.id
                    }
                }
            });

            if (alreadySubscribed) {
                return NextResponse.json({
                    error: 'You are already subscribed to this channel',
                    channel
                }, { status: 409 });
            }
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
        channel = await prisma.youtubeChannel.upsert({
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

        await prisma.youtubeSubscription.create({
            data: {
                userId,
                channelId: channel.id,
                summaryLanguage: defaultLanguage,
            }
        });

        // 9. Trigger Background Worker
        await triggerWorker('YOUTUBE', channel.id);

        console.log('[API] Subscription created successfully');

        return NextResponse.json({
            success: true,
            channel,
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
