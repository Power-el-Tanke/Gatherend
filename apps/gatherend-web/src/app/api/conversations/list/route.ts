import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// No cachear requests
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const conversations = await db.conversation.findMany({
      where: {
        OR: [
          {
            profileOneId: profile.id,
            hiddenByOneAt: null,
          },
          {
            profileTwoId: profile.id,
            hiddenByTwoAt: null,
          },
        ],
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
        directMessages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            content: true,
            fileUrl: true,
            deleted: true,
            senderId: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Formatear las conversaciones para incluir otherProfile y lastMessage
    const formattedConversations = conversations.map((c) => {
      const isOne = c.profileOneId === profile.id;
      const otherProfile = isOne ? c.profileTwo : c.profileOne;
      const lastMessage = c.directMessages?.[0] || null;
      return { ...c, otherProfile, isOne, lastMessage };
    });

    return NextResponse.json(formattedConversations);
  } catch (error) {
    console.error("[CONVERSATIONS_LIST_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
