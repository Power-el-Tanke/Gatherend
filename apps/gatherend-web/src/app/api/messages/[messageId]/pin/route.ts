import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { getExpressServerAuthHeaders } from "@/lib/express-server-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { messageId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");
    const boardId = searchParams.get("boardId");

    // Validate UUIDs
    if (!messageId || !UUID_REGEX.test(messageId)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 },
      );
    }

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
      `${process.env.NEXT_PUBLIC_API_URL}/messages/${messageId}/pin?${queryParams.toString()}`,
      {
        method: "POST",
        headers: await getExpressServerAuthHeaders(req),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to pin message" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[MESSAGE_PIN]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { messageId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");
    const boardId = searchParams.get("boardId");

    // Validate UUIDs
    if (!messageId || !UUID_REGEX.test(messageId)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 },
      );
    }

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
      `${process.env.NEXT_PUBLIC_API_URL}/messages/${messageId}/pin?${queryParams.toString()}`,
      {
        method: "DELETE",
        headers: await getExpressServerAuthHeaders(req),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to unpin message" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[MESSAGE_UNPIN]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
