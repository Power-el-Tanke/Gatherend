"use client";

import { memo, useRef, useEffect, ReactNode } from "react";

interface VirtualizedFeedPageProps {
  pageIndex: number;
  onMeasure: (pageIndex: number, height: number) => void;
  children: ReactNode;
}

/**
 * Wrapper component for a feed page that measures its height.
 * 
 * When the page renders, it measures its offsetHeight and reports it
 * via onMeasure. This height is then used for placeholder divs when
 * the page is virtualized out of the DOM.
 */
export const VirtualizedFeedPage = memo(function VirtualizedFeedPage({
  pageIndex,
  onMeasure,
  children,
}: VirtualizedFeedPageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(0);

  // Measure on mount and when children change
  useEffect(() => {
    if (ref.current) {
      const height = ref.current.offsetHeight;
      // Only report if height changed significantly
      if (Math.abs(height - lastHeightRef.current) > 5) {
        lastHeightRef.current = height;
        onMeasure(pageIndex, height);
      }
    }
  });

  // Also use ResizeObserver for dynamic content
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (Math.abs(height - lastHeightRef.current) > 5) {
          lastHeightRef.current = height;
          onMeasure(pageIndex, height);
        }
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [pageIndex, onMeasure]);

  return (
    <div ref={ref} data-feed-page={pageIndex}>
      {children}
    </div>
  );
});
