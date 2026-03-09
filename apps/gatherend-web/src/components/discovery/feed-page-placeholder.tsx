"use client";

import { memo } from "react";

interface FeedPagePlaceholderProps {
  pageIndex: number;
  height: number;
}

/**
 * Lightweight placeholder for virtualized-out feed pages.
 * 
 * Replaces actual page content with a simple div that maintains
 * the scroll geometry. This allows the browser to GC image bitmaps
 * from pages that are no longer in the viewport.
 */
export const FeedPagePlaceholder = memo(function FeedPagePlaceholder({
  pageIndex,
  height,
}: FeedPagePlaceholderProps) {
  return (
    <div
      data-feed-placeholder={pageIndex}
      style={{ height }}
      className="w-full"
      aria-hidden="true"
    />
  );
});
