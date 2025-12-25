"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useFeed, fetchFeed } from "@/hooks/useFeed";
import { useSubscriptions, fetchSubscriptions } from "@/hooks/useSubscriptions";
import { TopNav } from "@/components/layout/TopNav";
import { FeedCard } from "@/components/feed/FeedCard";
import { ArticleModal } from "@/components/feed/ArticleModal";
import { FeedProcessingState } from "@/components/feed/FeedProcessingState";
import { useReadStatus } from "@/hooks/useReadStatus";
import { cn } from "@/lib/utils";
import { FeedItem } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useTranslations } from "next-intl";

type FilterType = 'all' | 'youtube' | 'podcast';

export default function FeedPage() {
    const { status } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<FilterType>('all');
    const { data, isLoading: loading, refetch: refetchFeed } = useFeed(filter);
    const { data: subData } = useSubscriptions();
    const items = data?.items || [];
    const { isRead, markAsRead } = useReadStatus();

    // ✅ All hooks MUST be called before any conditional returns
    const t = useTranslations('Feed');

    // Article Modal state
    const [selectedArticle, setSelectedArticle] = useState<FeedItem | null>(null);

    // Redirect unauthenticated users
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [status, router]);

    // Prefetch all feeds on mount to mask DB latency
    useEffect(() => {
        if (status === "authenticated") {
            (['all', 'youtube', 'podcast'] as FilterType[]).forEach(filter => {
                queryClient.prefetchQuery({
                    queryKey: ['feed', filter],
                    queryFn: () => fetchFeed(filter),
                    staleTime: 5 * 60 * 1000 // 5 minutes
                });
            });

            // Prefetch subscriptions
            queryClient.prefetchQuery({
                queryKey: ['subscriptions'],
                queryFn: fetchSubscriptions,
                staleTime: 5 * 60 * 1000
            });
        }
    }, [status, queryClient]);

    const handleFilterChange = (newFilter: FilterType) => {
        setFilter(newFilter);
    };

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (status === "unauthenticated") {
        return null; // Will redirect
    }

    // Distinguish between states
    const isEmpty = !loading && items.length === 0;
    const hasSubscriptions = (subData?.youtube?.length || 0) + (subData?.podcasts?.length || 0) > 0;

    // 1. Completely Empty (No Subs) -> Show EmptyState with CTA
    // 2. Processing (Has Subs, but No Feed) -> Show ProcessingState
    // 3. Filter Empty (Has Sub, No Feed for this filter) -> Show FilteredEmptyState

    const isNoSubs = isEmpty && !hasSubscriptions && filter === 'all';
    const isProcessing = isEmpty && hasSubscriptions && filter === 'all';
    const isFilteredEmpty = isEmpty && !isProcessing && filter !== 'all';

    const showFilters = !loading && !isNoSubs && !isProcessing;

    return (
        <div className="min-h-screen bg-background">
            <TopNav />

            <main className="max-w-3xl mx-auto px-4 py-8">
                {/* Header with filters - always show if not completely empty */}
                {showFilters && (
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex gap-1 bg-muted rounded-lg p-1">
                            {(['all', 'youtube', 'podcast'] as FilterType[]).map((f) => (
                                <Button
                                    key={f}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleFilterChange(f)}
                                    className={cn(
                                        "capitalize",
                                        filter === f
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {f === 'all' ? t('filter_all') : f === 'youtube' ? t('filter_youtube') : t('filter_podcast')}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content */}
                {isNoSubs ? (
                    // No subscriptions at all - show CTA to go to subscriptions page
                    <EmptyState />
                ) : isProcessing ? (
                    // Has subscriptions but no feed yet - show Processing
                    <FeedProcessingState onCheckAgain={() => refetchFeed()} />
                ) : isFilteredEmpty ? (
                    // Filter has no results - show simple message with link to All
                    <FilteredEmptyState
                        filterName={filter === 'youtube' ? t('filter_youtube') : t('filter_podcast')}
                        onShowAll={() => handleFilterChange('all')}
                    />
                ) : loading ? (
                    <div className="flex items-center justify-center min-h-[50vh]">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    // Feed items
                    <div className="space-y-3">
                        {items.map((item) => (
                            <FeedCard
                                key={`${item.type}-${item.id}`}
                                {...item}
                                isRead={isRead(item.type, item.id)}
                                onRead={() => {
                                    markAsRead(item.type, item.id);
                                    setSelectedArticle(item);
                                }}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Article Modal */}
            {selectedArticle && (
                <ArticleModal
                    isOpen={!!selectedArticle}
                    onClose={() => setSelectedArticle(null)}
                    article={selectedArticle}
                />
            )}
        </div>
    );
}

// Empty state when filter has no results (but user has other subscriptions)
function FilteredEmptyState({ filterName, onShowAll }: { filterName: string; onShowAll: () => void }) {
    const t = useTranslations('Feed');
    return (
        <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">{t('no_content_title', { filter: filterName })}</h2>
            <p className="text-muted-foreground mb-6">
                {t('no_content_desc', { filter: filterName })}
            </p>
            <Button
                variant="primary"
                onClick={onShowAll}
            >
                {t('view_all')}
            </Button>
        </div>
    );
}

function EmptyState() {
    const router = useRouter();
    const t = useTranslations('Feed');

    return (
        <div className="py-12 text-center">
            {/* Empty illustration */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-12 h-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            </div>

            <h2 className="text-2xl font-bold mb-2">{t('empty_title')}</h2>
            <p className="text-muted-foreground mb-8">
                {t('empty_desc')}
            </p>

            {/* CTA Button */}
            <Button
                variant="primary"
                size="lg"
                onClick={() => router.push('/subscriptions')}
            >
                {t('add_first_sub')}
            </Button>
        </div>
    );
}
