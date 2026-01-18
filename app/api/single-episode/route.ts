import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseSingleEpisodeUrl } from '@/lib/services/urlParser';
import { isValidStyle, SummaryStyle } from '@/lib/types/summary-style';
import { isValidLanguage, SummaryLanguage } from '@/lib/types/summary-language';

export const dynamic = 'force-dynamic';

const SINGLE_EPISODE_LIMIT = 50;
const SINGLE_EPISODE_PRIORITY = 10;

interface RequestBody {
    url: string;
    style: string;
    language: string;
}

export async function POST(request: Request) {
    // Feature flag check
    if (process.env.ENABLE_SINGLE_EPISODE !== 'true') {
        return NextResponse.json(
            { error: 'FEATURE_DISABLED', message: 'This feature is not yet available' },
            { status: 503 }
        );
    }

    // Authentication check
    const session = await getSession();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    let body: RequestBody;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'INVALID_REQUEST', message: 'Invalid request body' },
            { status: 400 }
        );
    }

    const { url, style, language } = body;

    // Validate inputs
    if (!url || typeof url !== 'string') {
        return NextResponse.json(
            { error: 'INVALID_URL', message: 'URL is required' },
            { status: 400 }
        );
    }

    if (!isValidStyle(style)) {
        return NextResponse.json(
            { error: 'INVALID_STYLE', message: 'Invalid style' },
            { status: 400 }
        );
    }

    if (!isValidLanguage(language)) {
        return NextResponse.json(
            { error: 'INVALID_LANGUAGE', message: 'Invalid language' },
            { status: 400 }
        );
    }

    // Type-safe values after validation
    const validatedStyle = style as SummaryStyle;
    const validatedLanguage = language as SummaryLanguage;

    // Parse URL
    const parseResult = parseSingleEpisodeUrl(url);

    if (!parseResult.success) {
        const errorMessages: Record<string, string> = {
            INVALID_URL: 'Invalid or unsupported URL',
            SHORTS_NOT_SUPPORTED: 'YouTube Shorts are not supported',
            UNSUPPORTED_PLATFORM: 'This platform is not supported',
        };

        return NextResponse.json(
            {
                error: parseResult.error,
                message: errorMessages[parseResult.error] || 'Invalid URL',
            },
            { status: 400 }
        );
    }

    try {
        if (parseResult.type === 'youtube_video') {
            return await handleYouTubeVideo(
                userId,
                parseResult.videoId,
                validatedStyle,
                validatedLanguage
            );
        } else if (parseResult.type === 'podcast_episode') {
            return await handlePodcastEpisode(
                userId,
                parseResult.episodeUrl,
                validatedStyle,
                validatedLanguage
            );
        }

        return NextResponse.json(
            { error: 'UNSUPPORTED_TYPE', message: 'Unsupported content type' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Error processing single episode:', error);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An error occurred' },
            { status: 500 }
        );
    }
}

async function handleYouTubeVideo(
    userId: string,
    youtubeVideoId: string,
    style: SummaryStyle,
    language: SummaryLanguage
) {
    return await prisma.$transaction(async (tx) => {
        // 1. Find or create video record
        let video = await tx.youtubeVideo.findUnique({
            where: { youtube_video_id: youtubeVideoId },
        });

        if (!video) {
            // Create placeholder channel if needed
            let channel = await tx.youtubeChannel.findFirst({
                where: { youtube_id: 'SINGLE_VIDEOS_PLACEHOLDER' },
            });

            if (!channel) {
                channel = await tx.youtubeChannel.create({
                    data: {
                        youtube_id: 'SINGLE_VIDEOS_PLACEHOLDER',
                        title: 'Single Videos',
                        description: 'Placeholder for single video submissions',
                    },
                });
            }

            video = await tx.youtubeVideo.create({
                data: {
                    youtube_video_id: youtubeVideoId,
                    channel_id: channel.id,
                    title: 'Processing...',
                    published_at: new Date(),
                },
            });
        }

        // 2. Check for existing UserSingleEpisode
        const existingRecord = await tx.userSingleEpisode.findFirst({
            where: { userId, videoId: video.id },
        });

        if (existingRecord) {
            // Check if summary exists with matching style/language
            const existingSummary = await tx.videoSummary.findFirst({
                where: { videoId: video.id, style, language },
            });

            // Check subscription link
            const subscription = await tx.youtubeSubscription.findFirst({
                where: { userId, channelId: video.channel_id },
            });

            return NextResponse.json({
                status: existingSummary ? 'ready' : 'queued',
                episodeType: 'video',
                id: existingRecord.id,
                externalId: youtubeVideoId,
                linkedToSubscription: !!subscription,
                summary: existingSummary?.content,
            });
        }

        // 3. FIFO deletion if at limit
        const count = await tx.userSingleEpisode.count({ where: { userId } });
        if (count >= SINGLE_EPISODE_LIMIT) {
            const oldest = await tx.userSingleEpisode.findFirst({
                where: { userId },
                orderBy: { createdAt: 'asc' },
            });
            if (oldest) {
                await tx.userSingleEpisode.delete({ where: { id: oldest.id } });
            }
        }

        // 4. Check for existing summary
        const existingSummary = await tx.videoSummary.findFirst({
            where: { videoId: video.id, style, language },
        });

        // 5. Create UserSingleEpisode
        const newRecord = await tx.userSingleEpisode.create({
            data: {
                userId,
                videoId: video.id,
                style,
                language,
                status: existingSummary ? 'COMPLETED' : 'PENDING',
            },
        });

        // 6. Add to queue if no existing summary
        if (!existingSummary) {
            await tx.processingQueue.create({
                data: {
                    type: 'SINGLE_VIDEO',
                    entityId: video.id,
                    priority: SINGLE_EPISODE_PRIORITY,
                    requestedByUserId: userId,
                    requestedStyle: style,
                    requestedLanguage: language,
                },
            });
        }

        // Check subscription link
        const subscription = await tx.youtubeSubscription.findFirst({
            where: { userId, channelId: video.channel_id },
        });

        return NextResponse.json({
            status: existingSummary ? 'ready' : 'queued',
            episodeType: 'video',
            id: newRecord.id,
            externalId: youtubeVideoId,
            linkedToSubscription: !!subscription,
            summary: existingSummary?.content,
        });
    });
}

async function handlePodcastEpisode(
    userId: string,
    episodeUrl: string,
    style: SummaryStyle,
    language: SummaryLanguage
) {
    // For podcast episodes, we need to find or create the episode
    // This is more complex as we need to fetch episode metadata
    // For now, return not implemented
    return NextResponse.json(
        { error: 'NOT_IMPLEMENTED', message: 'Podcast single episodes coming soon' },
        { status: 501 }
    );
}
