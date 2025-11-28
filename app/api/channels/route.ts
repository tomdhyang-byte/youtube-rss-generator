import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        let channelId = '';

        // 1. Try to extract ID from URL regex (channel/ID)
        const channelIdMatch = url.match(/channel\/(UC[\w-]{22})/);
        if (channelIdMatch) {
            channelId = channelIdMatch[1];
        } else {
            // 2. If not a direct ID, we must fetch the page to resolve Handle or Custom URL
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                    }
                });
                const text = await response.text();

                // Look for channelId in meta tags or JSON
                // <meta itemprop="channelId" content="UC...">
                const metaMatch = text.match(/itemprop="channelId" content="(UC[\w-]{22})"/);
                if (metaMatch) {
                    channelId = metaMatch[1];
                } else {
                    // Fallback: look for "channelId":"UC..."
                    const jsonMatch = text.match(/"channelId":"(UC[\w-]{22})"/);
                    if (jsonMatch) {
                        channelId = jsonMatch[1];
                    }
                }
            } catch (e) {
                console.error("Failed to fetch page for ID extraction", e);
            }
        }

        if (!channelId) {
            return NextResponse.json({
                error: 'Could not resolve Channel ID. Please try using the full Channel ID URL (e.g. youtube.com/channel/UC...)'
            }, { status: 400 });
        }

        // 3. Fetch Channel Details (Title, Desc)
        let title = 'New Channel';
        let description = 'Waiting for worker to update...';

        try {
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

        } catch (e) {
            console.warn(`Failed to fetch channel info for ${channelId}, using placeholders.`, e);
        }

        // 4. Save to DB
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

        return NextResponse.json(channel);

    } catch (error) {
        console.error('Error adding channel:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
