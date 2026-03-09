import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

// Delete a strike
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ strikeId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const admin = await requireAdmin();
    if (!admin.success) return admin.response;

    const { strikeId } = await params;

    // Validate UUID
    if (!strikeId || !UUID_REGEX.test(strikeId)) {
      return NextResponse.json({ error: "Invalid strike ID" }, { status: 400 });
    }

    // Use deleteMany to avoid TOCTOU - returns count
    const result = await db.strike.deleteMany({
      where: { id: strikeId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Strike not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MODERATION_STRIKE_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
