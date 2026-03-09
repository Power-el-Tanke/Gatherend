// app/api/boards/[boardId]/categories/route.ts

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

export async function POST(
  req: Request,
  context: { params: Promise<{ boardId: string }> },
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
    const { boardId } = params;

    // Validate UUID
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Parse body with error handling
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

    // Ejecutar verificación de permisos y creación en transacción
    const category = await db.$transaction(async (tx) => {
      // Verificar que el usuario sea admin o mod del board
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

      // Verificar límite de categorías
      const categoryCount = await tx.category.count({ where: { boardId } });
      if (categoryCount >= 250) {
        throw new Error("MAX_CATEGORIES");
      }

      // Obtener último position global
      const firstItem = await tx.$queryRaw<{ min: number | null }[]>`
        SELECT MIN(position) as min
        FROM (
          SELECT position FROM "Category" WHERE "boardId" = ${boardId}
          UNION ALL
          SELECT position FROM "Channel" WHERE "boardId" = ${boardId}
        ) AS all_items
      `;

      const firstPos = firstItem[0]?.min ?? 1000;
      const newPosition = firstPos - 1000;

      // Crear categoría
      return tx.category.create({
        data: {
          name: name.trim(),
          profileId: profile.id,
          boardId,
          position: newPosition,
        },
      });
    });

    // Invalidar cache del layout para forzar re-render
    revalidatePath(`/boards/${boardId}`);

    return NextResponse.json(category);
  } catch (error) {
    // Manejar errores personalizados lanzados desde la transacción
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      if (error.message === "MAX_CATEGORIES")
        return NextResponse.json(
          { error: "Maximum of 250 categories reached" },
          { status: 400 },
        );
    }

    console.error("[CATEGORIES_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
