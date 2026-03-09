// app/api/boards/[boardId]/channels/route.ts

import { db } from "@/lib/db";
import { MemberRole, ChannelType } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { boardId } = params;

    // Validate UUID
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Parse body with error handling
    let body: { name?: unknown; type?: unknown; categoryId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, type, categoryId } = body;

    // Validar name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Channel name is required" },
        { status: 400 },
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: "Channel name cannot exceed 50 characters" },
        { status: 400 },
      );
    }

    // Validar categoryId si se proporciona
    if (categoryId) {
      if (typeof categoryId !== "string" || !UUID_REGEX.test(categoryId)) {
        return NextResponse.json(
          { error: "Invalid category ID" },
          { status: 400 },
        );
      }
    }

    // Validar type
    const validTypes = Object.values(ChannelType);
    if (!type || !validTypes.includes(type as ChannelType)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 },
      );
    }

    // No permitir crear canales tipo MAIN vía API
    if (type === ChannelType.MAIN) {
      return NextResponse.json(
        { error: "Cannot create MAIN channel type" },
        { status: 400 },
      );
    }

    // Ejecutar verificación de permisos y creación en transacción
    const channel = await db.$transaction(async (tx) => {
      // Verificar permisos, categoría (si existe) y contar canales en paralelo
      const [member, category, channelCount] = await Promise.all([
        tx.member.findFirst({
          where: {
            boardId,
            profileId: profile.id,
            role: { in: [MemberRole.OWNER, MemberRole.ADMIN] },
          },
          select: { role: true },
        }),
        categoryId
          ? tx.category.findFirst({
              where: { id: categoryId as string, boardId },
            })
          : Promise.resolve(null),
        tx.channel.count({ where: { boardId } }),
      ]);

      if (!member) {
        throw new Error("FORBIDDEN");
      }

      // Verificar límite de canales
      if (channelCount >= 250) {
        throw new Error("MAX_CHANNELS");
      }

      // Si hay categoryId, verificar que existe
      if (categoryId && !category) {
        throw new Error("CATEGORY_NOT_FOUND");
      }

      // Determinar posición según si es root o dentro de categoría
      const parentId = (categoryId as string | undefined) || null;

      const firstChannel = await tx.channel.findFirst({
        where: { boardId, parentId },
        orderBy: { position: "asc" },
      });

      const firstPos = firstChannel?.position ?? 1000;
      const newPosition = firstPos - 1000;

      // Crear canal
      return tx.channel.create({
        data: {
          name: (name as string).trim(),
          type: type as ChannelType,
          boardId,
          parentId,
          position: newPosition,
          profileId: profile.id,
        },
      });
    });

    // Invalidar cache del layout para forzar re-render
    revalidatePath(`/boards/${boardId}`);

    return NextResponse.json(channel);
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      if (error.message === "CATEGORY_NOT_FOUND")
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 },
        );
      if (error.message === "MAX_CHANNELS")
        return NextResponse.json(
          { error: "Maximum of 250 channels reached" },
          { status: 400 },
        );
    }

    console.error("[CHANNELS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
