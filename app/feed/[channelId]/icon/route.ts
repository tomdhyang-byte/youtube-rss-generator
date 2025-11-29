import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ channelId: string }> }
) {
    try {
        const { channelId: channelIdStr } = await params;
        const channelId = parseInt(channelIdStr);

        if (isNaN(channelId)) {
            return new NextResponse('Invalid Channel ID', { status: 400 });
        }

        // Get channel avatar URL from database
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { avatar_url: true }
        });

        if (!channel || !channel.avatar_url) {
            return new NextResponse('Channel not found or no avatar', { status: 404 });
        }

        // Redirect to the YouTube avatar URL
        return NextResponse.redirect(channel.avatar_url, 302);

    } catch (error) {
        console.error('Error fetching channel icon:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
