
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
    // 1. Whitelist: Skip auth for these paths
    const { pathname } = req.nextUrl;
    console.log(`[Middleware] Checking path: ${pathname} `);

    // - RSS Feeds (Critical for readers)
    if (pathname.startsWith('/feed') || pathname.startsWith('/api/feed')) {
        return NextResponse.next();
    }

    // - Static assets and Next.js internals
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    // 2. Check Basic Auth
    const authHeader = req.headers.get('authorization');
    const password = process.env.AUTH_PASSWORD;

    // If no password set in env, skip auth (fail open or closed? usually open for dev, but let's be safe)
    // Requirement says "Read env var". If not set, maybe we should block or allow?
    // Let's assume if not set, we don't protect (or maybe we should warn).
    // For a "Hotfix", if they forget to set it, they might get locked out if we default to block.
    // Let's assume if AUTH_PASSWORD is set, we enforce it.
    if (!password) {
        return NextResponse.next();
    }

    if (authHeader) {
        // Header format: "Basic base64(user:pass)"
        const authValue = authHeader.split(' ')[1];
        const [user, pass] = atob(authValue).split(':');

        if (user === 'admin' && pass === password) {
            return NextResponse.next();
        }
    }

    // 3. Challenge (401)
    return new NextResponse('Unauthorized', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="Secure Dashboard"',
        },
    });
}

// Configure which paths invoke the middleware
export const config = {
    matcher: [
        /*
         * Match all request paths EXCEPT:
         * - /feed/* (RSS feeds - must be public for RSS readers)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * 
         * The regex explicitly excludes 'feed' to ensure RSS endpoints
         * are never protected by authentication
         */
        '/((?!_next/static|_next/image|favicon.ico|feed).*)',
    ],
};
