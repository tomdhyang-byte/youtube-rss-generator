/**
 * Skeleton loading component that matches FeedCard layout.
 * Shows animated placeholder while content is loading.
 */
export function FeedCardSkeleton() {
    return (
        <div className="block">
            <article className="flex gap-4 p-4 rounded-xl border border-border/30 bg-card/50">
                {/* Thumbnail Skeleton */}
                <div className="flex-shrink-0 w-32 h-20 md:w-40 md:h-24 rounded-lg bg-muted animate-pulse" />

                {/* Content Skeleton */}
                <div className="flex-1 min-w-0 space-y-3">
                    {/* Title */}
                    <div className="h-5 bg-muted rounded animate-pulse w-3/4" />

                    {/* Source + Date */}
                    <div className="h-4 bg-muted rounded animate-pulse w-1/3" />

                    {/* Summary (hidden on mobile) */}
                    <div className="hidden md:block h-4 bg-muted rounded animate-pulse w-full" />
                </div>
            </article>
        </div>
    );
}
