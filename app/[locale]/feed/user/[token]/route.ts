import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VideoQueryResult, EpisodeQueryResult } from '@/lib/types/feed';

/**
 * GET /feed/user/[token]
 * 
 * Personalized RSS Feed endpoint using Design B (locked styles).
 * Each video/episode shows the summary style that was locked at the time of processing.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    if (!token) {
        return new Response("Feed token required", { status: 400 });
    }

    // 1. Find user by feedToken
    const user = await prisma.user.findUnique({
        where: { feedToken: token },
    });

    if (!user) {
        return new Response("Feed not found", { status: 404 });
    }

    // 2. Query videos with locked styles - only for active subscriptions
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
        INNER JOIN youtube_subscriptions ys ON ys.user_id = uvs.user_id AND ys.channel_id = c.id
        WHERE uvs.user_id = ${user.id}
        ORDER BY v.published_at DESC
        LIMIT 50
    `;

    // 3. Query podcast episodes with locked styles - only for active subscriptions
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
        INNER JOIN episode_summaries es ON es.episode_id = e.id AND es.style::text = ues.style::text
        INNER JOIN podcast_subscriptions ps ON ps.user_id = ues.user_id AND ps.podcast_id = p.id
        WHERE ues.user_id = ${user.id}
        ORDER BY e.published_at DESC
        LIMIT 50
    `;

    // 4. Combine and sort items
    const allItems = [
        ...videoItems.map(v => ({
            type: 'video' as const,
            title: v.title,
            link: `https://youtube.com/watch?v=${v.youtube_video_id}`,
            guid: `video-${v.id}`,
            pubDate: new Date(v.published_at).toUTCString(),
            description: v.summary || 'No summary available.',
            source: v.channel_title,
        })),
        ...episodeItems.map(e => ({
            type: 'podcast' as const,
            title: e.title,
            link: e.audio_url,
            guid: `episode-${e.id}`,
            pubDate: new Date(e.published_at).toUTCString(),
            description: e.summary || 'No summary available.',
            source: e.podcast_title,
        })),
    ].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
        .slice(0, 50);

    // 5. Generate RSS XML
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://youtube-rss-generator.vercel.app';

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>TubeSummary - ${user.name || 'Your'} Feed</title>
    <link>${baseUrl}</link>
    <description>AI-powered summaries of your subscribed YouTube channels and podcasts.</description>
    <language>zh-TW</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed/user/${token}" rel="self" type="application/rss+xml"/>
    ${allItems.map(item => `
    <item>
        <title><![CDATA[${item.title}]]></title>
        <link>${item.link}</link>
        <guid isPermaLink="false">${item.guid}</guid>
        <pubDate>${item.pubDate}</pubDate>
        <description><![CDATA[
            <p><strong>From: ${item.source}</strong></p>
            ${item.description}
        ]]></description>
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
