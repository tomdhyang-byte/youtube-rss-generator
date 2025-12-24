"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function AuthButton() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <Button variant="ghost" disabled loading>
                Loading...
            </Button>
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
                <Button
                    variant="ghost"
                    onClick={() => signIn("google", { prompt: "select_account" })}
                    leftIcon={<LogIn className="w-4 h-4" />}
                >
                    <span className="hidden sm:inline">Switch Account</span>
                </Button>
                <Button
                    variant="ghost"
                    onClick={() => signOut()}
                    leftIcon={<LogOut className="w-4 h-4" />}
                >
                    <span className="hidden sm:inline">Sign Out</span>
                </Button>
            </div>
        );
    }

    return (
        <Button
            variant="secondary"
            size="lg"
            onClick={() => signIn("google")}
            leftIcon={<LogIn className="w-5 h-5" />}
        >
            Sign in with Google
        </Button>
    );
}
