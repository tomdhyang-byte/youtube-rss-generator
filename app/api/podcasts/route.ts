import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Parser from 'rss-parser';

const prisma = new PrismaClient();
const parser = new Parser();

export async function POST(request: Request) {
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

        // 1. Spotify Rejection
        if (url.includes('spotify.com')) {
            return NextResponse.json(
                { error: 'Spotify links are not supported (Walled Garden). Please use Apple Podcasts link or RSS.' },
                { status: 400 }
            );
        }

        // 2. Apple Podcast Lookup
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

        // 3. RSS Validation
        try {
            const feed = await parser.parseURL(feedUrl);
            title = feed.title || '';
            description = feed.description || '';
            siteUrl = feed.link || '';
            imageUrl = feed.image?.url || '';
        } catch (error) {
            return NextResponse.json({ error: 'Invalid RSS feed' }, { status: 400 });
        }

        // 4. Save to DB
        const podcast = await prisma.podcastChannel.upsert({
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

        return NextResponse.json(podcast);

    } catch (error) {
        console.error('Error adding podcast:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
