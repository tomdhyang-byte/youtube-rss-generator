import { withAuth } from "next-auth/middleware";
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "./routing";

const intlMiddleware = createMiddleware(routing);

// Configure protected paths
const authMiddleware = withAuth(
    // Note that this callback is only invoked if "authorized" returns true
    function onSuccess(req) {
        return intlMiddleware(req);
    },
    {
        callbacks: {
            authorized: ({ token }) => token != null,
        },
        pages: {
            signIn: "/zh-TW", // Fallback to home if unauthorized (or /auth/signin if you have one)
        },
    }
);

export default function middleware(req: NextRequest) {
    // For RSS feed routes without locale prefix, rewrite to /en/feed/... internally
    // This avoids 307 redirect (which causes issues with RSS Readers) while still routing correctly
    if (req.nextUrl.pathname.startsWith('/feed/user/')) {
        const url = req.nextUrl.clone();
        url.pathname = `/en${req.nextUrl.pathname}`;
        // Use rewrite (not redirect) - this keeps the URL clean for the client
        return NextResponse.rewrite(url);
    }


    // Define paths that require authentication
    // Note: We need to account for locale prefixes (e.g., /en/subscriptions, /zh-TW/subscriptions)
    const privatePathnameRegex = /^\/(?:(zh-TW|en)\/)?(feed$|subscriptions|api\/channels|api\/podcasts|api\/subscriptions\/styles)/;

    // Exclude API routes from intl processing
    const isApi = req.nextUrl.pathname.startsWith('/api');

    if (isApi) {
        // For API routes, just run auth check if needed
        if (privatePathnameRegex.test(req.nextUrl.pathname)) {
            return (authMiddleware as any)(req);
        }
        return;
    }

    // For pages:
    const isPrivatePage = privatePathnameRegex.test(req.nextUrl.pathname);

    if (isPrivatePage) {
        return (authMiddleware as any)(req);
    } else {
        return intlMiddleware(req);
    }
}

export const config = {
    // Matcher: Exclude _next, /api routes, and static files (with extensions)
    matcher: ['/((?!_next|api|.*\\..*).*)'
    ]
};
