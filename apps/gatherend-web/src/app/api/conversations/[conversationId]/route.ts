import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No cachear requests
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const { conversationId } = await context.params;

    // Validate UUID
    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ profileOneId: profile.id }, { profileTwoId: profile.id }],
      },
      include: {
        profileOne: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            imageUrl: true,
            userId: true,
            usernameColor: true,
            usernameFormat: true,
          },
        },
        profileTwo: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            imageUrl: true,
            userId: true,
            usernameColor: true,
            usernameFormat: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("[CONVERSATION_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
