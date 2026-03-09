// lib/require-auth.ts
// Utility to check if a user is authenticated and return appropriate response

import { NextResponse } from "next/server";
import { currentProfile, ProfileData } from "@/lib/current-profile";
import { getServerSession } from "@/lib/auth/server-session";

// Result Pattern for type-safe auth checks

/**
 * Discriminated union for auth result
 * TypeScript can narrow the type based on `success`
 */
export type AuthResult =
  | { success: true; profile: ProfileData }
  | { success: false; response: NextResponse };

/**
 * Type-safe auth check with automatic narrowing
 * Returns either a valid profile or an error response
 *
 * @example
 * const auth = await requireAuth();
 * if (!auth.success) return auth.response;
 * // auth.profile is guaranteed to be ProfileData here
 * auth.profile.id // No TypeScript error
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession();
  if (!session) {
    return {
      success: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const profile = await currentProfile();

  if (!profile) {
    return {
      success: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (profile.banned) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Account suspended",
          message: "Your account has been banned from Gatherend.",
          banned: true,
          bannedAt: profile.bannedAt?.toISOString() || null,
          banReason: profile.banReason || null,
        },
        { status: 403 },
      ),
    };
  }

  return { success: true, profile };
}
