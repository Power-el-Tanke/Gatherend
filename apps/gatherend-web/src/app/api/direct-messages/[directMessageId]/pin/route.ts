import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { getExpressServerAuthHeaders } from "@/lib/express-server-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ directMessageId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { directMessageId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const conversationId = searchParams.get("conversationId");

    // Validate UUIDs
    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    if (!UUID_REGEX.test(directMessageId)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/direct-messages/${directMessageId}/pin?conversationId=${conversationId}`,
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
    console.error("[DIRECT_MESSAGE_PIN]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ directMessageId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const { directMessageId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const conversationId = searchParams.get("conversationId");

    // Validate UUIDs
    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    if (!UUID_REGEX.test(directMessageId)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/direct-messages/${directMessageId}/pin?conversationId=${conversationId}`,
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
    console.error("[DIRECT_MESSAGE_UNPIN]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
