import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { conversationId } = params;

    // Validate UUID
    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    // Ejecutar en transacción para consistencia
    await db.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new Error("NOT_FOUND");
      }

      // Verificar que el usuario es parte de la conversación
      const isProfileOne = conversation.profileOneId === profile.id;
      const isProfileTwo = conversation.profileTwoId === profile.id;

      if (!isProfileOne && !isProfileTwo) {
        throw new Error("FORBIDDEN");
      }

      // Actualizar el campo correspondiente según qué perfil es
      const updateData = isProfileOne
        ? { hiddenByOneAt: new Date() }
        : { hiddenByTwoAt: new Date() };

      await tx.conversation.update({
        where: { id: conversationId },
        data: updateData,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND")
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      if (error.message === "FORBIDDEN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("[CONVERSATION_HIDE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
