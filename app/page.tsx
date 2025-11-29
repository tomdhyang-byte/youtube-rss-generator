"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import ChannelManager from '@/components/ChannelManager';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AuthButton } from '@/components/AuthButton';
import { Loader2 } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const [subscriptions, setSubscriptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetchSubscriptions();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

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

  return (
    <main className="min-h-screen dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <AuthButton />
        <ThemeToggle />
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Sign in to Continue
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Please sign in with your Google account to manage your YouTube channel and podcast subscriptions.
              </p>
              <AuthButton />
            </div>
          </div>
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
