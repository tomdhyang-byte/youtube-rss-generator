import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();

export async function POST(request: Request) {
    console.log('[API] POST /api/channels called');
    try {
        const body = await request.json();
        const { url } = body;
        console.log(`[API] Received URL: ${url}`);

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        let channelId = '';

        // 1. Try to extract ID from URL regex (channel/ID)
        const channelIdMatch = url.match(/channel\/(UC[\w-]{22})/);
        if (channelIdMatch) {
            channelId = channelIdMatch[1];
            console.log(`[API] Extracted ID from URL: ${channelId}`);
        } else {
            // 2. If not a direct ID, we must fetch the page to resolve Handle or Custom URL
            console.log('[API] Fetching page to resolve ID...');
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                    }
                });
                const text = await response.text();

                // 1. Try og:url (Most reliable)
                // <meta property="og:url" content="https://www.youtube.com/channel/UC...">
                const ogMatch = text.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/);
                if (ogMatch) {
                    channelId = ogMatch[1];
                    console.log(`[API] Found ID in og:url: ${channelId}`);
                } else {
                    // 2. Try itemprop="channelId"
                    const metaMatch = text.match(/itemprop="channelId" content="(UC[\w-]{22})"/);
                    if (metaMatch) {
                        channelId = metaMatch[1];
                        console.log(`[API] Found ID in meta tag: ${channelId}`);
                    } else {
                        // 3. Fallback: look for "channelId":"UC..." (Risky, might pick related channels)
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

        if (!channelId) {
            console.warn('[API] Could not resolve Channel ID');
            return NextResponse.json({
                error: 'Could not resolve Channel ID. Please try using the full Channel ID URL (e.g. youtube.com/channel/UC...)'
            }, { status: 400 });
        }

        // 3. Fetch Channel Details (Title, Desc)
        let title = 'New Channel';
        let description = 'Waiting for worker to update...';

        try {
            console.log(`[API] Fetching metadata for ${channelId}...`);
            // Manual fetch to avoid broken libraries
            const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            });
            const text = await response.text();

            // Extract Title
            // <meta property="og:title" content="Veritasium">
            const titleMatch = text.match(/<meta property="og:title" content="([^"]+)">/);
            if (titleMatch) {
                title = titleMatch[1];
            }

            // Extract Description
            // <meta property="og:description" content="...>
            const descMatch = text.match(/<meta property="og:description" content="([^"]+)">/);
            if (descMatch) {
                description = descMatch[1];
            }
            console.log(`[API] Metadata resolved: ${title}`);

        } catch (e) {
            console.warn(`[API] Failed to fetch channel info for ${channelId}`, e);
        }

        // 4. Save to DB
        console.log('[API] Saving to DB...');
        const channel = await prisma.channel.upsert({
            where: { youtube_id: channelId },
            update: {
                // Only update title/desc if we actually got them, otherwise keep existing
                ...(title !== 'New Channel' ? { title, description } : {}),
                rss_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            },
            create: {
                youtube_id: channelId,
                title, // Might be placeholder
                description,
                rss_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
            },
        });
        console.log('[API] DB Save successful');

        return NextResponse.json(channel);

    } catch (error) {
        console.error('Error adding channel:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
