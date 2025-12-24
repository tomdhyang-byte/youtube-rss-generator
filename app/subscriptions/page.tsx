"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { TopNav } from "@/components/layout/TopNav";
import ChannelManager from "@/components/subscription/ChannelManager";

export default function SubscriptionsPage() {
    const { status } = useSession();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: subscriptions, isLoading: loading, refetch } = useSubscriptions();

    // Redirect unauthenticated users
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [status, router]);

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (status === "unauthenticated") {
        return null;
    }

    return (
        <div className="min-h-screen bg-background">
            <TopNav />

            <main className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-8">Manage Subscriptions</h1>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : subscriptions ? (
                    <ChannelManager
                        initialChannels={subscriptions.youtube?.map(sub => sub.channel) || []}
                        initialPodcasts={subscriptions.podcasts?.map(sub => ({
                            ...sub.podcast,
                            last_updated: new Date(sub.podcast.last_updated)
                        })) || []}
                        onRefresh={() => {
                            refetch();
                            queryClient.resetQueries({ queryKey: ['feed'] });
                        }}
                    />
                ) : null}
            </main>
        </div>
    );
}
