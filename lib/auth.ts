import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getSession() {
    return await getServerSession(authOptions);
}

export function isAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    return email === process.env.ADMIN_EMAIL;
}
