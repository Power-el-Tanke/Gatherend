import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { getExpressServerAuthHeaders } from "@/lib/express-server-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cache control for GET
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const searchParams = req.nextUrl.searchParams;
    const conversationId = searchParams.get("conversationId");

    // Validate UUID
    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/direct-messages/pinned?conversationId=${conversationId}`,
      {
        headers: await getExpressServerAuthHeaders(req),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch pinned messages" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[DIRECT_MESSAGES_PINNED_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
