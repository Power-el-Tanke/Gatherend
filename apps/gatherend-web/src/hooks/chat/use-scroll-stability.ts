import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

interface ScrollCapture {
  anchorId: string;
  offsetFromAnchor: number;
  offsetType: "fromTop" | "fromBottom";
  capturedScrollTop: number;
  capturedScrollHeight: number;
  capturedDistanceFromTop: number;
  capturedDistanceFromBottom: number;
  capturedAt: number;
}

interface ScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  distanceFromTop: number;
  distanceFromBottom: number;
}

interface PendingRestore {
  direction: "top" | "bottom";
  armedScrollHeight: number;
  waitForScrollHeightDeltaPx?: number;
  cancelIfUserMovedPx?: number;
  armedAt: number;
  maxWaitMs?: number;
}

interface StabilizationSession {
  anchorId: string;
  offsetType: "fromTop" | "fromBottom";
  desiredOffset: number;
  startedAt: number;
  stableSince: number;
  maxDurationMs: number;
}

interface CaptureOptions {
  /**
   * Prefer keeping the previously captured anchorId (if it still exists) and
   * only update its offset while a fetch is in-flight.
   */
  preferExistingAnchor?: boolean;
  excludeMessageId?: string | null;
}

interface RestoreOptions {
  waitForScrollHeightDeltaPx?: number;
  cancelIfUserMovedPx?: number;
  maxWaitMs?: number;
}

const USER_INPUT_WINDOW_MS = 160;
const PROGRAMMATIC_WRITE_WINDOW_MS = 80;
const UNEXPECTED_SCROLL_DELTA_PX = 140;
const ANCHOR_APPLY_EPSILON_PX = 1;

const STABILIZE_TICK_MS = 35;
const STABILIZE_MAX_MS = 900;
const STABILIZE_IDLE_MS = 140;
const STABILIZE_EPSILON_PX = 0.75;

