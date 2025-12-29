"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { TopNav } from "@/components/layout/TopNav";
import ChannelManager from "@/components/subscription/ChannelManager";

import { useTranslations } from "next-intl";

export default function SubscriptionsPage() {
    const { status } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: subscriptions, isLoading: loading, refetch } = useSubscriptions();
    const t = useTranslations('Subscriptions');
    const tCommon = useTranslations('Common');

    // Debug: Log subscriptions on every render
    console.log('[SubscriptionsPage] Render with subscriptions:', subscriptions?.youtube?.length, 'youtube,', subscriptions?.podcasts?.length, 'podcasts');
    console.log('[SubscriptionsPage] YouTube IDs:', subscriptions?.youtube?.map(s => s.id));

    // ...

    return (
        <div className="min-h-screen bg-background">
            <TopNav />

            <main className="max-w-3xl mx-auto px-4 py-8">

                {loading ? (
                    <div className="flex items-center justify-center min-h-[50vh]">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : subscriptions ? (
                    <ChannelManager
                        initialChannels={subscriptions.youtube?.map(sub => ({
                            ...sub.channel,
                            // Include subscription-level data
                            subscriptionId: sub.id,
                            summaryStyle: sub.summaryStyle,
                            summaryLanguage: sub.summaryLanguage,
                        })) || []}
                        initialPodcasts={subscriptions.podcasts?.map(sub => ({
                            ...sub.podcast,
                            last_updated: new Date(sub.podcast.last_updated),
                            // Include subscription-level data
                            subscriptionId: sub.id,
                            summaryStyle: sub.summaryStyle,
                            summaryLanguage: sub.summaryLanguage,
                        })) || []}
                        feedToken={subscriptions.feedToken}
                        onRefresh={async () => {
                            await refetch();
                            queryClient.resetQueries({ queryKey: ['feed'] });
                        }}
                    />
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>{t('failed_load')}</p>
                        <button
                            onClick={() => refetch()}
                            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                            {tCommon('retry')}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
