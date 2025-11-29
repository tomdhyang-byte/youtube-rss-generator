export { default } from "next-auth/middleware";

export const config = {
    matcher: [
        /*
         * Match all request paths EXCEPT:
         * - /api/auth/* (NextAuth routes - must be public)
         * - /feed/* (RSS feeds - must be public for RSS readers)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - / (home page with login - must be accessible)
         * 
         * This protects all API routes except auth and feeds
         */
        '/api/channels/:path*',
        '/api/podcasts/:path*',
        '/api/subscriptions/:path*',
    ],
};
