"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import ChannelManager from '@/components/ChannelManager';
import { UserMenu } from '@/components/UserMenu';
import { SyncConflictModal } from '@/components/SyncConflictModal';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { useGuestSync } from '@/lib/hooks/useGuestSync';
import { GuestChannel } from '@/lib/types';
import { Loader2 } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const [subscriptions, setSubscriptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Guest mode state
  const [localChannels] = useLocalStorage<GuestChannel[]>('guest_channels', []);

  // Optimistic UI state
  const [optimisticChannels, setOptimisticChannels] = useState<GuestChannel[] | null>(null);

  const fetchSubscriptions = async (optimisticData?: GuestChannel[] | any) => {
    // Handle optimistic update for new channel (single object)
    if (optimisticData && !Array.isArray(optimisticData)) {
      const newChannel = optimisticData;
      setSubscriptions((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          youtube: [
            ...prev.youtube,
            { channel: newChannel }
          ]
        };
      });
      // Continue to fetch real data in background
    }

    // Handle optimistic update for Guest Mode (array)
    else if (optimisticData) {
      setOptimisticChannels(optimisticData);
      // Don't return here, we still want to fetch real data in background if needed
      // But for now, just showing optimistic data is enough
    }

    try {
      const res = await fetch('/api/subscriptions');
      const data = await res.json();
      setSubscriptions(data);
      // Clear optimistic state once real data arrives
      if (!optimisticData) {
        setOptimisticChannels(null);
      }
    } catch (error) {
      console.error("Failed to fetch subscriptions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Guest sync hook
  const { conflictModalOpen, setConflictModalOpen, handleDiscard } = useGuestSync({
    session,
    localChannels,
    onSyncComplete: fetchSubscriptions,
  });

  useEffect(() => {
    if (status === "authenticated") {
      // If we have local channels, let useGuestSync handle the initial fetch/update
      // to prevent race conditions that clear optimistic state
      if (localChannels.length > 0) {
        console.log("Skipping initial fetch in useEffect - waiting for guest sync");
      } else {
        fetchSubscriptions();
      }
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  return (
    <main className="min-h-screen dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <SyncConflictModal
        isOpen={conflictModalOpen}
        onDiscard={handleDiscard}
        onManage={() => setConflictModalOpen(false)}
      />
      <div className="flex justify-end w-full mb-4 sm:absolute sm:top-4 sm:right-4 sm:mb-0 items-center">
        {subscriptions?.quota && (
          subscriptions.quota.isAdmin ? (
            <div className="mr-4 px-3 py-1 rounded-full text-xs border bg-purple-600 text-white border-purple-500 font-bold">
              Admin ∞
            </div>
          ) : (
            <div className={`mr-4 px-3 py-1 rounded-full text-xs border ${subscriptions.quota.current >= (subscriptions.quota.limit || 1)
              ? 'text-red-400 bg-red-900/20 border-red-900/50'
              : 'text-slate-400 border-slate-700'
              }`}>
              Usage: {subscriptions.quota.current}/{subscriptions.quota.limit || 1}
            </div>
          )
        )}
        <UserMenu />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            YouTube RSS Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Turn YouTube videos into readable AI summaries & RSS feeds.
          </p>
        </div>

        {status === "loading" || loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        ) : status === "unauthenticated" ? (
          <ChannelManager
            initialChannels={[]}
            initialPodcasts={[]}
            quota={undefined}
            onRefresh={() => { }}
          />
        ) : (
          (subscriptions || optimisticChannels) && (
            <ChannelManager
              initialChannels={
                optimisticChannels
                  ? optimisticChannels
                  : subscriptions?.youtube.map((sub: any) => sub.channel) || []
              }
              initialPodcasts={
                optimisticChannels
                  ? []
                  : subscriptions?.podcasts.map((sub: any) => sub.podcast) || []
              }
              quota={subscriptions?.quota}
              onRefresh={fetchSubscriptions}
            />
          )
        )}
      </div>
    </main>
  );
}
