import { db } from "@/lib/db";
import { normalizeLanguages } from "@/lib/detect-language";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

export const revalidate = 0;

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;
    const { profile } = auth;

    // Parse body with error handling
    let languages: unknown;
    try {
      const body = await req.json();
      languages = body.languages;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate languages is array of strings
    if (!Array.isArray(languages)) {
      return NextResponse.json(
        { error: "Languages must be an array" },
        { status: 400 },
      );
    }

    if (!languages.every((lang) => typeof lang === "string")) {
      return NextResponse.json(
        { error: "Languages must be an array of strings" },
        { status: 400 },
      );
    }

    // Normalizar los idiomas enviados desde el cliente
    const normalizedLangs = normalizeLanguages(languages);

    // Solo actualizar si son diferentes
    const currentLangs = profile.languages || [];
    const needsUpdate =
      JSON.stringify(currentLangs.sort()) !==
      JSON.stringify(normalizedLangs.sort());

    if (!needsUpdate) {
      return NextResponse.json({ success: true, updated: false });
    }

    // Actualizar perfil
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: { languages: normalizedLangs },
    });

    return NextResponse.json({
      success: true,
      updated: true,
      languages: updatedProfile.languages,
    });
  } catch (error) {
    console.error("[PROFILE_SYNC_LANGUAGES]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
