import express from "express";
import { getImgproxyUrl } from "../../lib/imgproxy.js";
import { logger } from "../../lib/logger.js";

const router = express.Router();

function setBinaryAssetCacheHeaders(res: express.Response) {
  // server.ts applies `Pragma: no-cache` and `Expires: 0` globally to avoid
  // caching API responses. For binary assets we explicitly override that so the
  // browser can cache without revalidating on every remount/navigation.
  res.removeHeader("Pragma");
  res.removeHeader("Expires");
  res.set(
    "Cache-Control",
    "public, max-age=86400, s-maxage=31536000, immutable",
  );
}

function getRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const FRONTEND_URL = process.env.FRONTEND_URL || "";

function isAllowedSourceUrl(raw: string): boolean {
  const allowedHostnames = (process.env.MEDIA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    // Disallow userinfo tricks like `https://cdn.example.com@evil.com/...`
    if (u.username || u.password) return false;
    return allowedHostnames.includes(u.hostname);
  } catch {
    return false;
  }
}

function isAllowedPublicCdnUrl(raw: string): boolean {
  const allowedHostnames = (process.env.MEDIA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    return allowedHostnames.includes(u.hostname);
  } catch {
    return false;
  }
}

function parseResize(raw: unknown): "fit" | "fill" | "auto" {
  if (typeof raw !== "string") return "fill";
  return raw === "fit" || raw === "fill" || raw === "auto" ? raw : "fill";
}

function parseGravity(
  raw: unknown,
): "no" | "ce" | "sm" | "fp" | "face" | undefined {
  if (typeof raw !== "string") return undefined;
  return raw === "no" || raw === "ce" || raw === "sm" || raw === "fp" || raw === "face"
    ? raw
    : undefined;
}

router.get("/attachment", async (req, res) => {
  const requestId = getRequestId();
  res.set("X-Media-Handler", "express");
  res.set("X-Media-Request-Id", requestId);
  res.set("X-Media-Route", "attachment");

  const src = typeof req.query.src === "string" ? req.query.src : null;
  if (!src || !isAllowedSourceUrl(src)) {
    logger.warn("[media/attachment] invalid src", {
      requestId,
      src,
      origin: req.headers.origin,
      referer: req.headers.referer,
      ua: req.headers["user-agent"],
    });
    return res.status(400).json({ error: "Invalid src" });
  }

  const width = clampInt(
    typeof req.query.w === "string" ? req.query.w : undefined,
    800,
    1,
    2048,
  );
  const height = clampInt(
    typeof req.query.h === "string" ? req.query.h : undefined,
    600,
    1,
    2048,
  );
  const quality = clampInt(
    typeof req.query.q === "string" ? req.query.q : undefined,
    82,
    40,
    95,
  );

  const fmtRaw = typeof req.query.fmt === "string" ? req.query.fmt : "webp";
  const format =
    fmtRaw === "avif" || fmtRaw === "webp" || fmtRaw === "png" || fmtRaw === "jpeg"
      ? fmtRaw
      : "webp";

  const animatedRaw = typeof req.query.animated === "string" ? req.query.animated : "";
  const animated =
    animatedRaw === "1" ||
    animatedRaw.toLowerCase() === "true" ||
    animatedRaw.toLowerCase() === "yes";

  const buildUpstreamUrl = (page?: number) =>
    getImgproxyUrl(src, {
      width,
      height,
      resize: "fit",
      format,
      quality,
      ...(page !== undefined ? { page } : {}),
    });

  const upstreamUrlPrimary = animated
    ? buildUpstreamUrl(undefined)
    : buildUpstreamUrl(1);
  const upstreamUrlFallback = animated ? null : buildUpstreamUrl(undefined);

  const isSigned = !upstreamUrlPrimary.includes("/insecure/");
  res.set("X-Media-Upstream-Signed", isSigned ? "1" : "0");

  logger.info("[media/attachment] start", {
    requestId,
    src,
    width,
    height,
    quality,
    format,
    animated,
    hasFallback: Boolean(upstreamUrlFallback),
    isSigned,
    origin: req.headers.origin,
    referer: req.headers.referer,
    ua: req.headers["user-agent"],
  });

  try {
    const tryFetch = async (url: string) => {
      return fetch(url, {
        credentials: "omit",
        cache: "no-store",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          referer: FRONTEND_URL,
        },
      });
    };

    let upstreamRes = await tryFetch(upstreamUrlPrimary);
    let upstreamUrlUsed = upstreamUrlPrimary;

    if (!upstreamRes.ok && upstreamUrlFallback) {
      const retryRes = await tryFetch(upstreamUrlFallback);
      if (retryRes.ok) {
        upstreamRes = retryRes;
        upstreamUrlUsed = upstreamUrlFallback;
      }
    }

    if (!upstreamRes.ok) {
      const server = upstreamRes.headers.get("server");
      const cfRay = upstreamRes.headers.get("cf-ray");
      const cfCacheStatus = upstreamRes.headers.get("cf-cache-status");
      const contentType = upstreamRes.headers.get("content-type");

      let bodySnippet: string | null = null;
      try {
        const text = await upstreamRes.text();
        bodySnippet = text.slice(0, 200);
      } catch {
        bodySnippet = null;
      }

      logger.error("[media/attachment] imgproxy failed", {
        requestId,
        status: upstreamRes.status,
        src,
        width,
        height,
        quality,
        format,
        animated,
        upstreamUrl: upstreamUrlUsed,
        server,
        cfRay,
        cfCacheStatus,
        contentType,
        bodySnippet,
      });

      res.status(upstreamRes.status);
      res.set("Content-Type", "text/plain");
      return res.send("Upstream failed");
    }

    const contentType =
      upstreamRes.headers.get("content-type") || "application/octet-stream";
    setBinaryAssetCacheHeaders(res);
    res.set("Content-Type", contentType);

    const bytes = Buffer.from(await upstreamRes.arrayBuffer());
    logger.info("[media/attachment] ok", {
      requestId,
      contentType,
      bytes: bytes.length,
      upstreamUrl: upstreamUrlUsed,
    });
    return res.status(200).send(bytes);
  } catch (error) {
    logger.error("[media/attachment] fetch error", { requestId, src, error });
    return res.status(502).json({ error: "Fetch failed" });
  }
});

