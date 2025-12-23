"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import ChannelManager from "@/components/ChannelManager";

export default function SubscriptionsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [subscriptions, setSubscriptions] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Redirect unauthenticated users
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        }
    }, [status, router]);

    const fetchSubscriptions = async () => {
        try {
            const res = await fetch('/api/subscriptions');
            if (res.ok) {
                const data = await res.json();
                setSubscriptions(data);
            }
        } catch (error) {
            console.error("Failed to fetch subscriptions:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "authenticated") {
            fetchSubscriptions();
        }
    }, [status]);

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
                        initialChannels={subscriptions.youtube?.map((sub: any) => sub.channel) || []}
                        initialPodcasts={subscriptions.podcasts?.map((sub: any) => sub.podcast) || []}
                        quota={subscriptions.quota}
                        onRefresh={fetchSubscriptions}
                    />
                ) : null}
            </main>
        </div>
    );
}
