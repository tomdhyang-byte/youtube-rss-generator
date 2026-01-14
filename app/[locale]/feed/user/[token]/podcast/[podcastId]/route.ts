import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EpisodeQueryResult } from '@/lib/types/feed';

/**
 * GET /feed/user/[token]/podcast/[podcastId]
 * 
 * Per-subscription personalized Podcast feed.
 * Uses the user's locked styles for summaries.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string; podcastId: string }> }
) {
    const { token, podcastId: podcastIdStr } = await params;

    // Validate token
    if (!token) {
        return new Response("Feed token required", { status: 400 });
    }

    // Validate podcastId
    const podcastId = parseInt(podcastIdStr);
    if (isNaN(podcastId)) {
        return new NextResponse('Invalid Podcast ID', { status: 400 });
    }

    // 1. Find user by feedToken
    const user = await prisma.user.findUnique({
        where: { feedToken: token },
    });

    if (!user) {
        return new Response("Feed not found", { status: 404 });
    }

    // 2. Find podcast and verify user has subscription
    const podcast = await prisma.podcastChannel.findUnique({
        where: { id: podcastId },
    });

    if (!podcast) {
        return new NextResponse('Podcast not found', { status: 404 });
    }

    const subscription = await prisma.podcastSubscription.findFirst({
        where: {
            userId: user.id,
            podcastId: podcastId,
        },
    });

    if (!subscription) {
        return new NextResponse('You are not subscribed to this podcast', { status: 403 });
    }

    // 3. Query episodes with locked styles for this specific podcast
    const episodeItems = await prisma.$queryRaw<EpisodeQueryResult[]>`
        SELECT 
            e.id,
            e.title,
            e.guid,
            e.audio_url,
            e.published_at,
            p.title as podcast_title,
            p.feed_url,
            es.content as summary,
            ues.style as locked_style
        FROM user_episode_styles ues
        INNER JOIN podcast_episodes e ON e.id = ues.episode_id
        INNER JOIN podcast_channels p ON p.id = e.podcast_id
        INNER JOIN episode_summaries es ON es.episode_id = e.id AND es.style::text = ues.style::text AND es.language::text = ues.language::text
        WHERE ues.user_id = ${user.id}
          AND p.id = ${podcastId}
        ORDER BY e.published_at DESC
        LIMIT 50
    `;

    // 4. Generate RSS XML
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://youtube-rss-generator.vercel.app';

    const items = episodeItems.map(e => ({
        title: e.title,
        link: `${baseUrl}/episode/${e.id}`,
        guid: `episode-${e.id}`,
        pubDate: new Date(e.published_at).toUTCString(),
        description: e.summary || 'No summary available.',
    }));

    // Add welcome message if no episodes yet
    if (items.length === 0) {
        items.push({
            title: "Welcome to Your RSS Feed!",
            link: `${baseUrl}/episode/welcome`,
            guid: `welcome-msg-podcast-${podcastId}-user-${user.id}`,
            pubDate: new Date('2000-01-01').toUTCString(),
            description: "This feed is empty because no episodes have been processed yet. Our AI worker processes new podcasts every few hours. Please check back later.",
        });
    }

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
    <title>${escapeXml(podcast.title || 'Podcast')} (AI Summarized)</title>
    <link>${podcast.site_url || podcast.feed_url}</link>
    <description>${escapeXml(podcast.description || `AI Summaries for ${podcast.title || 'this podcast'}`)}</description>
    <language>zh-TW</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
        <url>${baseUrl}/icon.svg</url>
        <title>${escapeXml(podcast.title || 'Podcast')} (AI Summarized)</title>
        <link>${podcast.site_url || podcast.feed_url}</link>
    </image>
    <atom:link href="${baseUrl}/feed/user/${token}/podcast/${podcastId}" rel="self" type="application/rss+xml"/>
    ${items.map(item => `
    <item>
        <title><![CDATA[${item.title}]]></title>
        <link>${item.link}</link>
        <guid isPermaLink="false">${item.guid}</guid>
        <pubDate>${item.pubDate}</pubDate>
        <description><![CDATA[${item.description}]]></description>
        <content:encoded><![CDATA[${item.description}]]></content:encoded>
    </item>`).join('')}
</channel>
</rss>`;

    return new Response(rssXml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Vercel-CDN-Cache-Control': 'no-store, max-age=0',
            'CDN-Cache-Control': 'no-store, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
