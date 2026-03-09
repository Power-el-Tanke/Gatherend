import { requireAuth } from "@/lib/require-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { MemberRole, SlotMode } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Máximo de slots configurables (sin owner) = 48
// Frontend envía invitationCount INCLUYENDO el slot del owner
// Entonces total máximo que puede llegar = 48 + 1 = 49
const MAX_TOTAL_SLOTS = 49;

export async function PATCH(
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

    const boardId = params.boardId;

    // Validate UUID
    if (!boardId || !UUID_REGEX.test(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    // Parse body with error handling
    let body: { invitationCount?: unknown; discoveryCount?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { invitationCount, discoveryCount } = body;

    // Validate counts are valid integers
    if (
      typeof invitationCount !== "number" ||
      typeof discoveryCount !== "number" ||
      !Number.isInteger(invitationCount) ||
      !Number.isInteger(discoveryCount) ||
      invitationCount < 0 ||
      discoveryCount < 0 ||
      invitationCount > MAX_TOTAL_SLOTS ||
      discoveryCount > MAX_TOTAL_SLOTS
    ) {
      return NextResponse.json(
        { error: "Invalid payload: counts must be valid positive integers" },
        { status: 400 },
      );
    }

    const totalTarget = invitationCount + discoveryCount;

    // Early check for max size (will be validated again inside transaction)
    if (totalTarget > MAX_TOTAL_SLOTS) {
      return NextResponse.json(
        { error: "Total slots exceed maximum board size" },
        { status: 400 },
      );
    }

    // Owner always needs at least 1 invitation slot
    // Frontend sends invitationCount + 1, so minimum is 1
    if (invitationCount < 1) {
      return NextResponse.json(
        { error: "Board must have at least 1 invitation slot (owner)" },
        { status: 400 },
      );
    }

    // If there are discovery slots, must have at least 4
    // This prevents isolation/bullying in small public groups
    if (discoveryCount > 0 && discoveryCount < 4) {
      return NextResponse.json(
        { error: "Public groups must have at least 4 discovery slots" },
        { status: 400 },
      );
    }

    // --- Toda la lógica dentro de una transacción para evitar TOCTOU ---
    await db.$transaction(async (tx) => {
      // --- 1. Validar permisos ---
      const member = await tx.member.findFirst({
        where: { boardId, profileId: profile!.id },
        select: { role: true },
      });

      if (!member) {
        throw new Error("NOT_A_MEMBER");
      }

      if (
        member.role !== MemberRole.OWNER &&
        member.role !== MemberRole.ADMIN
      ) {
        throw new Error("FORBIDDEN");
      }

      // --- 2. Obtener todos los slots ---
      const slots = await tx.slot.findMany({
        where: { boardId },
        select: { id: true, mode: true, memberId: true },
      });

      // Validar que el total no exceda el máximo
      // totalTarget es el número total deseado de slots (discovery + invitation)
      if (totalTarget > MAX_TOTAL_SLOTS) {
        throw new Error("EXCEEDS_MAX_SIZE");
      }

      const currentInvitation = slots.filter(
        (s) => s.mode === SlotMode.BY_INVITATION,
      );
      const currentDiscovery = slots.filter(
        (s) => s.mode === SlotMode.BY_DISCOVERY,
      );

      // Calcular ocupados por tipo
      const occupiedInvitation = currentInvitation.filter(
        (s) => s.memberId !== null,
      ).length;
      const occupiedDiscovery = currentDiscovery.filter(
        (s) => s.memberId !== null,
      ).length;

      // Validar que no se puede bajar por debajo de los slots ocupados de cada tipo
      if (invitationCount < occupiedInvitation) {
        throw new Error("BELOW_OCCUPIED_INVITATION");
      }
      if (discoveryCount < occupiedDiscovery) {
        throw new Error("BELOW_OCCUPIED_DISCOVERY");
      }

      // Slots libres (vacíos) de cada tipo
      const freeInvitation = currentInvitation.filter(
        (s) => s.memberId === null,
      );
      const freeDiscovery = currentDiscovery.filter((s) => s.memberId === null);

      // Calcular deltas
      const invitationDelta = invitationCount - currentInvitation.length;
      const discoveryDelta = discoveryCount - currentDiscovery.length;

      // IDs para operaciones batch
      const toConvertInvToDisc: string[] = [];
      const toConvertDiscToInv: string[] = [];
      const toDelete: string[] = [];

      // --- A. INVITATION slots ---
      if (invitationDelta < 0) {
        // Necesitamos reducir invitation
        const excess = Math.abs(invitationDelta);

        // Primero intentar convertir a discovery si se necesitan
        const canConvert = Math.min(
          freeInvitation.length,
          excess,
          Math.max(0, discoveryDelta), // solo si discovery necesita más
        );

        for (let i = 0; i < canConvert; i++) {
          toConvertInvToDisc.push(freeInvitation[i].id);
        }

        // El resto se elimina
        const toDeleteCount = excess - canConvert;
        for (
          let i = canConvert;
          i < canConvert + toDeleteCount && i < freeInvitation.length;
          i++
        ) {
          toDelete.push(freeInvitation[i].id);
        }
      }

      // --- B. DISCOVERY slots ---
      if (discoveryDelta < 0) {
        // Necesitamos reducir discovery
        const excess = Math.abs(discoveryDelta);

        // Primero intentar convertir a invitation si se necesitan
        // (descontar los que ya vamos a convertir de inv → disc)
        const effectiveInvitationNeed = Math.max(
          0,
          invitationDelta - toConvertInvToDisc.length,
        );
        const canConvert = Math.min(
          freeDiscovery.length,
          excess,
          effectiveInvitationNeed,
        );

        for (let i = 0; i < canConvert; i++) {
          toConvertDiscToInv.push(freeDiscovery[i].id);
        }

        // El resto se elimina
        const toDeleteCount = excess - canConvert;
        for (
          let i = canConvert;
          i < canConvert + toDeleteCount && i < freeDiscovery.length;
          i++
        ) {
          toDelete.push(freeDiscovery[i].id);
        }
      }

      // --- Ejecutar operaciones batch ---

      // Convertir INV → DISC
      if (toConvertInvToDisc.length > 0) {
        await tx.slot.updateMany({
          where: { id: { in: toConvertInvToDisc } },
          data: { mode: SlotMode.BY_DISCOVERY },
        });
      }

      // Convertir DISC → INV
      if (toConvertDiscToInv.length > 0) {
        await tx.slot.updateMany({
          where: { id: { in: toConvertDiscToInv } },
          data: { mode: SlotMode.BY_INVITATION },
        });
      }

      // Eliminar slots sobrantes
      if (toDelete.length > 0) {
        await tx.slot.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // --- C. Crear slots faltantes ---
      // Recalcular cuántos tenemos después de conversiones y eliminaciones
      const afterInvitation =
        currentInvitation.length -
        toConvertInvToDisc.length -
        toDelete.filter((id) => freeInvitation.some((s) => s.id === id))
          .length +
        toConvertDiscToInv.length;

      const afterDiscovery =
        currentDiscovery.length -
        toConvertDiscToInv.length -
        toDelete.filter((id) => freeDiscovery.some((s) => s.id === id)).length +
        toConvertInvToDisc.length;

      const createInv = Math.max(0, invitationCount - afterInvitation);
      const createDis = Math.max(0, discoveryCount - afterDiscovery);

      // Crear invitation slots
      if (createInv > 0) {
        await tx.slot.createMany({
          data: Array.from({ length: createInv }, () => ({
            boardId,
            mode: SlotMode.BY_INVITATION,
          })),
        });
      }

      // Crear discovery slots
      if (createDis > 0) {
        await tx.slot.createMany({
          data: Array.from({ length: createDis }, () => ({
            boardId,
            mode: SlotMode.BY_DISCOVERY,
          })),
        });
      }

      // --- D. Actualizar size ---
      const totalSlots = invitationCount + discoveryCount;
      await tx.board.update({
        where: { id: boardId },
        data: { size: totalSlots },
      });

      return { ok: true };
    });

    return NextResponse.json({
      success: true,
      totalSlots: invitationCount + discoveryCount,
      invitationCount,
      discoveryCount,
    });
  } catch (error) {
    // Handle custom errors from transaction
    if (error instanceof Error) {
      if (error.message === "NOT_A_MEMBER")
        return NextResponse.json({ error: "Not a member" }, { status: 403 });
      if (error.message === "FORBIDDEN")
        return NextResponse.json(
          { error: "Only owner/admin can resize" },
          { status: 403 },
        );
      if (error.message === "EXCEEDS_MAX_SIZE")
        return NextResponse.json(
          { error: "Exceeds max board size" },
          { status: 400 },
        );
      if (error.message === "BELOW_OCCUPIED_INVITATION")
        return NextResponse.json(
          { error: "Cannot reduce invitation slots below occupied count" },
          { status: 400 },
        );
      if (error.message === "BELOW_OCCUPIED_DISCOVERY")
        return NextResponse.json(
          { error: "Cannot reduce discovery slots below occupied count" },
          { status: 400 },
        );
    }

    console.error("[SLOTS_RESIZE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
