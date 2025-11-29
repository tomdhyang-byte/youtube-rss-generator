"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, Loader2 } from "lucide-react";

export function AuthButton() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <button
                disabled
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-not-allowed"
            >
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
            </button>
        );
    }

    if (session) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    {session.user?.image && (
                        <img
                            src={session.user.image}
                            alt={session.user.name || "User"}
                            className="w-8 h-8 rounded-full"
                        />
                    )}
                    <div className="hidden sm:block">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {session.user?.name}
                        </p>
                        {session.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                ADMIN
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => signIn("google")}
            className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
            <LogIn className="w-5 h-5" />
            Sign in with Google
        </button>
    );
}
