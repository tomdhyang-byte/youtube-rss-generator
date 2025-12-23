import { withAuth } from "next-auth/middleware";

export default withAuth;

export const config = {
    matcher: [
        /*
         * Match all request paths that require authentication:
         * - /feed (Feed page - requires login)
         * - /subscriptions (Subscription management - requires login)
         * - /api/channels/* (Channel CRUD)
         * - /api/podcasts/* (Podcast CRUD)
         * - /api/subscriptions/* (Subscription API)
         * - /api/feed (Feed API)
         * 
         * Excluded (public):
         * - / (Landing page)
         * - /api/auth/* (NextAuth routes)
         * - /feed/[channelId] (RSS feeds for readers - note: different from /feed page)
         * - /video/* and /episode/* (Summary pages)
         */
        '/feed',
        '/subscriptions',
        '/api/channels/:path*',
        '/api/podcasts/:path*',
        '/api/subscriptions/:path*',
        '/api/feed',
    ],
};
