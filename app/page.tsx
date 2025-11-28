import { PrismaClient } from '@prisma/client';
import ChannelManager from '@/components/ChannelManager';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export default async function Home() {
  const channels = await prisma.channel.findMany({
    orderBy: { last_updated: 'desc' },
  });

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            YouTube RSS Generator
          </h1>
          <p className="text-gray-600">
            Generate AI-summarized RSS feeds for your favorite channels.
          </p>
        </div>

        <ChannelManager initialChannels={channels} />
      </div>
    </main>
  );
}
