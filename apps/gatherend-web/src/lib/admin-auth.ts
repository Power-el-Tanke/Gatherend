// lib/admin-auth.ts
// Simple admin authentication using environment variables
// For now, only checks against a list of admin userIds

import { NextResponse } from "next/server";
import { currentProfile, ProfileData } from "@/lib/current-profile";
import { getServerSession } from "@/lib/auth/server-session";

// Legacy admin list based on auth provider user IDs (deprecated).
// Prefer ADMIN_PROFILE_IDS to avoid coupling to external provider IDs.
// Format in .env: ADMIN_USER_IDS=<provider-user-id>,<provider-user-id>
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// New optional admin list based on internal profile IDs.
const ADMIN_PROFILE_IDS = (process.env.ADMIN_PROFILE_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

function isAdminByIds(params: {
  sessionUserId: string;
  profile: ProfileData;
}): boolean {
  const { sessionUserId, profile } = params;
  // Migration behavior:
  // - If ADMIN_PROFILE_IDS is set, use it as the single source of truth.
  // - Otherwise, fall back to ADMIN_USER_IDS for backward compatibility.
  if (ADMIN_PROFILE_IDS.length > 0) {
    return ADMIN_PROFILE_IDS.includes(profile.id);
  }
  return (
    ADMIN_USER_IDS.includes(sessionUserId) ||
    ADMIN_USER_IDS.includes(profile.userId)
  );
}

// Result Pattern for type-safe admin checks

/**
 * Discriminated union for admin auth result
 * TypeScript can narrow the type based on `success`
 */
export type AdminResult =
  | { success: true; profile: ProfileData }
  | { success: false; response: NextResponse };

/**
 * Check if the current user is an admin
 * @returns Promise<boolean>
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const session = await getServerSession();
  const profile = await currentProfile();
  if (!session || !profile) return false;

  return isAdminByIds({
    sessionUserId: session.userId,
    profile,
  });
}

/**
 * Type-safe admin check with automatic narrowing
 * Returns either a valid admin profile or an error response
 *
 * @example
 * const admin = await requireAdmin();
 * if (!admin.success) return admin.response;
 * // admin.profile is guaranteed to be ProfileData here
 * admin.profile.id // No TypeScript error
 */
export async function requireAdmin(): Promise<AdminResult> {
  const session = await getServerSession();
  const profile = await currentProfile();

  if (!session || !profile) {
    return {
      success: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (
    !isAdminByIds({
      sessionUserId: session.userId,
      profile,
    })
  ) {
    return {
      success: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { success: true, profile };
}

/**
 * Get admin status for a provider userId
 * Useful for server components
 */
export function isUserIdAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

export function isProfileIdAdmin(profileId: string): boolean {
  return ADMIN_PROFILE_IDS.includes(profileId);
}
