/**
 * Text Moderation API Route
 *
 * Validates text content (board descriptions) against moderation rules
 * POST /api/moderation/text
 */

import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";

// Límites
const MAX_TEXT_LENGTH = 200;

// Import the text moderation configuration and logic
// Since this runs on the frontend, we need a lightweight version

// SIMPLIFIED TEXT MODERATION (Frontend Version)

const HOMOGLYPHS: Record<string, string> = {
  а: "a",
  е: "e",
  і: "i",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  ѕ: "s",
  ј: "j",
  һ: "h",
  ԁ: "d",
  α: "a",
  ε: "e",
  ι: "i",
  ο: "o",
};

const LEETSPEAK: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

const BLACKLIST_ABSOLUTE = [
  "cp",
  "pthc",
  "pedo",
  "pedofil",
  "pedofilo",
  "pedofilia",
  "pedophil",
  "pedophile",
  "pedophilia",
  "loli",
  "lolita",
  "lolicon",
  "shota",
  "shotacon",
  "jailbait",
  "preteen",
  "preteens",
  "cheesepizza",
  "cheese pizza",
  "child porn",
  "child abuse",
  "kiddie porn",
  "underage porn",
  "underage sex",
  "pornografia infantil",
  "porno infantil",
];

const MINORS_SET = [
  "niño",
  "niños",
  "niña",
  "niñas",
  "menor",
  "menores",
  "adolescente",
  "adolescentes",
  "chico",
  "chica",
  "nene",
  "nena",
  "chamaco",
  "morro",
  "morra",
  "morrito",
  "morrita",
  "chavito",
  "chavita",
  "pibe",
  "piba",
  "child",
  "children",
  "kid",
  "kids",
  "teen",
  "teens",
  "boy",
  "boys",
  "girl",
  "girls",
  "young",
  "minor",
  "minors",
  "underage",
  "schoolgirl",
  "schoolboy",
  "preteen",
  "tween",
];

const SEXUAL_SET = [
  "sexo",
  "sexual",
  "xxx",
  "nsfw",
  "porn",
  "porno",
  "erotico",
  "erótico",
  "desnudo",
  "desnuda",
  "nude",
  "nudes",
  "intimo",
  "íntimo",
  "caliente",
  "cachondo",
  "morbo",
  "sex",
  "sexy",
  "sexting",
  "erotic",
  "naked",
  "horny",
  "lewd",
  "explicit",
  "adult content",
];

const MEDIA_SET = [
  "foto",
  "fotos",
  "video",
  "videos",
  "imagen",
  "imagenes",
  "contenido",
  "material",
  "pack",
  "packs",
  "coleccion",
  "photo",
  "photos",
  "image",
  "images",
  "content",
  "pic",
  "pics",
  "collection",
  "gallery",
  "media",
];

const INTENT_SET = [
  "vendo",
  "compro",
  "intercambio",
  "busco",
  "ofrezco",
  "tengo",
  "disponible",
  "manda",
  "envia",
  "paso",
  "sell",
  "buy",
  "trade",
  "exchange",
  "looking for",
  "have",
  "send",
  "share",
  "available",
  "dm me",
  "hmu",
];

const CONTACT_SET = [
  "telegram",
  "tg",
  "whatsapp",
  "wa",
  "discord",
  "snapchat",
  "kik",
  "dm",
  "md",
  "privado",
  "pv",
  "inbox",
  "escribeme",
  "contacto",
  "private",
  "message me",
  "contact me",
  "hit me up",
];

function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  normalized = normalized
    .split("")
    .map((c) => HOMOGLYPHS[c] || c)
    .join("");
  normalized = normalized.replace(/[_\-\*\+\.\|~^`´'"""''«»]/g, "");
  normalized = normalized
    .split("")
    .map((c) => LEETSPEAK[c] || c)
    .join("");
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

function hasAnyWord(text: string, words: string[]): boolean {
  for (const word of words) {
    if (text.includes(word)) return true;
  }
  return false;
}

function checkBlacklist(text: string): boolean {
  for (const term of BLACKLIST_ABSOLUTE) {
    if (text.includes(term)) return true;
  }
  return false;
}

interface ModerationResult {
  allowed: boolean;
  reason?: string;
  message?: string;
}

function moderateText(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { allowed: true };
  }

  const normalized = normalizeText(text);

  // Phase 1: Blacklist
  if (checkBlacklist(normalized)) {
    return {
      allowed: false,
      reason: "BLACKLIST_HIT",
      message: "Your description contains prohibited content.",
    };
  }

  // Phase 2: Combination checks
  const hasMinors = hasAnyWord(normalized, MINORS_SET);
  const hasSexual = hasAnyWord(normalized, SEXUAL_SET);
  const hasMedia = hasAnyWord(normalized, MEDIA_SET);
  const hasIntent = hasAnyWord(normalized, INTENT_SET);
  const hasContact = hasAnyWord(normalized, CONTACT_SET);

  // Critical combinations - BLOCK
  if (hasSexual && hasMinors) {
    return {
      allowed: false,
      reason: "SEXUAL_MINORS",
      message: "Your description was flagged for inappropriate content.",
    };
  }

  if (hasIntent && hasMinors) {
    return {
      allowed: false,
      reason: "INTENT_MINORS",
      message: "Your description was flagged for inappropriate content.",
    };
  }

  if (hasMedia && hasMinors) {
    return {
      allowed: false,
      reason: "MEDIA_MINORS",
      message: "Your description was flagged for inappropriate content.",
    };
  }

  if (hasContact && hasMinors) {
    return {
      allowed: false,
      reason: "CONTACT_MINORS",
      message: "Your description was flagged for inappropriate content.",
    };
  }

  if (hasIntent && hasSexual) {
    return {
      allowed: false,
      reason: "INTENT_SEXUAL",
      message: "Your description contains adult content which is not allowed.",
    };
  }

  if (hasSexual && hasContact) {
    return {
      allowed: false,
      reason: "SEXUAL_CONTACT",
      message: "Your description contains adult content which is not allowed.",
    };
  }

  if (hasIntent && hasMedia && (hasSexual || hasMinors)) {
    return {
      allowed: false,
      reason: "INTENT_MEDIA_COMBO",
      message: "Your description was flagged for inappropriate content.",
    };
  }

  return { allowed: true };
}

// API ROUTE HANDLERS

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    // Parse body with error handling
    let text: unknown;
    try {
      const body = await req.json();
      text = body.text;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Validate text length
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text cannot exceed ${MAX_TEXT_LENGTH} characters` },
        { status: 400 },
      );
    }

    const result = moderateText(text);

    return NextResponse.json({
      allowed: result.allowed,
      reason: result.reason,
      message: result.message,
    });
  } catch (error) {
    console.error("[MODERATION_TEXT_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
