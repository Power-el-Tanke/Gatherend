import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper para notificar que alguien fue desbaneado
async function notifyMemberUnbanned(boardId: string, profileId: string) {
  try {
    const socketUrl =
      process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
    const secret = process.env.INTERNAL_API_SECRET;

    if (!socketUrl || !secret) return;

    await fetch(`${socketUrl}/emit-to-room`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        room: `board:${boardId}`,
        event: "board:member-unbanned",
        data: {
          boardId,
          profileId,
          timestamp: Date.now(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[NOTIFY_MEMBER_UNBANNED]", error);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.moderation);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;

    // Parse body with error handling
    let targetProfileId: unknown;
    try {
      const body = await req.json();
      targetProfileId = body.targetProfileId;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const boardId = params.boardId;

    if (!boardId || typeof targetProfileId !== "string" || !targetProfileId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Validate UUIDs
    if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(targetProfileId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    if (profile.id === targetProfileId) {
      return NextResponse.json(
        { error: "You cannot unban yourself" },
        { status: 400 },
      );
    }

    // Ejecutar toda la lógica dentro de una transacción
    await db.$transaction(async (tx) => {
      // 1. Validar que el actor tiene permisos
      const actor = await tx.member.findFirst({
        where: { boardId, profileId: profile.id },
        select: { role: true },
      });

      if (!actor) {
        throw new Error("NOT_A_MEMBER");
      }

      // Solo OWNER y ADMIN pueden desbanear
      if (actor.role !== MemberRole.OWNER && actor.role !== MemberRole.ADMIN) {
        throw new Error("FORBIDDEN");
      }

      // 2. Verificar que el ban existe
      const existingBan = await tx.boardBan.findFirst({
        where: { boardId, profileId: targetProfileId },
      });

      if (!existingBan) {
        throw new Error("NOT_BANNED");
      }

      // 3. Eliminar el ban
      await tx.boardBan.delete({
        where: {
          boardId_profileId: {
            boardId,
            profileId: targetProfileId,
          },
        },
      });
    });

    // Notificar (fire-and-forget)
    notifyMemberUnbanned(boardId, targetProfileId);

    return NextResponse.json({
      success: true,
      unbannedProfileId: targetProfileId,
    });
  } catch (error) {
    // Manejar errores personalizados
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER")
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "NOT_BANNED")
        return NextResponse.json(
          { error: "User is not banned" },
          { status: 400 },
        );
      if (error.message === "CANNOT_UNBAN_OWNER")
        return NextResponse.json(
          { error: "Cannot unban the owner" },
          { status: 403 },
        );
      if (error.message === "INSUFFICIENT_PERMISSIONS")
        return NextResponse.json(
          { error: "Admins cannot unban other admins" },
          { status: 403 },
        );
    }

    console.error("[UNBAN_MEMBER]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
