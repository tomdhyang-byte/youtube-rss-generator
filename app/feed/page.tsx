"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { FeedCard } from "@/components/FeedCard";
import { AddChannelForm } from "@/components/ChannelManager/AddChannelForm";
import { cn } from "@/lib/utils";

interface FeedItem {
    type: 'video' | 'episode';
    id: string;
    title: string;
    source: string;
    sourceId: string;
    summary: string;
    publishedAt: string;
    thumbnail: string | null;
}

type FilterType = 'all' | 'youtube' | 'podcast';

export default function FeedPage() {
    const { status } = useSession();
    const router = useRouter();
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');

    // Redirect unauthenticated users
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [status, router]);

    // Fetch feed
    const fetchFeed = async (filterType: FilterType = filter) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/feed?filter=${filterType}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
            }
        } catch (error) {
            console.error("Failed to fetch feed:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "authenticated") {
            fetchFeed();
        }
    }, [status]);

    const handleFilterChange = (newFilter: FilterType) => {
        setFilter(newFilter);
        fetchFeed(newFilter);
    };

    const handleChannelAdded = () => {
        // Refresh feed after adding
        fetchFeed();
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

    // Distinguish between "no subscriptions at all" vs "filter has no results"
    const isEmpty = !loading && items.length === 0;
    const isFilteredEmpty = isEmpty && filter !== 'all';
    const isCompletelyEmpty = isEmpty && filter === 'all';

    return (
        <div className="min-h-screen bg-background">
            <TopNav />

            <main className="max-w-3xl mx-auto px-4 py-8">
                {/* Header with filters - always show if not completely empty */}
                {!isCompletelyEmpty && (
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold">Your Feed</h1>
                        <div className="flex gap-1 bg-muted rounded-lg p-1">
                            {(['all', 'youtube', 'podcast'] as FilterType[]).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => handleFilterChange(f)}
                                    className={cn(
                                        "px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
                                        filter === f
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {f === 'all' ? 'All' : f === 'youtube' ? 'YouTube' : 'Podcasts'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content */}
                {isCompletelyEmpty ? (
                    // No subscriptions at all - show Add forms
                    <EmptyState onChannelAdded={handleChannelAdded} />
                ) : isFilteredEmpty ? (
                    // Filter has no results - show simple message with link to All
                    <FilteredEmptyState
                        filterName={filter === 'youtube' ? 'YouTube' : 'Podcast'}
                        onShowAll={() => handleFilterChange('all')}
                    />
                ) : loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    // Feed items
                    <div className="space-y-3">
                        {items.map((item) => (
                            <FeedCard
                                key={`${item.type}-${item.id}`}
                                {...item}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

// Empty state when filter has no results (but user has other subscriptions)
function FilteredEmptyState({ filterName, onShowAll }: { filterName: string; onShowAll: () => void }) {
    return (
        <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">No {filterName} content</h2>
            <p className="text-muted-foreground mb-6">
                You don&apos;t have any {filterName} subscriptions yet.
            </p>
            <button
                onClick={onShowAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
            >
                View All Content
            </button>
        </div>
    );
}

function EmptyState({ onChannelAdded }: { onChannelAdded: () => void }) {
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [podcastUrl, setPodcastUrl] = useState('');
    const [youtubeLoading, setYoutubeLoading] = useState(false);
    const [podcastLoading, setPodcastLoading] = useState(false);

    const handleYoutubeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!youtubeUrl.trim()) return;

        setYoutubeLoading(true);
        try {
            const res = await fetch('/api/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: youtubeUrl }),
            });
            const data = await res.json();
            if (res.ok) {
                setYoutubeUrl('');
                toast.success('YouTube channel added!');
                toast.info("AI summaries will appear after the worker processes new videos.");
                onChannelAdded();
            } else {
                toast.error(data.error || 'Failed to add channel');
            }
        } catch (error) {
            console.error('Failed to add channel:', error);
            toast.error('Failed to add channel');
        } finally {
            setYoutubeLoading(false);
        }
    };

    const handlePodcastSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!podcastUrl.trim()) return;

        setPodcastLoading(true);
        try {
            const res = await fetch('/api/podcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: podcastUrl }),
            });
            const data = await res.json();
            if (res.ok) {
                setPodcastUrl('');
                toast.success('Podcast added!');
                toast.info("AI summaries will appear after the worker processes new episodes.");
                onChannelAdded();
            } else {
                toast.error(data.error || 'Failed to add podcast');
            }
        } catch (error) {
            console.error('Failed to add podcast:', error);
            toast.error('Failed to add podcast');
        } finally {
            setPodcastLoading(false);
        }
    };

    return (
        <div className="py-12 text-center">
            {/* Empty illustration */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-12 h-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            </div>

            <h2 className="text-2xl font-bold mb-2">Your feed is empty</h2>
            <p className="text-muted-foreground mb-8">
                Start by adding your first YouTube channel or Podcast
            </p>

            {/* Add forms */}
            <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {/* YouTube */}
                <form onSubmit={handleYoutubeSubmit} className="p-6 rounded-xl border border-border bg-card">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                    </div>
                    <h3 className="font-semibold mb-3">Add YouTube Channel</h3>
                    <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="Paste YouTube URL..."
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mb-3"
                    />
                    <button
                        type="submit"
                        disabled={youtubeLoading || !youtubeUrl.trim()}
                        className="w-full px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {youtubeLoading ? 'Adding...' : 'Add Channel'}
                    </button>
                </form>

                {/* Podcast */}
                <form onSubmit={handlePodcastSubmit} className="p-6 rounded-xl border border-border bg-card">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                    </div>
                    <h3 className="font-semibold mb-3">Add Podcast</h3>
                    <input
                        type="text"
                        value={podcastUrl}
                        onChange={(e) => setPodcastUrl(e.target.value)}
                        placeholder="Paste Podcast RSS URL..."
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mb-3"
                    />
                    <button
                        type="submit"
                        disabled={podcastLoading || !podcastUrl.trim()}
                        className="w-full px-4 py-2 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {podcastLoading ? 'Adding...' : 'Add Podcast'}
                    </button>
                </form>
            </div>
        </div>
    );
}