router.get("/fetch", async (req, res) => {
  const requestId = getRequestId();
  res.set("X-Media-Handler", "express");
  res.set("X-Media-Request-Id", requestId);
  res.set("X-Media-Route", "fetch");

  const src = typeof req.query.src === "string" ? req.query.src : null;
  if (!src || !isAllowedSourceUrl(src)) {
    logger.warn("[media/fetch] invalid src", {
      requestId,
      src,
      origin: req.headers.origin,
      referer: req.headers.referer,
      ua: req.headers["user-agent"],
    });
    return res.status(400).json({ error: "Invalid src" });
  }

  logger.info("[media/fetch] start", {
    requestId,
    src,
    origin: req.headers.origin,
    referer: req.headers.referer,
    ua: req.headers["user-agent"],
  });

  try {
    const upstreamRes = await fetch(src, {
      credentials: "omit",
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        referer: FRONTEND_URL,
      },
    });

    if (!upstreamRes.ok) {
      const contentType = upstreamRes.headers.get("content-type");
      let bodySnippet: string | null = null;
      try {
        const text = await upstreamRes.text();
        bodySnippet = text.slice(0, 200);
      } catch {
        bodySnippet = null;
      }

      logger.error("[media/fetch] upstream failed", {
        requestId,
        status: upstreamRes.status,
        src,
        contentType,
        bodySnippet,
      });

      res.status(upstreamRes.status);
      res.set("Content-Type", "text/plain");
      return res.send("Upstream failed");
    }

    const contentType =
      upstreamRes.headers.get("content-type") || "application/octet-stream";
    setBinaryAssetCacheHeaders(res);
    res.set("Content-Type", contentType);

    const bytes = Buffer.from(await upstreamRes.arrayBuffer());
    logger.info("[media/fetch] ok", {
      requestId,
      contentType,
      bytes: bytes.length,
    });
    return res.status(200).send(bytes);
  } catch (error) {
    logger.error("[media/fetch] fetch error", { requestId, src, error });
    return res.status(502).json({ error: "Fetch failed" });
  }
});

