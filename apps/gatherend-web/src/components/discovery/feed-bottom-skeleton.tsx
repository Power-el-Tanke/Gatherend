"use client";

import { memo } from "react";

/**
 * Bottom skeleton for the discovery feed.
 * 
 * Shown at the bottom of the feed when:
 * 1. More pages are being fetched
 * 2. There are more pages available to load
 * 
 * This acts as a "tope" (stopper) that hides the construction
 * of new pages, providing smooth UX without visible content popping in.
 */
export const FeedBottomSkeleton = memo(function FeedBottomSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-theme-bg-primary border border-white/10 rounded-xl overflow-hidden w-full max-w-[620px] animate-pulse"
        >
          {/* Image skeleton */}
          <div className="w-full h-[140px] bg-white/5" />

          {/* Body skeleton */}
          <div className="p-5 flex flex-col gap-3">
            {/* Title skeleton */}
            <div className="h-6 bg-white/10 rounded w-3/4" />
            {/* Description skeleton */}
            <div className="h-4 bg-white/5 rounded w-full" />
            <div className="h-4 bg-white/5 rounded w-5/6" />

            {/* Tags skeleton */}
            <div className="flex gap-2 mt-1">
              <div className="h-5 w-16 bg-white/10 rounded" />
              <div className="h-5 w-20 bg-white/10 rounded" />
            </div>

            {/* Footer skeleton */}
            <div className="flex items-center justify-between mt-2">
              <div className="h-4 bg-white/5 rounded w-32" />
              <div className="h-8 w-16 bg-theme-button-primary/30 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
