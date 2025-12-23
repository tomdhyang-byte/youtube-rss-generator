'use client';

import { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { cn, getSourceColor, getSourceLabel } from '@/lib/utils';
import { FeedItem } from '@/lib/types';

interface ArticleModalProps {
    isOpen: boolean;
    onClose: () => void;
    article: FeedItem;
}

export function ArticleModal({ isOpen, onClose, article }: ArticleModalProps) {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const externalUrl = article.type === 'video'
        ? `https://www.youtube.com/watch?v=${article.id}`
        : article.siteUrl;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-background rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <span className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded",
                            getSourceColor(article.type)
                        )}>
                            {getSourceLabel(article.type)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                            {article.source}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {externalUrl && (
                            <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-accent rounded-lg transition-colors"
                                title="在新分頁開啟"
                            >
                                <ExternalLink className="w-5 h-5 text-muted-foreground" />
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-accent rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* Title */}
                        <h1 className="text-2xl font-bold">{article.title}</h1>

                        {/* Media Player */}
                        {article.type === 'video' && article.youtubeVideoId && (
                            <div className="aspect-video rounded-xl overflow-hidden bg-card max-w-2xl mx-auto w-full">
                                <iframe
                                    className="w-full h-full"
                                    src={`https://www.youtube.com/embed/${article.youtubeVideoId}`}
                                    title={article.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        )}

                        {article.type === 'episode' && article.audioUrl && (
                            <div className="bg-card rounded-xl p-4 border border-border">
                                <audio
                                    controls
                                    className="w-full"
                                    preload="metadata"
                                >
                                    <source src={article.audioUrl} type="audio/mpeg" />
                                    Your browser does not support the audio element.
                                </audio>
                            </div>
                        )}

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
                                dangerouslySetInnerHTML={{ __html: article.summary }}
                            />
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