router.get("/ui-image", async (req, res) => {
  const requestId = getRequestId();
  res.set("X-Media-Handler", "express");
  res.set("X-Media-Request-Id", requestId);
  res.set("X-Media-Route", "ui-image");

  const src = typeof req.query.src === "string" ? req.query.src : null;
  if (!src || !isAllowedPublicCdnUrl(src)) {
    logger.warn("[media/ui-image] invalid src", {
      requestId,
      src,
      origin: req.headers.origin,
      referer: req.headers.referer,
      ua: req.headers["user-agent"],
    });
    return res.status(400).json({ error: "Invalid src" });
  }

  const width = clampInt(
    typeof req.query.w === "string" ? req.query.w : undefined,
    256,
    1,
    2048,
  );
  const height = clampInt(
    typeof req.query.h === "string" ? req.query.h : undefined,
    256,
    1,
    2048,
  );
  const quality = clampInt(
    typeof req.query.q === "string" ? req.query.q : undefined,
    82,
    40,
    95,
  );

  const fmtRaw = typeof req.query.fmt === "string" ? req.query.fmt : "webp";
  const format =
    fmtRaw === "avif" || fmtRaw === "webp" || fmtRaw === "png" || fmtRaw === "jpeg"
      ? fmtRaw
      : "webp";

  // Keep query names short and stable since this is used directly from the browser in <img src=...>.
  const resize = parseResize(req.query.rs);
  const gravity = parseGravity(req.query.g);

  const upstreamUrl = getImgproxyUrl(src, {
    width,
    height,
    resize,
    ...(gravity ? { gravity } : {}),
    format,
    quality,
  });

  const isSigned = !upstreamUrl.includes("/insecure/");
  res.set("X-Media-Upstream-Signed", isSigned ? "1" : "0");

  logger.info("[media/ui-image] start", {
    requestId,
    src,
    width,
    height,
    quality,
    format,
    resize,
    gravity: gravity || null,
    isSigned,
    origin: req.headers.origin,
    referer: req.headers.referer,
    ua: req.headers["user-agent"],
  });

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      // imgproxy should be public and should not depend on cookies.
      credentials: "omit",
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        referer: FRONTEND_URL,
      },
    });

    if (!upstreamRes.ok) {
      const server = upstreamRes.headers.get("server");
      const cfRay = upstreamRes.headers.get("cf-ray");
      const cfCacheStatus = upstreamRes.headers.get("cf-cache-status");
      const contentType = upstreamRes.headers.get("content-type");

      let bodySnippet: string | null = null;
      try {
        const text = await upstreamRes.text();
        bodySnippet = text.slice(0, 200);
      } catch {
        bodySnippet = null;
      }

      logger.error("[media/ui-image] imgproxy failed", {
        requestId,
        status: upstreamRes.status,
        src,
        width,
        height,
        quality,
        format,
        resize,
        gravity,
        upstreamUrl,
        server,
        cfRay,
        cfCacheStatus,
        contentType,
        bodySnippet,
      });

      res.status(upstreamRes.status);
      res.set("Content-Type", "text/plain");
      return res.send("Upstream failed");
    }

    const contentType =
      upstreamRes.headers.get("content-type") ||
      (format === "avif"
        ? "image/avif"
        : format === "webp"
          ? "image/webp"
          : format === "png"
            ? "image/png"
            : "image/jpeg");

    // Override the default "no-store" API middleware for this binary asset.
    setBinaryAssetCacheHeaders(res);
    res.set("Content-Type", contentType);

    const bytes = Buffer.from(await upstreamRes.arrayBuffer());
    logger.info("[media/ui-image] ok", {
      requestId,
      contentType,
      bytes: bytes.length,
    });
    return res.status(200).send(bytes);
  } catch (error) {
    logger.error("[media/ui-image] fetch error", {
      requestId,
      upstreamUrl,
      src,
      error,
    });
    return res.status(502).json({ error: "Fetch failed" });
  }
});

