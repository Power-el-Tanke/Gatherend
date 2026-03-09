import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Get all banned users
export async function GET(req: Request) {
  // Rate limiting
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  const admin = await requireAdmin();
  if (!admin.success) return admin.response;

  try {
    const { searchParams } = new URL(req.url);

    // Validate and sanitize pagination params
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = parseInt(searchParams.get("limit") || "20", 10);
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit = Number.isNaN(limitParam)
      ? 20
      : Math.min(Math.max(limitParam, 1), 100);

    const [bannedUsers, total] = await Promise.all([
      db.profile.findMany({
        where: { banned: true },
        select: {
          id: true,
          userId: true,
          username: true,
          discriminator: true,
          imageUrl: true,
          banned: true,
          bannedAt: true,
          banReason: true,
          createdAt: true,
          _count: {
            select: {
              strikes: true,
              reportsAgainst: true,
            },
          },
        },
        orderBy: { bannedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.profile.count({ where: { banned: true } }),
    ]);

    return NextResponse.json(
      {
        bannedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error) {
    console.error("[MODERATION_BANNED_USERS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
