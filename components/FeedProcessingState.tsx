'use client';

import { Loader2, Sparkles } from 'lucide-react';

interface FeedProcessingStateProps {
    onCheckAgain: () => void;
}

export function FeedProcessingState({ onCheckAgain }: FeedProcessingStateProps) {
    return (
        <div className="py-16 text-center animate-in fade-in zoom-in duration-500">
            {/* Visual: Pulse Animation with Icon */}
            <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-ping" />
                <div className="relative w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center border border-orange-200 dark:border-orange-800">
                    <Sparkles className="w-10 h-10 text-orange-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 shadow-sm border border-border">
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                </div>
            </div>

            <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                We are analyzing your content...
            </h2>

            <div className="max-w-md mx-auto space-y-2 text-muted-foreground mb-8">
                <p>
                    This process usually takes about 5 minutes for new subscriptions. Feel free to check back soon.
                </p>
            </div>
        </div>
    );
}
