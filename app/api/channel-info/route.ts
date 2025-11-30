import { NextResponse } from 'next/server';

/**
 * Public endpoint to fetch YouTube channel metadata
 * No authentication required - used for guest preview
 */
export async function POST(request: Request) {
    console.log('[API] POST /api/channel-info called');

    try {
        const body = await request.json();
        const { url } = body;
        console.log(`[API] Fetching info for URL: ${url}`);

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        let channelId = '';

        // Extract Channel ID from URL
        const channelIdMatch = url.match(/channel\/(UC[\w-]{22})/);
        if (channelIdMatch) {
            channelId = channelIdMatch[1];
            console.log(`[API] Extracted ID from URL: ${channelId}`);
        } else {
            // Fetch page to resolve Handle or Custom URL
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

        if (!channelId) {
            console.warn('[API] Could not resolve Channel ID');
            return NextResponse.json({
                error: 'Could not resolve Channel ID. Please try using the full Channel ID URL (e.g. youtube.com/channel/UC...)'
            }, { status: 400 });
        }

        // Fetch Channel Metadata (Title, Description)
        let title = 'Unknown Channel';
        let description = null;

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

        return NextResponse.json({
            youtube_id: channelId,
            title,
            description
        });

    } catch (error) {
        console.error('Error fetching channel info:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