export function useScrollStability(container: HTMLDivElement | null) {
  const containerElRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    containerElRef.current = container;
  }, [container]);

  const capturedRef = useRef<ScrollCapture | null>(null);
  const suppressUntilRef = useRef<number>(0);
  const pendingRestoreRef = useRef<PendingRestore | null>(null);

  const lastUserInputAtRef = useRef<number>(0);
  const lastUserInputTypeRef = useRef<string>("none");
  const lastProgrammaticWriteAtRef = useRef<number>(0);
  const lastProgrammaticWriteReasonRef = useRef<string>("none");

  const lastSeenScrollTopRef = useRef<number | null>(null);
  const lastSeenScrollHeightRef = useRef<number | null>(null);

  const stabilizationRef = useRef<StabilizationSession | null>(null);
  const stabilizationRafRef = useRef<number | null>(null);
  const stabilizationLastTickAtRef = useRef<number>(0);

  const getScrollPosition = useCallback((): ScrollPosition | null => {
    const currentContainer = containerElRef.current;
    if (!currentContainer) return null;

    const { scrollTop, scrollHeight, clientHeight } = currentContainer;
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
    const clampedScrollTop = Math.min(maxScrollTop, Math.max(0, scrollTop));

    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceFromTop: clampedScrollTop,
      distanceFromBottom: Math.max(0, maxScrollTop - clampedScrollTop),
    };
  }, []);

  const markUserInput = useCallback((type: string) => {
    lastUserInputAtRef.current = Date.now();
    lastUserInputTypeRef.current = type;
  }, []);

  const markProgrammaticWrite = useCallback((reason: string) => {
    lastProgrammaticWriteAtRef.current = Date.now();
    lastProgrammaticWriteReasonRef.current = reason;
  }, []);

  useEffect(() => {
    if (!container) return;

    const onWheel = () => markUserInput("wheel");
    const onTouchMove = () => markUserInput("touchmove");
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons) markUserInput("pointermove");
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const keys = new Set([
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
      ]);
      if (keys.has(e.key)) markUserInput(`keydown:${e.key}`);
    };

    const onScroll = () => {
      const pos = getScrollPosition();
      if (!pos) return;

      const prevTop = lastSeenScrollTopRef.current;
      const prevHeight = lastSeenScrollHeightRef.current;
      lastSeenScrollTopRef.current = pos.scrollTop;
      lastSeenScrollHeightRef.current = pos.scrollHeight;

      if (prevTop == null || prevHeight == null) return;

      const deltaTop = pos.scrollTop - prevTop;
      const deltaHeight = pos.scrollHeight - prevHeight;

      const now = Date.now();
      const recentUser = now - lastUserInputAtRef.current <= USER_INPUT_WINDOW_MS;
      const recentProg =
        now - lastProgrammaticWriteAtRef.current <= PROGRAMMATIC_WRITE_WINDOW_MS;

      const cause = recentProg
        ? `programmatic:${lastProgrammaticWriteReasonRef.current}`
        : recentUser
          ? `user:${lastUserInputTypeRef.current}`
          : "unknown";

      const looksLikeJump =
        Math.abs(deltaTop) >= UNEXPECTED_SCROLL_DELTA_PX ||
        (Math.abs(deltaTop) >= 60 && cause === "unknown") ||
        Math.abs(deltaHeight) >= 600;

      if (!looksLikeJump) return;

    };

    container.addEventListener("wheel", onWheel, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("pointermove", onPointerMove, { passive: true });
    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown, { passive: true });

    const initial = getScrollPosition();
    if (initial) {
      lastSeenScrollTopRef.current = initial.scrollTop;
      lastSeenScrollHeightRef.current = initial.scrollHeight;
    }

    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [container, getScrollPosition, markUserInput]);

  const capture = useCallback(
    (direction: "top" | "bottom", options?: CaptureOptions) => {
      const currentContainer = containerElRef.current;
      if (!currentContainer) return;

      const pos = getScrollPosition();
      if (!pos) return;


      if (options?.preferExistingAnchor && capturedRef.current?.anchorId) {
        const existingId = capturedRef.current.anchorId;
        const existingOffsetType = capturedRef.current.offsetType;
        const el =
          (currentContainer.querySelector(
            `:scope > [data-message-id="${existingId}"]`
          ) as HTMLElement | null) ||
          (currentContainer.querySelector(
            `[data-message-id="${existingId}"]`
          ) as HTMLElement | null);

        if (el) {
          const rect = el.getBoundingClientRect();
          const containerRect = currentContainer.getBoundingClientRect();
          const offsetFromAnchor =
            existingOffsetType === "fromBottom"
              ? containerRect.bottom - rect.bottom
              : rect.top - containerRect.top;

          capturedRef.current = {
            anchorId: existingId,
            offsetFromAnchor,
            offsetType: existingOffsetType,
            capturedScrollTop: pos.scrollTop,
            capturedScrollHeight: pos.scrollHeight,
            capturedDistanceFromTop: pos.distanceFromTop,
            capturedDistanceFromBottom: pos.distanceFromBottom,
            capturedAt: Date.now(),
          };

          return;
        }
      }

      const directChildren = currentContainer.querySelectorAll(
        ":scope > [data-message-id]"
      );
      const messages =
        directChildren.length > 0
          ? directChildren
          : currentContainer.querySelectorAll("[data-message-id]");
      if (messages.length === 0) {
        return;
      }

      const containerRect = currentContainer.getBoundingClientRect();

      let bestId: string | null = null;
      let bestOffset = 0;
      let bestOffsetType: "fromTop" | "fromBottom" =
        direction === "bottom" ? "fromBottom" : "fromTop";
      let bestDistance = Number.POSITIVE_INFINITY;
      let excludedCount = 0;

      for (const message of messages) {
        const messageId = message.getAttribute("data-message-id");
        if (!messageId) continue;
        if (options?.excludeMessageId && messageId === options.excludeMessageId) {
          excludedCount += 1;
          continue;
        }

        const rect = message.getBoundingClientRect();

        if (direction === "bottom") {
          const offsetFromBottom = containerRect.bottom - rect.bottom;
          const distance = Math.abs(offsetFromBottom);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestId = messageId;
            bestOffset = offsetFromBottom;
            bestOffsetType = "fromBottom";
          }
        } else {
          const offsetFromTop = rect.top - containerRect.top;
          const distance = Math.abs(offsetFromTop);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestId = messageId;
            bestOffset = offsetFromTop;
            bestOffsetType = "fromTop";
          }
        }
      }

      if (!bestId) {
        return;
      }

      capturedRef.current = {
        anchorId: bestId,
        offsetFromAnchor: bestOffset,
        offsetType: bestOffsetType,
        capturedScrollTop: pos.scrollTop,
        capturedScrollHeight: pos.scrollHeight,
        capturedDistanceFromTop: pos.distanceFromTop,
        capturedDistanceFromBottom: pos.distanceFromBottom,
        capturedAt: Date.now(),
      };

    },
    [getScrollPosition]
  );

  const applyPendingRestore = useCallback(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) return;

    const currentContainer = containerElRef.current;
    const captured = capturedRef.current;
    if (!currentContainer || !captured) {
      pendingRestoreRef.current = null;
      return;
    }

    const now = Date.now();
    if (pending.maxWaitMs && now - pending.armedAt > pending.maxWaitMs) {
      pendingRestoreRef.current = null;
      capturedRef.current = null;
      return;
    }

    const deltaSinceArmed =
      pending.waitForScrollHeightDeltaPx != null
        ? Math.abs(currentContainer.scrollHeight - pending.armedScrollHeight)
        : null;

    let effectiveCapture = captured;
    if (
      pending.cancelIfUserMovedPx != null &&
      Math.abs(currentContainer.scrollTop - captured.capturedScrollTop) >
        pending.cancelIfUserMovedPx
    ) {
      const deltaScrollTop =
        currentContainer.scrollTop - captured.capturedScrollTop;
      const movedPx = Math.abs(deltaScrollTop);
      const rebasedOffset =
        captured.offsetType === "fromBottom"
          ? captured.offsetFromAnchor + deltaScrollTop
          : captured.offsetFromAnchor - deltaScrollTop;

      effectiveCapture = {
        ...captured,
        offsetFromAnchor: rebasedOffset,
        capturedScrollTop: currentContainer.scrollTop,
        capturedAt: Date.now(),
      };
      capturedRef.current = effectiveCapture;

    }

    const deltaHeightFromCapture =
      currentContainer.scrollHeight - effectiveCapture.capturedScrollHeight;

    const anchorEl =
      (currentContainer.querySelector(
        `:scope > [data-message-id="${effectiveCapture.anchorId}"]`
      ) as HTMLElement | null) ||
      (currentContainer.querySelector(
        `[data-message-id="${effectiveCapture.anchorId}"]`
      ) as HTMLElement | null);
    if (!anchorEl) {
      if (pending.maxWaitMs && now - pending.armedAt <= pending.maxWaitMs) {
        return;
      }

      pendingRestoreRef.current = null;
      capturedRef.current = null;
      return;
    }

    const posBefore = getScrollPosition();

    const rect = anchorEl.getBoundingClientRect();
    const containerRect = currentContainer.getBoundingClientRect();
    const currentOffset =
      effectiveCapture.offsetType === "fromBottom"
        ? containerRect.bottom - rect.bottom
        : rect.top - containerRect.top;
    const delta = currentOffset - effectiveCapture.offsetFromAnchor;

    if (pending.waitForScrollHeightDeltaPx != null) {
      const minDelta = pending.waitForScrollHeightDeltaPx;
      const hasEnoughHeightDelta =
        deltaSinceArmed != null && deltaSinceArmed >= minDelta;
      const hasAnchorMovementEvidence =
        Math.abs(delta) >= ANCHOR_APPLY_EPSILON_PX;

      if (!hasEnoughHeightDelta && !hasAnchorMovementEvidence) return;
    }


    if (effectiveCapture.offsetType === "fromBottom") {
      markProgrammaticWrite("restore:anchor-bottom");
      currentContainer.scrollTop -= delta;
    } else {
      markProgrammaticWrite("restore:anchor-top");
      currentContainer.scrollTop += delta;
    }

    const restoredScrollTop = currentContainer.scrollTop;
    const posAfter = getScrollPosition();

    // Start a short stabilization session to correct late layout shifts
    // (fonts, compact transitions, images, etc.) after the initial restore.
    {
      const reRect = anchorEl.getBoundingClientRect();
      const reContainerRect = currentContainer.getBoundingClientRect();
      const desiredOffset =
        effectiveCapture.offsetType === "fromBottom"
          ? reContainerRect.bottom - reRect.bottom
          : reRect.top - reContainerRect.top;

      stabilizationRef.current = {
        anchorId: effectiveCapture.anchorId,
        offsetType: effectiveCapture.offsetType,
        desiredOffset,
        startedAt: Date.now(),
        stableSince: Date.now(),
        maxDurationMs: STABILIZE_MAX_MS,
      };
    }

    requestAnimationFrame(() => {
      const verifyPos = getScrollPosition();
      if (!verifyPos) return;

      const captureAge = Date.now() - effectiveCapture.capturedAt;
      const shiftSinceRestore = verifyPos.scrollTop - restoredScrollTop;

    });

    pendingRestoreRef.current = null;
    capturedRef.current = null;
  }, [getScrollPosition, markProgrammaticWrite]);

  const tickStabilization = useCallback(() => {
    const session = stabilizationRef.current;
    if (!session) return;

    const currentContainer = containerElRef.current;
    if (!currentContainer) {
      stabilizationRef.current = null;
      return;
    }

    const now = Date.now();
    if (now - session.startedAt > session.maxDurationMs) {
      stabilizationRef.current = null;
      return;
    }

    const recentUser = now - lastUserInputAtRef.current <= USER_INPUT_WINDOW_MS;

    const anchorEl =
      (currentContainer.querySelector(
        `:scope > [data-message-id="${session.anchorId}"]`
      ) as HTMLElement | null) ||
      (currentContainer.querySelector(
        `[data-message-id="${session.anchorId}"]`
      ) as HTMLElement | null);
    if (!anchorEl) {
      stabilizationRef.current = null;
      return;
    }

    const rect = anchorEl.getBoundingClientRect();
    const containerRect = currentContainer.getBoundingClientRect();
    const currentOffset =
      session.offsetType === "fromBottom"
        ? containerRect.bottom - rect.bottom
        : rect.top - containerRect.top;

    if (recentUser) {
      // While the user is actively scrolling, treat the current viewport as truth
      // (B+ semantics) and rebase the desiredOffset to avoid fighting input.
      stabilizationRef.current = {
        ...session,
        desiredOffset: currentOffset,
        stableSince: now,
      };
      return;
    }

    const drift = currentOffset - session.desiredOffset;
    if (Math.abs(drift) >= STABILIZE_EPSILON_PX) {
      if (session.offsetType === "fromBottom") {
        markProgrammaticWrite("stabilize:anchor-bottom");
        currentContainer.scrollTop -= drift;
      } else {
        markProgrammaticWrite("stabilize:anchor-top");
        currentContainer.scrollTop += drift;
      }

      stabilizationRef.current = {
        ...session,
        stableSince: now,
      };
      return;
    }

    if (now - session.stableSince >= STABILIZE_IDLE_MS) {
      stabilizationRef.current = null;
      return;
    }
  }, [markProgrammaticWrite]);

  const ensureStabilizationLoop = useCallback(() => {
    if (stabilizationRafRef.current != null) return;

    const run = () => {
      stabilizationRafRef.current = null;

      if (!stabilizationRef.current) return;

      const now = Date.now();
      if (now - stabilizationLastTickAtRef.current >= STABILIZE_TICK_MS) {
        stabilizationLastTickAtRef.current = now;
        tickStabilization();
      }

      if (stabilizationRef.current) {
        stabilizationRafRef.current = window.requestAnimationFrame(run);
      }
    };

    stabilizationRafRef.current = window.requestAnimationFrame(run);
  }, [tickStabilization]);

  const restore = useCallback(
    (direction: "top" | "bottom", options?: RestoreOptions) => {
      const currentContainer = containerElRef.current;
      const captured = capturedRef.current;
      if (!currentContainer || !captured) return;

      // A new restore request supersedes any previous stabilization session.
      stabilizationRef.current = null;
      if (stabilizationRafRef.current != null) {
        window.cancelAnimationFrame(stabilizationRafRef.current);
        stabilizationRafRef.current = null;
      }


      const minDelta = options?.waitForScrollHeightDeltaPx ?? 0;
      pendingRestoreRef.current = {
        direction,
        armedScrollHeight: currentContainer.scrollHeight,
        waitForScrollHeightDeltaPx: minDelta > 0 ? minDelta : undefined,
        cancelIfUserMovedPx: options?.cancelIfUserMovedPx,
        armedAt: Date.now(),
        maxWaitMs: options?.maxWaitMs,
      };
    },
    []
  );

  useLayoutEffect(() => {
    applyPendingRestore();
    if (stabilizationRef.current) ensureStabilizationLoop();
  });

  const cancelRestore = useCallback(() => {
    pendingRestoreRef.current = null;
    capturedRef.current = null;
    stabilizationRef.current = null;
    if (stabilizationRafRef.current != null) {
      window.cancelAnimationFrame(stabilizationRafRef.current);
      stabilizationRafRef.current = null;
    }
  }, []);

  const suppressTriggers = useCallback((durationMs: number = 100) => {
    suppressUntilRef.current = Date.now() + durationMs;
  }, []);

  const isTriggersSupressed = useCallback(() => {
    return Date.now() < suppressUntilRef.current;
  }, []);

  const scrollToBottom = useCallback(() => {
    const currentContainer = containerElRef.current;
    if (!currentContainer) return;
    const maxScrollTop = Math.max(
      0,
      currentContainer.scrollHeight - currentContainer.clientHeight
    );
    if (Math.abs(currentContainer.scrollTop - maxScrollTop) < 1) return;
    markProgrammaticWrite("scrollToBottom");
    currentContainer.scrollTop = maxScrollTop;
  }, [markProgrammaticWrite]);

  return {
    getScrollPosition,
    capture,
    restore,
    cancelRestore,
    suppressTriggers,
    isTriggersSupressed,
    scrollToBottom,
  };
}

export type ScrollStability = ReturnType<typeof useScrollStability>;
