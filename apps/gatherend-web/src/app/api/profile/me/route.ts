import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/me
 *
 * Returns the current user's profile for client-side use.
 * Excludes sensitive fields that shouldn't be exposed to the browser.
 */
export async function GET() {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    // Return profile without sensitive/unnecessary fields
    return NextResponse.json({
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      imageUrl: profile.imageUrl,
      email: profile.email, // User's own email - safe to show to themselves
      languages: profile.languages,
      usernameColor: profile.usernameColor,
      profileTags: profile.profileTags,
      badge: profile.badge,
      badgeStickerUrl: profile.badgeStickerUrl,
      usernameFormat: profile.usernameFormat,
      longDescription: profile.longDescription,
      themeConfig: profile.themeConfig,
    });
  } catch (error) {
    console.error("[PROFILE_ME_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