router.get("/sticker-static", async (req, res) => {
  const requestId = getRequestId();
  res.set("X-Media-Handler", "express");
  res.set("X-Media-Request-Id", requestId);
  res.set("X-Media-Route", "sticker-static");

  const src = typeof req.query.src === "string" ? req.query.src : null;
  if (!src || !isAllowedSourceUrl(src)) {
    logger.warn("[media/sticker-static] invalid src", {
      requestId,
      src,
      origin: req.headers.origin,
      referer: req.headers.referer,
      ua: req.headers["user-agent"],
    });
    return res.status(400).json({ error: "Invalid src" });
  }

  const width = clampInt(
    typeof req.query.w === "string" ? req.query.w : undefined,
    256,
    1,
    1024,
  );
  const height = clampInt(
    typeof req.query.h === "string" ? req.query.h : undefined,
    256,
    1,
    1024,
  );
  const quality = clampInt(
    typeof req.query.q === "string" ? req.query.q : undefined,
    82,
    40,
    95,
  );

  const fmtRaw = typeof req.query.fmt === "string" ? req.query.fmt : "webp";
  const format =
    fmtRaw === "avif" || fmtRaw === "webp" || fmtRaw === "png" || fmtRaw === "jpeg"
      ? fmtRaw
      : "webp";

  const pageRaw = typeof req.query.pg === "string" ? req.query.pg : undefined;
  const explicitPage =
    pageRaw === undefined ? undefined : clampInt(pageRaw, 1, 1, 9999);

  // We want a truly-static result:
  // - First try with pg:1 (frame 1) which works for animated images.
  // - If the source isn't animated/multipage, pg:1 can 404 in some imgproxy builds;
  //   so we retry without pg.
  const buildUpstreamUrl = (page?: number) =>
    getImgproxyUrl(src, {
      width,
      height,
      resize: "fit",
      format,
      quality,
      ...(page !== undefined ? { page } : {}),
    });

  const upstreamUrlPrimary = buildUpstreamUrl(explicitPage ?? 1);
  const upstreamUrlFallback =
    explicitPage !== undefined ? null : buildUpstreamUrl(undefined);

  const isSigned = !upstreamUrlPrimary.includes("/insecure/");
  res.set("X-Media-Upstream-Signed", isSigned ? "1" : "0");

  logger.info("[media/sticker-static] start", {
    requestId,
    src,
    width,
    height,
    quality,
    format,
    page: explicitPage ?? 1,
    hasFallback: Boolean(upstreamUrlFallback),
    isSigned,
    origin: req.headers.origin,
    referer: req.headers.referer,
    ua: req.headers["user-agent"],
  });

  try {
    const tryFetch = async (url: string) => {
      return fetch(url, {
        // imgproxy should be public and should not depend on cookies.
        credentials: "omit",
        cache: "no-store",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          referer: FRONTEND_URL,
        },
      });
    };

    let upstreamRes = await tryFetch(upstreamUrlPrimary);
    let upstreamUrlUsed = upstreamUrlPrimary;

    if (!upstreamRes.ok && upstreamUrlFallback) {
      // Retry without pg if the "first frame" transform isn't supported for this input.
      const retryRes = await tryFetch(upstreamUrlFallback);
      if (retryRes.ok) {
        upstreamRes = retryRes;
        upstreamUrlUsed = upstreamUrlFallback;
      }
    }

    if (!upstreamRes.ok) {
      const server = upstreamRes.headers.get("server");
      const cfRay = upstreamRes.headers.get("cf-ray");
      const cfCacheStatus = upstreamRes.headers.get("cf-cache-status");
      const contentType = upstreamRes.headers.get("content-type");

      let bodySnippet: string | null = null;
      try {
        const text = await upstreamRes.text();
        bodySnippet = text.slice(0, 200);
      } catch {
        bodySnippet = null;
      }

      logger.error("[media/sticker-static] imgproxy failed", {
        requestId,
        status: upstreamRes.status,
        upstreamUrl: upstreamUrlUsed,
        upstreamUrlPrimary,
        upstreamUrlFallback,
        src,
        server,
        cfRay,
        cfCacheStatus,
        contentType,
        bodySnippet,
      });

      res.status(upstreamRes.status);
      res.set("Content-Type", "text/plain");
      return res.send("Upstream failed");
    }

    const contentType =
      upstreamRes.headers.get("content-type") ||
      (format === "avif"
        ? "image/avif"
        : format === "webp"
          ? "image/webp"
          : format === "png"
            ? "image/png"
            : "image/jpeg");

    // Override the default "no-store" API middleware for this binary asset.
    setBinaryAssetCacheHeaders(res);
    res.set("Content-Type", contentType);

    const bytes = Buffer.from(await upstreamRes.arrayBuffer());
    logger.info("[media/sticker-static] ok", {
      requestId,
      contentType,
      bytes: bytes.length,
    });
    return res.status(200).send(bytes);
  } catch (error) {
    logger.error("[media/sticker-static] fetch error", {
      requestId,
      upstreamUrl: upstreamUrlPrimary,
      src,
      error,
    });
    return res.status(502).json({ error: "Fetch failed" });
  }
});

export default router;
