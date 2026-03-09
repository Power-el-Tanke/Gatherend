import crypto from "crypto";

function getRequiredEnv(name: string): string | null {
  const v = process.env[name];
  if (!v) return null;
  return v.trim();
}

export function getAttachmentsBaseUrl(): string {
  return process.env.ATTACHMENTS_BASE_URL?.trim() || "";
}

export function getAttachmentsUrlTtlSeconds(): number {
  const raw = process.env.ATTACHMENTS_URL_TTL_SECONDS?.trim();
  const n = raw ? Number(raw) : NaN;
  // Default to 24h if not configured.
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 86400;
}

function getAttachmentsUrlExpRoundingSeconds(): number | null {
  const raw = process.env.ATTACHMENTS_URL_EXP_ROUND_SECONDS?.trim();
  const n = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function signAttachmentsKey(key: string, expSeconds: number): string {
  const secret = getRequiredEnv("ATTACHMENTS_HMAC_KEY");
  if (!secret) {
    throw new Error("Missing ATTACHMENTS_HMAC_KEY");
  }

  // Must match Worker signing: HMAC_SHA256(secret, `${key}:${exp}`) as hex.
  const data = `${key}:${expSeconds}`;
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function isValidSignedAttachmentsUrlForKey(
  rawUrl: string,
  key: string,
): boolean {
  try {
    const baseUrlRaw = getAttachmentsBaseUrl().trim();
    const base = baseUrlRaw ? new URL(baseUrlRaw) : null;

    const isAbsolute = /^https?:\/\//i.test(rawUrl);
    const url = isAbsolute
      ? new URL(rawUrl)
      : new URL(rawUrl, base ?? "https://attachments.gatherend.com");

    if (isAbsolute && base) {
      if (url.protocol !== base.protocol) return false;
      if (url.host !== base.host) return false;
    }

    const basePath = base ? base.pathname.replace(/\/+$/, "") : "";
    const normalizedKey = key.replace(/^\/+/, "");
    const expectedPath = `${basePath}/${normalizedKey}`.replace(/\/{2,}/g, "/");
    if (url.pathname !== expectedPath) return false;

    const expRaw = url.searchParams.get("exp");
    const sigRaw = url.searchParams.get("sig");
    if (!expRaw || !sigRaw) return false;

    const exp = Number.parseInt(expRaw, 10);
    if (!Number.isFinite(exp) || exp <= 0) return false;

    if (!/^[0-9a-f]{64}$/i.test(sigRaw)) return false;

    const expectedSig = signAttachmentsKey(key, exp);
    const got = Buffer.from(sigRaw.toLowerCase(), "hex");
    const expected = Buffer.from(expectedSig.toLowerCase(), "hex");
    if (got.length !== expected.length) return false;

    return crypto.timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

export function getSignedAttachmentsUrl(key: string, ttlSeconds?: number): string {
  const baseUrl = getAttachmentsBaseUrl().replace(/\/+$/, "");
  const ttl = ttlSeconds ?? getAttachmentsUrlTtlSeconds();
  const now = Math.floor(Date.now() / 1000);
  let exp = now + ttl;

  // Reduce URL churn (and improve browser caching) by rounding exp to a fixed window.
  // Example: if ttl=86400 and round=300, the same asset URL stays stable for ~5 minutes.
  const roundSeconds = getAttachmentsUrlExpRoundingSeconds();
  if (roundSeconds && roundSeconds > 1) {
    exp = Math.floor(exp / roundSeconds) * roundSeconds;
    if (exp <= now) {
      exp = now + roundSeconds;
    }
  }
  const sig = signAttachmentsKey(key, exp);

  // key already contains slashes; keep as path segment.
  return `${baseUrl}/${key}?exp=${exp}&sig=${sig}`;
}

export function isPrivateAttachmentKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return key.startsWith("chat-attachments/") || key.startsWith("dm-attachments/");
}
