import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { stripHtml } from '@/lib/utils';
import { Metadata } from 'next';
import { CTABanner } from '@/components/ui/CTABanner';

interface PageProps {
    params: Promise<{ videoId: string; locale: string }>;
}

export default async function VideoSummaryPage({ params }: PageProps) {
    const { videoId, locale } = await params;
    const t = await getTranslations('Detail');
    const format = await getFormatter();

    // Find the video by youtube_video_id, including summaries
    const video = await prisma.youtubeVideo.findUnique({
        where: { youtube_video_id: videoId },
        include: {
            channel: true,
            summaries: true,
        },
    });

    if (!video) {
        notFound();
    }

    // Convert URL locale to SummaryLanguage
    const preferredLanguage = locale === 'zh-TW' ? 'ZH_TW' : 'EN';

    // Priority: DEFAULT+preferred language → any+preferred language → DEFAULT+any → fallback
    const summary =
        video.summaries.find(s => s.style === 'DEFAULT' && s.language === preferredLanguage)
        || video.summaries.find(s => s.language === preferredLanguage)
        || video.summaries.find(s => s.style === 'DEFAULT')
        || video.summaries[0];

    const formattedDate = format.dateTime(new Date(video.published_at), { dateStyle: 'medium' });

    return (
        <main className="min-h-screen bg-background text-foreground">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">
                        {video.title}
                    </h1>
                    <p className="text-muted-foreground">
                        {video.channel.title} • {formattedDate}
                    </p>
                </header>

                {/* YouTube Embed */}
                <div className="aspect-video mb-8 rounded-xl overflow-hidden bg-card">
                    <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${video.youtube_video_id}`}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>

                {/* AI Summary */}
                <section className="bg-card rounded-xl p-6 border border-border">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <span>🤖</span>
                        <span>{t('ai_summary')}</span>
                    </h2>
                    {summary ? (
                        <div
                            className="prose prose-invert prose-lg max-w-none
                                prose-headings:text-foreground prose-headings:mt-6 prose-headings:mb-3
                                prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:mb-4
                                prose-li:text-foreground/90 prose-li:leading-relaxed prose-li:my-2
                                prose-strong:text-foreground prose-strong:text-orange-400
                                prose-a:text-primary
                                prose-blockquote:border-l-4 prose-blockquote:border-orange-400
                                prose-blockquote:bg-orange-400/10 prose-blockquote:rounded-r-lg
                                prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:my-4
                                prose-blockquote:not-italic prose-blockquote:text-foreground/90
                                [&>p]:my-4
                                [&_br]:block [&_br]:my-2"
                            dangerouslySetInnerHTML={{ __html: summary.content }}
                        />
                    ) : (
                        <p className="text-muted-foreground">
                            {t('summary_pending')}
                        </p>
                    )}
                </section>

                {/* CTA Banner */}
                <CTABanner />

                {/* Footer */}
                <footer className="mt-8 text-center text-muted-foreground text-sm">
                    <a
                        href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                    >
                        {t('watch_on_youtube')} →
                    </a>
                </footer>
            </div>
        </main>
    );
}

// Generate metadata for SEO and Open Graph
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { videoId } = await params;
    const t = await getTranslations('Detail');

    const video = await prisma.youtubeVideo.findUnique({
        where: { youtube_video_id: videoId },
        include: { channel: true, summaries: true },
    });

    if (!video) {
        return { title: 'Video Not Found' };
    }

    const summary = video.summaries[0];
    const description = summary
        ? stripHtml(summary.content).slice(0, 160)
        : `${t('ai_summary')}: ${video.title}`;
    const title = `${video.title} | ${t('ai_summary')}`;
    const imageUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

    return {
        title,
        description,
        openGraph: {
            title: video.title,
            description,
            type: 'article',
            siteName: 'TubeSummary',
            images: [imageUrl],
        },
        twitter: {
            card: 'summary_large_image',
            title: video.title,
            description,
            images: [imageUrl],
        },
    };
}
