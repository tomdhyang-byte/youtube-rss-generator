import { withAuth } from "next-auth/middleware";
import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";

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
