// app/api/boards/[boardId]/categories/[categoryId]/route.ts

// Legacy feature flag - Categories no se usan actualmente
// pero se mantiene para futura reimplementación.

import { db } from "@/lib/db";
import { MemberRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// LEGACY: Categories feature disabled - change to true to re-enable
const CATEGORIES_ENABLED = false;

export async function DELETE(
  req: Request,
  context: { params: Promise<{ boardId: string; categoryId: string }> },
) {
  try {
    if (!CATEGORIES_ENABLED) {
      return NextResponse.json(
        { error: "Categories feature is currently disabled" },
        { status: 410 },
      );
    }

    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { boardId, categoryId } = params;

    // Validate UUIDs
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    if (!categoryId || !UUID_REGEX.test(categoryId)) {
      return NextResponse.json(
        { error: "Invalid category ID" },
        { status: 400 },
      );
    }

    // Ejecutar toda la lógica en una transacción para consistencia
    const board = await db.$transaction(async (tx) => {
      // Verificar permisos
      const member = await tx.member.findFirst({
        where: {
          boardId,
          profileId: profile.id,
          role: {
            in: [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR],
          },
        },
        select: { role: true },
      });

      if (!member) {
        throw new Error("FORBIDDEN");
      }

      // Verificar que la categoría existe y pertenece al board
      const category = await tx.category.findFirst({
        where: { id: categoryId, boardId },
      });

      if (!category) {
        throw new Error("CATEGORY_NOT_FOUND");
      }

      // Obtener todos los canales root (para ver el MAX position)
      const lastRoot = await tx.channel.findFirst({
        where: { boardId, parentId: null },
        orderBy: { position: "desc" },
      });

      const basePos = lastRoot?.position ?? 0;

      // Obtener los canales hijos de esta categoría
      const childChannels = await tx.channel.findMany({
        where: { parentId: categoryId, boardId },
        orderBy: { position: "asc" },
      });

      // Mover canales a root con posiciones incrementales
      for (let i = 0; i < childChannels.length; i++) {
        await tx.channel.update({
          where: { id: childChannels[i].id },
          data: {
            parentId: null,
            position: basePos + (i + 1) * 1000,
          },
        });
      }

      // Eliminar la categoría
      await tx.category.delete({
        where: { id: categoryId },
      });

      // Devolver datos actualizados
      return tx.board.findUnique({
        where: { id: boardId },
        include: {
          channels: true,
          categories: {
            include: { channels: true },
          },
          members: {
            include: { profile: true },
            orderBy: { role: "asc" },
          },
        },
      });
    });

    // Invalidar cache del layout para forzar re-render
    revalidatePath(`/boards/${boardId}`);

    return NextResponse.json(board);
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
    }

    console.error("[CATEGORY_ID_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ boardId: string; categoryId: string }> },
) {
  try {
    if (!CATEGORIES_ENABLED) {
      return NextResponse.json(
        { error: "Categories feature is currently disabled" },
        { status: 410 },
      );
    }

    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const profile = auth.profile;

    const params = await context.params;
    const { boardId, categoryId } = params;

    // Validate UUIDs
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    if (!categoryId || !UUID_REGEX.test(categoryId)) {
      return NextResponse.json(
        { error: "Invalid category ID" },
        { status: 400 },
      );
    }

    let body: { name?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const name = body.name;

    // Validar name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 },
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: "Category name cannot exceed 50 characters" },
        { status: 400 },
      );
    }

    // Ejecutar verificación de permisos y actualización en transacción para evitar TOCTOU
    const updatedCategory = await db.$transaction(async (tx) => {
      // Verificar que la categoría existe y pertenece al board
      const category = await tx.category.findFirst({
        where: { id: categoryId, boardId },
      });

      if (!category) {
        throw new Error("CATEGORY_NOT_FOUND");
      }

      // Verificar permisos del usuario
      const member = await tx.member.findFirst({
        where: {
          boardId,
          profileId: profile.id,
          role: {
            in: [MemberRole.OWNER, MemberRole.ADMIN],
          },
        },
        select: { role: true },
      });

      if (!member) {
        throw new Error("FORBIDDEN");
      }

      // Actualizar la categoría
      return tx.category.update({
        where: { id: categoryId },
        data: { name: name.trim() },
      });
    });

    // Invalidar cache del layout para forzar re-render
    revalidatePath(`/boards/${boardId}`);

    return NextResponse.json(updatedCategory);
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
    }

    console.error("[CATEGORY_ID_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
