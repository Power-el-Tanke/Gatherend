"use client";

/**
 * AnimatedSticker Component
 *
 * Renders animated stickers (WebP/GIF) with hover-controlled animation:
 * - Default: Shows static first frame
 * - On hover: Shows animated version
 *
 * Uses imgproxy to produce a guaranteed-static JPEG preview (first frame).
 *
 * @param isHovered - Optional external hover state control. When provided,
 *                    the component won't track its own hover state.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import {
  isAnimatedFormat,
  canUseImgproxy,
} from "@/lib/imgproxy-utils";
import { cn } from "@/lib/utils";

export interface AnimatedStickerProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onClick?: () => void;
  /** External hover control - when provided, overrides internal hover state */
  isHovered?: boolean;
  /**
   * Fallback container size (CSS px) used before ResizeObserver reports a real
   * box. This prevents an initial oversized `w/h` (e.g. 256) that later shrinks
   * (e.g. 64) and shows up as `img.src` mutations.
   */
  fallbackWidthPx?: number;
  fallbackHeightPx?: number;
}

export function AnimatedSticker({
  src,
  alt,
  className,
  containerClassName,
  onClick,
  isHovered: externalHovered,
  fallbackWidthPx,
  fallbackHeightPx,
}: AnimatedStickerProps) {
  const [internalHovering, setInternalHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animatedBlobRef = useRef<Blob | null>(null);
  const animatedPrefetchStartedRef = useRef(false);
  const animatedAbortRef = useRef<AbortController | null>(null);
  const animatedObjectUrlRef = useRef<string | null>(null);
  const hoverSwapTokenRef = useRef(0);
  const [containerBox, setContainerBox] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Use external hover if provided, otherwise use internal state
  const isHovering = externalHovered ?? internalHovering;
  const useInternalHover = externalHovered === undefined;

  const isAnimatable = isAnimatedFormat(src);
  const shouldMeasureBox = fallbackWidthPx == null || fallbackHeightPx == null;

  const revokeAnimatedObjectUrl = useCallback(() => {
    if (animatedObjectUrlRef.current) {
      URL.revokeObjectURL(animatedObjectUrlRef.current);
      animatedObjectUrlRef.current = null;
    }
  }, []);

  const resetAnimatedObjectUrl = useCallback(() => {
    revokeAnimatedObjectUrl();
  }, [revokeAnimatedObjectUrl]);

  useEffect(() => {
    if (!shouldMeasureBox) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      setContainerBox((prev) => {
        const next = { width: Math.round(width), height: Math.round(height) };
        if (
          prev &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev;
        }
        return next;
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [shouldMeasureBox]);

  const blobFetchMode =
    process.env.NEXT_PUBLIC_STICKER_BLOB_FETCH_MODE || "direct";
  const blobFetchUrl = useMemo(() => {
    // direct: fetch from CDN directly (requires CORS on cdn.gatherend.com)
    // express: fetch through Express proxy (works without CDN CORS, but adds server hop)
    if (blobFetchMode === "express") {
      return `${process.env.NEXT_PUBLIC_API_URL}/media/fetch?src=${encodeURIComponent(
        src,
      )}`;
    }
    // NOTE: We append a stable query param so Cloudflare doesn't serve an old cached
    // variant that was cached before CORS headers were enabled for this hostname.
    // This can be removed after a cache purge or once you're sure all cached assets
    // include `Vary: Origin` and `Access-Control-Allow-Origin`.
    const sep = src.includes("?") ? "&" : "?";
    return `${src}${sep}__g_cors=1`;
  }, [blobFetchMode, src]);

  const staticUrl = useMemo(() => {
    if (!isAnimatable) return src;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const baseWidth = (shouldMeasureBox ? containerBox?.width : fallbackWidthPx) ?? 128;
    const baseHeight =
      (shouldMeasureBox ? containerBox?.height : fallbackHeightPx) ?? 128;
    const width = Math.min(
      512,
      Math.max(1, Math.round(baseWidth * dpr)),
    );
    const height = Math.min(
      512,
      Math.max(1, Math.round(baseHeight * dpr)),
    );

    if (!canUseImgproxy(src)) return src;
    return `${process.env.NEXT_PUBLIC_API_URL}/media/sticker-static?src=${encodeURIComponent(src)}&w=${width}&h=${height}&q=82&fmt=webp`;
  }, [
    containerBox?.height,
    containerBox?.width,
    fallbackHeightPx,
    fallbackWidthPx,
    isAnimatable,
    src,
  ]);

  const startAnimatedPrefetch = useCallback(() => {
    if (!isAnimatable) return;
    if (!canUseImgproxy(src)) return; // We only support our own CDN sources here
    if (animatedBlobRef.current) return;
    if (animatedPrefetchStartedRef.current) return;

    animatedPrefetchStartedRef.current = true;
    const controller = new AbortController();
    animatedAbortRef.current = controller;

    fetch(blobFetchUrl, {
      signal: controller.signal,
      credentials: "omit",
      mode: "cors",
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob) {
          animatedBlobRef.current = blob;
        }
      })
      .catch((err) => {
        // Aborts are expected (route refresh, StrictMode dev re-mounts, list reflows).
        // They are not a real failure and should not spam the console.
        if (err && typeof err === "object" && "name" in err) {
          const name = (err as { name?: unknown }).name;
          if (name === "AbortError") return;
        }
        // Ignore failures; we'll fall back to network URL playback.
        // If blobFetchMode === "direct", this is typically a CDN CORS issue.
        // eslint-disable-next-line no-console
        console.error("[AnimatedSticker] blob prefetch failed", {
          src,
          blobFetchMode,
          error: err,
        });
      })
      .finally(() => {
        animatedAbortRef.current = null;
      });
  }, [blobFetchMode, blobFetchUrl, isAnimatable, src]);

  const [staticPreviewFailedState, setStaticPreviewFailedState] = useState<{
    src: string;
    failed: boolean;
  } | null>(null);
  const staticPreviewFailed =
    staticPreviewFailedState?.src === src ? staticPreviewFailedState.failed : false;

  const resolvedStaticUrl = staticUrl;

  // Start on the static preview to avoid an initial animated URL paint that
  // immediately swaps to static (shows up as `img.src` churn and can contribute
  // to post-restore anchoring drift).
  const [displayedUrl, setDisplayedUrl] = useState<string>(() =>
    isAnimatable ? resolvedStaticUrl : src,
  );

  const handleMouseEnter = useCallback(() => {
    // Warm up bytes early; do not create the object URL here. We want a fresh
    // object URL per hover, so playback always starts at frame 1.
    startAnimatedPrefetch();
    setInternalHovering(true);
  }, [startAnimatedPrefetch]);
  const handleMouseLeave = useCallback(() => setInternalHovering(false), []);

  useEffect(() => {
    // Reset cached animation when src changes.
    animatedAbortRef.current?.abort();
    animatedAbortRef.current = null;
    animatedBlobRef.current = null;
    animatedPrefetchStartedRef.current = false;
    hoverSwapTokenRef.current += 1; // invalidate any in-flight preloaders
    resetAnimatedObjectUrl();
    setDisplayedUrl(isAnimatable ? resolvedStaticUrl : src);

    return () => {
      animatedAbortRef.current?.abort();
      resetAnimatedObjectUrl();
    };
  }, [resetAnimatedObjectUrl, src]);

  useEffect(() => {
    if (!isAnimatable) return;
    // CPU/GPU-first: only prefetch when actually hovered.
    if (!isHovering) return;
    startAnimatedPrefetch();
  }, [isAnimatable, isHovering, startAnimatedPrefetch]);

  useEffect(() => {
    if (!isAnimatable) return;

    if (!isHovering) {
      // Cancel any pending hover swap and return to static immediately.
      hoverSwapTokenRef.current += 1;
      resetAnimatedObjectUrl();
      setDisplayedUrl(resolvedStaticUrl);
      return;
    }

    // During post-restore windows, avoid swapping media `src` while the scroll
    // system is settling; this reduces micro scroll anchoring adjustments.
    const freezeUntil =
      typeof window !== "undefined"
        ? ((window as any).__gatherendMediaFreezeUntil as number | undefined)
        : undefined;
    if (
      freezeUntil != null &&
      typeof performance !== "undefined" &&
      typeof performance.now === "function" &&
      performance.now() < freezeUntil
    ) {
      resetAnimatedObjectUrl();
      setDisplayedUrl(resolvedStaticUrl);
      return;
    }

    // We're hovered. Keep showing static until the animated URL is fully loaded,
    // then swap to avoid a 1-frame flash/blank.
    const token = (hoverSwapTokenRef.current += 1);

    // Ensure bytes are on the way even if hover starts early.
    startAnimatedPrefetch();

    const swapWhenLoaded = (nextUrl: string) => {
      if (typeof window === "undefined") return;
      const preloader = new window.Image();
      preloader.decoding = "async";
      preloader.onload = () => {
        if (!isHovering) return;
        if (hoverSwapTokenRef.current !== token) return;
        setDisplayedUrl(nextUrl);
      };
      preloader.onerror = () => {
        // If this fails, we keep static; user can still see something.
      };
      preloader.src = nextUrl;
    };

    if (animatedBlobRef.current) {
      // New object URL on each hover -> always restarts from frame 1.
      resetAnimatedObjectUrl();
      const nextUrl = URL.createObjectURL(animatedBlobRef.current);
      animatedObjectUrlRef.current = nextUrl;
      swapWhenLoaded(nextUrl);
      return;
    }

    // Fallback: no blob available (CORS/network). We can still animate via the
    // raw URL, but restart-from-frame-1 won't be guaranteed.
    swapWhenLoaded(src);
  }, [
    isAnimatable,
    isHovering,
    resetAnimatedObjectUrl,
    resolvedStaticUrl,
    src,
    startAnimatedPrefetch,
  ]);

  useEffect(() => {
    // Keep static in sync when not hovering (covers staticUrl recalculation on resize/DPR).
    if (!isAnimatable) return;
    if (isHovering) return;
    setDisplayedUrl(resolvedStaticUrl);
  }, [isAnimatable, isHovering, resolvedStaticUrl]);

  // Non-animatable: render normally
  if (!isAnimatable) {
    return (
      <div className={cn("relative", containerClassName)} onClick={onClick}>
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized={isAnimatedFormat(src)}
          className={cn("object-contain", className)}
        />
      </div>
    );
  }

  // Animatable: static by default, animated on hover
  return (
    <div
      ref={containerRef}
      className={cn("relative", containerClassName)}
      onMouseEnter={useInternalHover ? handleMouseEnter : undefined}
      onMouseLeave={useInternalHover ? handleMouseLeave : undefined}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displayedUrl}
        alt={alt}
        onError={() => {
          // Only handle failures of the static preview; animated hover may still work.
          if (displayedUrl === resolvedStaticUrl) {
            setStaticPreviewFailedState({ src, failed: true });
          }
        }}
        className={cn("w-full h-full object-contain", className)}
        data-static-preview-failed={staticPreviewFailed ? "true" : "false"}
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

export default AnimatedSticker;
