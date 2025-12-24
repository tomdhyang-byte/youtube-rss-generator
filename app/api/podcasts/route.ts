import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, isAdmin } from '@/lib/auth';
import Parser from 'rss-parser';

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

    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
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

        // 5. Quota Check (unless admin)
        if (!isAdmin(userEmail)) {
            console.log(`[API] Checking quota for user ${userId}`);

            const [ytSubCount, podcastSubCount] = await Promise.all([
                prisma.youtubeSubscription.count({ where: { userId } }),
                prisma.podcastSubscription.count({ where: { userId } }),
            ]);

            const totalSubs = ytSubCount + podcastSubCount;
            console.log(`[API] User has ${totalSubs} total subscriptions (YT: ${ytSubCount}, Podcast: ${podcastSubCount})`);

            if (totalSubs >= 1) {
                return NextResponse.json({
                    error: 'Subscription quota reached. Free users can only subscribe to 1 channel/podcast total. Please unsubscribe from another to add this one.',
                    quota: { current: totalSubs, limit: 1 }
                }, { status: 403 });
            }
        } else {
            console.log(`[API] Admin user detected - skipping quota check`);
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

        // 7. Create Subscription
        await prisma.podcastSubscription.create({
            data: {
                userId,
                podcastId: podcast.id,
            }
        });

        // 8. Trigger Background Worker
        try {
            // Check if there's already a pending/processing job for this podcast
            const existingJob = await prisma.processingQueue.findFirst({
                where: {
                    entityId: podcast.id,
                    type: 'PODCAST',
                    status: {
                        in: ['PENDING', 'PROCESSING']
                    }
                }
            });

            if (!existingJob) {
                console.log(`[API] Triggering worker for Podcast ${podcast.id}`);
                await prisma.processingQueue.create({
                    data: {
                        type: 'PODCAST',
                        entityId: podcast.id,
                        status: 'PENDING',
                        priority: 10 // High priority for new user request
                    }
                });
            } else {
                console.log(`[API] Worker job already exists for Podcast ${podcast.id}`);
            }
        } catch (queueError) {
            console.error('[API] Failed to trigger worker:', queueError);
            // Don't fail the request just because the background job trigger failed
        }

        console.log('[API] Podcast subscription created successfully');

        return NextResponse.json({
            success: true,
            podcast,
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
