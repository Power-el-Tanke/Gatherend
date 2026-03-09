import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cacheable - usa datos materializados del cron
export const revalidate = 60; // 1 minuto

export async function GET(
  req: Request,
  { params }: { params: Promise<{ communityId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const { communityId } = await params;

    // Validate UUID
    if (!communityId || !UUID_REGEX.test(communityId)) {
      return NextResponse.json(
        { error: "Invalid community ID" },
        { status: 400 },
      );
    }

    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    // Lectura directa de campos materializados (sincronizado con cron)
    const community = await db.community.findUnique({
      where: { id: communityId },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        memberCount: true, // Campo materializado por cron
      },
    });

    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: community.id,
      name: community.name,
      imageUrl: community.imageUrl,
      memberCount: community.memberCount,
    });
  } catch (error) {
    console.error("[DISCOVERY_COMMUNITY_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
