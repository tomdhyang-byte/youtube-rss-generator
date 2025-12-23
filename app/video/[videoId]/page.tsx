import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{ videoId: string }>;
}

export default async function VideoSummaryPage({ params }: PageProps) {
    const { videoId } = await params;

    // Find the video by youtube_video_id
    const video = await prisma.youtubeVideo.findUnique({
        where: { youtube_video_id: videoId },
        include: { channel: true },
    });

    if (!video) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-background text-foreground">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">
                        {video.title}
                    </h1>
                    <p className="text-muted-foreground">
                        {video.channel.title} • {new Date(video.published_at).toLocaleDateString('zh-TW')}
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
                        <span>AI 摘要</span>
                    </h2>
                    <div
                        className="prose prose-invert prose-lg max-w-none
                            prose-headings:text-foreground prose-headings:mt-6 prose-headings:mb-3
                            prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:mb-4
                            prose-li:text-foreground/90 prose-li:leading-relaxed prose-li:my-2
                            prose-strong:text-foreground prose-strong:text-orange-400
                            prose-a:text-primary
                            [&>p]:my-4
                            [&_br]:block [&_br]:my-2"
                        dangerouslySetInnerHTML={{ __html: video.summary }}
                    />
                </section>

                {/* Footer */}
                <footer className="mt-8 text-center text-muted-foreground text-sm">
                    <a
                        href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                    >
                        在 YouTube 上觀看原始影片 →
                    </a>
                </footer>
            </div>
        </main>
    );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
    const { videoId } = await params;

    const video = await prisma.youtubeVideo.findUnique({
        where: { youtube_video_id: videoId },
        include: { channel: true },
    });

    if (!video) {
        return { title: 'Video Not Found' };
    }

    return {
        title: `${video.title} | AI Summary`,
        description: `AI-generated summary for ${video.title} by ${video.channel.title}`,
    };
}
