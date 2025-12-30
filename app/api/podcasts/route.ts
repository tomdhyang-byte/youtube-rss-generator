import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isAdmin } from '@/lib/auth';
import { localeToSummaryLanguage } from '@/lib/types/summary-language';
import Parser from 'rss-parser';
import { checkUserQuota, triggerWorker } from '@/lib/api-utils';
import { isSafePodcastUrl } from '@/lib/security';

const parser = new Parser();

/**
 * Strip HTML tags from a string
 * Used to clean RSS feed descriptions that may contain HTML markup
 */
function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
}

export async function POST(request: Request) {
    console.log('[API] POST /api/podcasts called');

    // 1. Authentication Check
    const session = await getSession();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Defensive check: Verify user exists in database (catches auth ID mismatch bugs)
    const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!userExists) {
        console.error(`[API] User ID mismatch: session.user.id=${userId} not found in database. User needs to logout and login again.`);
        return NextResponse.json({
            error: 'Session expired or invalid. Please logout and login again.',
            code: 'USER_NOT_FOUND'
        }, { status: 401 });
    }


    try {
        const { url, locale } = await request.json();
        console.log(`[API] Received URL: ${url}, locale: ${locale || 'default'}`);

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // SSRF Protection
        if (!isSafePodcastUrl(url)) {
            console.warn(`[API] Blocked potentially unsafe Podcast URL: ${url}`);
            return NextResponse.json({ error: 'Invalid URL. Private IPs and localhost are not allowed.' }, { status: 400 });
        }

        let feedUrl = url;
        let title = '';
        let description = '';
        let siteUrl = '';
        let imageUrl = '';

        // 2. Spotify Rejection
        if (url.includes('spotify.com')) {
            return NextResponse.json(
                { error: 'Spotify links are not supported (Walled Garden). Please use Apple Podcasts link or RSS.' },
                { status: 400 }
            );
        }

        // 3. Apple Podcast Lookup
        const appleMatch = url.match(/podcasts\.apple\.com\/[a-z]+\/podcast\/.*\/id(\d+)/);
        if (appleMatch) {
            const id = appleMatch[1];
            const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
            const lookupData = await lookupRes.json();

            if (lookupData.resultCount > 0) {
                feedUrl = lookupData.results[0].feedUrl;
            } else {
                return NextResponse.json({ error: 'Apple Podcast not found' }, { status: 404 });
            }
        }

        // 4. RSS Validation
        try {
            const feed = await parser.parseURL(feedUrl);
            title = feed.title || '';
            description = stripHtml(feed.description || '');
            siteUrl = feed.link || '';
            imageUrl = feed.image?.url || '';
        } catch (error) {
            return NextResponse.json({ error: 'Invalid RSS feed' }, { status: 400 });
        }

        // 5. Quota Check (via shared utility)
        const quotaResult = await checkUserQuota(session.user);
        if (!quotaResult.allowed) {
            return NextResponse.json({
                error: quotaResult.error,
                quota: quotaResult.quota
            }, { status: 403 });
        }

        // 6. Upsert Podcast & Create Subscription
        let podcast = await prisma.podcastChannel.findUnique({
            where: { feed_url: feedUrl }
        });

        if (podcast) {
            // Check if user already subscribed
            const alreadySubscribed = await prisma.podcastSubscription.findUnique({
                where: {
                    userId_podcastId: {
                        userId,
                        podcastId: podcast.id
                    }
                }
            });

            if (alreadySubscribed) {
                return NextResponse.json({
                    error: 'You are already subscribed to this podcast',
                    podcast
                }, { status: 409 });
            }
        }

        podcast = await prisma.podcastChannel.upsert({
            where: { feed_url: feedUrl },
            update: {
                title,
                description,
                site_url: siteUrl,
                image_url: imageUrl,
                last_updated: new Date(),
            },
            create: {
                feed_url: feedUrl,
                title,
                description,
                site_url: siteUrl,
                image_url: imageUrl,
            },
        });

        // 7. Create Subscription with default language based on locale
        const defaultLanguage = localeToSummaryLanguage(locale || 'en');
        console.log(`[API] Creating subscription with language: ${defaultLanguage}`);

        const subscription = await prisma.podcastSubscription.create({
            data: {
                userId,
                podcastId: podcast.id,
                summaryLanguage: defaultLanguage,
            },
            include: {
                podcast: true,  // Include full podcast object
            },
        });

        // 8. Trigger Background Worker
        await triggerWorker('PODCAST', podcast.id);

        console.log('[API] Podcast subscription created successfully');

        return NextResponse.json({
            success: true,
            subscription,  // Full subscription with nested podcast
            podcast,       // Keep for backward compatibility
            message: 'Successfully subscribed to podcast'
        });

    } catch (error) {
        console.error('Error adding podcast:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE: Unsubscribe from a podcast
export async function DELETE(request: Request) {
    console.log('[API] DELETE /api/podcasts called');

    // 1. Authentication Check
    const session = await getSession();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        const body = await request.json();
        const { podcastId } = body;

        if (!podcastId) {
            return NextResponse.json({ error: 'podcastId is required' }, { status: 400 });
        }

        console.log(`[API] Unsubscribing user ${userId} from podcast ${podcastId}`);

        // 2. Delete the subscription (NOT the podcast itself)
        const deleted = await prisma.podcastSubscription.deleteMany({
            where: {
                userId,
                podcastId: parseInt(podcastId),
            }
        });

        if (deleted.count === 0) {
            return NextResponse.json({
                error: 'Subscription not found or already removed'
            }, { status: 404 });
        }

        console.log('[API] Podcast subscription removed successfully');

        return NextResponse.json({
            success: true,
            message: 'Successfully unsubscribed from podcast'
        });

    } catch (error) {
        console.error('Error removing podcast subscription:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
