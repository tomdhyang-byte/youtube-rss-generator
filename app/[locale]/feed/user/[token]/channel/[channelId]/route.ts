import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VideoQueryResult } from '@/lib/types/feed';

/**
 * GET /feed/user/[token]/channel/[channelId]
 * 
 * Per-subscription personalized YouTube channel feed.
 * Uses the user's locked styles for summaries.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string; channelId: string }> }
) {
    const { token, channelId: channelIdStr } = await params;

    // Validate token
    if (!token) {
        return new Response("Feed token required", { status: 400 });
    }

    // Validate channelId
    const channelId = parseInt(channelIdStr);
    if (isNaN(channelId)) {
        return new NextResponse('Invalid Channel ID', { status: 400 });
    }

    // 1. Find user by feedToken
    const user = await prisma.user.findUnique({
        where: { feedToken: token },
    });

    if (!user) {
        return new Response("Feed not found", { status: 404 });
    }

    // 2. Find channel and verify user has subscription
    const channel = await prisma.youtubeChannel.findUnique({
        where: { id: channelId },
    });

    if (!channel) {
        return new NextResponse('Channel not found', { status: 404 });
    }

    const subscription = await prisma.youtubeSubscription.findFirst({
        where: {
            userId: user.id,
            channelId: channelId,
        },
    });

    if (!subscription) {
        return new NextResponse('You are not subscribed to this channel', { status: 403 });
    }

    // 3. Query videos with locked styles for this specific channel
    const videoItems = await prisma.$queryRaw<VideoQueryResult[]>`
        SELECT 
            v.id,
            v.title,
            v.youtube_video_id,
            v.published_at,
            c.title as channel_title,
            c.youtube_id as channel_youtube_id,
            vs.content as summary,
            uvs.style as locked_style
        FROM user_video_styles uvs
        INNER JOIN youtube_videos v ON v.id = uvs.video_id
        INNER JOIN youtube_channels c ON c.id = v.channel_id
        INNER JOIN video_summaries vs ON vs.video_id = v.id AND vs.style::text = uvs.style::text
        WHERE uvs.user_id = ${user.id}
          AND c.id = ${channelId}
        ORDER BY v.published_at DESC
        LIMIT 50
    `;

    // 4. Generate RSS XML
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tubesummary.app';

    const items = videoItems.map(v => ({
        title: v.title,
        link: `${baseUrl}/video/${v.youtube_video_id}`,
        guid: `video-${v.id}`,
        pubDate: new Date(v.published_at).toUTCString(),
        description: v.summary || 'No summary available.',
    }));

    // Add welcome message if no videos yet
    if (items.length === 0) {
        items.push({
            title: "Welcome to Your RSS Feed!",
            link: `${baseUrl}/video/${channel.youtube_id}`,
            guid: `welcome-msg-channel-${channelId}-user-${user.id}`,
            pubDate: new Date().toUTCString(),
            description: "This feed is empty because no videos have been processed yet. Our AI worker processes new channels every few hours. Please check back later.",
        });
    }

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>${escapeXml(channel.title)} (AI Summarized)</title>
    <link>https://www.youtube.com/channel/${channel.youtube_id}</link>
    <description>${escapeXml(channel.description || `AI Summaries for ${channel.title}`)}</description>
    <language>zh-TW</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed/user/${token}/channel/${channelId}" rel="self" type="application/rss+xml"/>
    ${items.map(item => `
    <item>
        <title><![CDATA[${item.title}]]></title>
        <link>${item.link}</link>
        <guid isPermaLink="false">${item.guid}</guid>
        <pubDate>${item.pubDate}</pubDate>
        <description><![CDATA[${item.description}]]></description>
    </item>`).join('')}
</channel>
</rss>`;

    return new Response(rssXml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300', // 5 min cache
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
