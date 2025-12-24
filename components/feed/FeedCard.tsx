import Image from 'next/image';
import { Play, Podcast } from 'lucide-react';
import { cn, getSourceLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface FeedCardProps {
    type: 'video' | 'episode';
    id: string;
    title: string;
    source: string;
    summary: string;
    publishedAt: string;
    thumbnail: string | null;
    isRead?: boolean;
    onRead?: () => void;
}

export function FeedCard({ type, id, title, source, summary, publishedAt, thumbnail, isRead = false, onRead }: FeedCardProps) {
    const formattedDate = formatRelativeDate(publishedAt);

    // Truncate summary for preview
    const summaryPreview = stripHtml(summary).slice(0, 200) + (summary.length > 200 ? '...' : '');

    // Use next/image for YouTube (whitelisted), regular img for podcasts (any domain)
    const isYouTubeThumbnail = thumbnail?.includes('i.ytimg.com');

    const handleClick = () => {
        onRead?.();
    };

    return (
        <div
            onClick={handleClick}
            className="block group cursor-pointer"
        >
            <article className={cn(
                "flex gap-4 p-4 rounded-xl border transition-all relative",
                isRead
                    ? "border-border/30 bg-card/50 opacity-60 hover:opacity-80"
                    : "border-border/50 bg-card border-l-4 border-l-orange-500 hover:border-border hover:bg-accent/30"
            )}>
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-32 h-20 md:w-40 md:h-24 rounded-lg overflow-hidden bg-muted relative">
                    {thumbnail ? (
                        isYouTubeThumbnail ? (
                            <Image
                                src={thumbnail}
                                alt={title}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 128px, 160px"
                            />
                        ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={thumbnail}
                                alt={title}
                                className="w-full h-full object-cover"
                            />
                        )
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            {type === 'video' ? <Play className="w-8 h-8" /> : <Podcast className="w-8 h-8" />}
                        </div>
                    )}
                    {/* Type badge */}
                    <Badge
                        variant={type === 'video' ? 'youtube' : 'podcast'}
                        className="absolute top-1 left-1"
                    >
                        {getSourceLabel(type)}
                    </Badge>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className={cn(
                        "font-semibold transition-colors line-clamp-2",
                        isRead
                            ? "text-muted-foreground group-hover:text-foreground"
                            : "text-foreground group-hover:text-primary"
                    )}>
                        {title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {source} • {formattedDate}
                    </p>
                    <p className="text-sm text-muted-foreground/80 mt-2 line-clamp-2 hidden md:block">
                        {summaryPreview}
                    </p>
                </div>
            </article>
        </div>
    );
}

function formatRelativeDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('zh-TW');
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}
