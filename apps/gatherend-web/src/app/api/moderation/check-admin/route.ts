import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const admin = await requireAdmin();

    // Si requireAdmin falla, el usuario no es admin
    if (!admin.success) {
      return NextResponse.json({ isAdmin: false });
    }

    return NextResponse.json({ isAdmin: true });
  } catch (error) {
    console.error("[CHECK_ADMIN_ERROR]", error);
    return NextResponse.json({ isAdmin: false });
  }
}
