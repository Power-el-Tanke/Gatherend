import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No cachear requests
export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    // Parse body with error handling
    let profileId: unknown;
    try {
      const body = await req.json();
      profileId = body.profileId;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate type
    if (typeof profileId !== "string" || !profileId) {
      return NextResponse.json(
        { error: "Missing or invalid profileId" },
        { status: 400 },
      );
    }

    // Validate UUID format
    if (!UUID_REGEX.test(profileId)) {
      return NextResponse.json(
        { error: "Invalid profileId format" },
        { status: 400 },
      );
    }

    // 1. Buscamos al "otro miembro" para saber en qué board estamos
    if (profileId === profile.id) {
      return NextResponse.json(
        { error: "Cannot message yourself" },
        { status: 400 },
      );
    }

    // Ejecutar toda la lógica en transacción para consistencia
    const result = await db.$transaction(async (tx) => {
      // Verificar que el target profile existe
      const targetProfile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { id: true },
      });

      if (!targetProfile) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      // Buscar conversación existente
      const existing = await tx.conversation.findFirst({
        where: {
          OR: [
            { profileOneId: profile.id, profileTwoId: profileId },
            { profileOneId: profileId, profileTwoId: profile.id },
          ],
        },
      });

      if (existing) {
        // Si la conversación existe pero el usuario la había ocultado, mostrarla de nuevo
        const isProfileOne = existing.profileOneId === profile.id;
        const wasHiddenByUser = isProfileOne
          ? existing.hiddenByOneAt !== null
          : existing.hiddenByTwoAt !== null;

        if (wasHiddenByUser) {
          // Limpiar el campo de ocultación para que vuelva a aparecer en la lista
          return tx.conversation.update({
            where: { id: existing.id },
            data: isProfileOne
              ? { hiddenByOneAt: null }
              : { hiddenByTwoAt: null },
          });
        }

        return existing;
      }

      // Crear nueva conversación
      return tx.conversation.create({
        data: {
          profileOneId: profile.id,
          profileTwoId: profileId,
        },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "PROFILE_NOT_FOUND") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }

    console.error("[CONVERSATIONS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
