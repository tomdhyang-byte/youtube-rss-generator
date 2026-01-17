import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { stripHtml } from '@/lib/utils';
import { Metadata } from 'next';
import { CTABanner } from '@/components/ui/CTABanner';

interface PageProps {
    params: Promise<{ episodeId: string; locale: string }>;
}

export default async function EpisodeSummaryPage({ params }: PageProps) {
    const { episodeId, locale } = await params;
    const id = parseInt(episodeId);
    const t = await getTranslations('Detail');
    const format = await getFormatter();

    if (isNaN(id)) {
        notFound();
    }

    // Find the episode by id, including summaries
    const episode = await prisma.podcastEpisode.findUnique({
        where: { id },
        include: {
            podcast: true,
            summaries: true, // Include all summaries
        },
    });

    if (!episode) {
        notFound();
    }

    // Convert URL locale to SummaryLanguage
    const preferredLanguage = locale === 'zh-TW' ? 'ZH_TW' : 'EN';

    // Priority: DEFAULT+preferred language → any+preferred language → DEFAULT+any → fallback
    const summary =
        episode.summaries.find(s => s.style === 'DEFAULT' && s.language === preferredLanguage)
        || episode.summaries.find(s => s.language === preferredLanguage)
        || episode.summaries.find(s => s.style === 'DEFAULT')
        || episode.summaries[0];

    const formattedDate = format.dateTime(new Date(episode.published_at), { dateStyle: 'medium' });

    return (
        <main className="min-h-screen bg-background text-foreground">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">
                        {episode.title}
                    </h1>
                    <p className="text-muted-foreground">
                        {episode.podcast.title} • {formattedDate}
                    </p>
                </header>

                {/* Audio Player */}
                <div className="mb-8 bg-card rounded-xl p-4 border border-border">
                    <audio
                        controls
                        className="w-full"
                        preload="metadata"
                    >
                        <source src={episode.audio_url} type="audio/mpeg" />
                        Your browser does not support the audio element.
                    </audio>
                    <p className="mt-2 text-sm text-muted-foreground text-center">
                        <a
                            href={episode.audio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground transition-colors"
                        >
                            {t('download_audio')} →
                        </a>
                    </p>
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
                    {episode.podcast.site_url && (
                        <a
                            href={episode.podcast.site_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground transition-colors"
                        >
                            {t('visit_website')} →
                        </a>
                    )}
                </footer>
            </div>
        </main>
    );
}

// Generate metadata for SEO and Open Graph
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { episodeId } = await params;
    const id = parseInt(episodeId);
    const t = await getTranslations('Detail');

    if (isNaN(id)) {
        return { title: 'Episode Not Found' };
    }

    const episode = await prisma.podcastEpisode.findUnique({
        where: { id },
        include: { podcast: true, summaries: true },
    });

    if (!episode) {
        return { title: 'Episode Not Found' };
    }

    const summary = episode.summaries[0];
    const description = summary
        ? stripHtml(summary.content).slice(0, 160)
        : `${t('ai_summary')}: ${episode.title}`;
    const title = `${episode.title} | ${t('ai_summary')}`;
    const imageUrl = episode.podcast.image_url || undefined;

    return {
        title,
        description,
        openGraph: {
            title: episode.title,
            description,
            type: 'article',
            siteName: 'TubeSummary',
            ...(imageUrl && { images: [imageUrl] }),
        },
        twitter: {
            card: imageUrl ? 'summary_large_image' : 'summary',
            title: episode.title,
            description,
            ...(imageUrl && { images: [imageUrl] }),
        },
    };
}
