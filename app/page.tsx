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

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/subscriptions');
      const data = await res.json();
      setSubscriptions(data);
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
      fetchSubscriptions();
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
      <div className="absolute top-4 right-4">
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
          subscriptions && (
            <ChannelManager
              initialChannels={subscriptions.youtube.map((sub: any) => sub.channel)}
              initialPodcasts={subscriptions.podcasts.map((sub: any) => sub.podcast)}
              quota={subscriptions.quota}
              onRefresh={fetchSubscriptions}
            />
          )
        )}
      </div>
    </main>
  );
}
