import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';

interface PageProps {
    params: Promise<{ episodeId: string }>;
}

export default async function EpisodeSummaryPage({ params }: PageProps) {
    const { episodeId } = await params;
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

    // Get the first available summary (prefer DEFAULT)
    const summary = episode.summaries.find(s => s.style === 'DEFAULT')
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

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
    const { episodeId } = await params;
    const id = parseInt(episodeId);
    const t = await getTranslations('Detail');

    if (isNaN(id)) {
        return { title: 'Episode Not Found' };
    }

    const episode = await prisma.podcastEpisode.findUnique({
        where: { id },
        include: { podcast: true },
    });

    if (!episode) {
        return { title: 'Episode Not Found' };
    }

    return {
        title: `${episode.title} | ${t('ai_summary')}`,
        description: `AI-generated summary for ${episode.title} from ${episode.podcast.title}`,
    };
}
