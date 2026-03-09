import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { getExpressServerAuthHeaders } from "@/lib/express-server-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");
    const boardId = searchParams.get("boardId");

    // Validate UUIDs
    if (!channelId || !UUID_REGEX.test(channelId)) {
      return NextResponse.json(
        { error: "Invalid channel ID" },
        { status: 400 },
      );
    }

    if (boardId && !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Include boardId in the request if available (for optimization)
    const queryParams = new URLSearchParams({ channelId });
    if (boardId) queryParams.append("boardId", boardId);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/messages/pinned?${queryParams.toString()}`,
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
    console.error("[MESSAGES_PINNED_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
