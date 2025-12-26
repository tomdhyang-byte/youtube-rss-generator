"use client";

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollTriggerProps {
    onTrigger: () => void;
    hasMore: boolean;
    isLoading: boolean;
}

/**
 * A component that triggers loading more content when it becomes visible.
 * Place this at the bottom of your scrollable list.
 */
export function InfiniteScrollTrigger({ onTrigger, hasMore, isLoading }: InfiniteScrollTriggerProps) {
    const triggerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = triggerRef.current;
        if (!element || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoading) {
                    onTrigger();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [onTrigger, hasMore, isLoading]);

    if (!hasMore) {
        return null;
    }

    return (
        <div ref={triggerRef} className="flex justify-center py-8">
            {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
                <span className="text-sm text-muted-foreground">Scroll for more...</span>
            )}
        </div>
    );
}
