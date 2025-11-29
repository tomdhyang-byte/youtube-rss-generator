import { prisma } from '@/lib/prisma';
import ChannelManager from '@/components/ChannelManager';
import { ThemeToggle } from '@/components/ThemeToggle';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const channels = await prisma.channel.findMany({
    orderBy: { last_updated: 'desc' },
  });

  return (
    <main className="min-h-screen dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="absolute top-4 right-4">
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

        <ChannelManager initialChannels={channels} />
      </div>
    </main>
  );
}
