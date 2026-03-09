"use client";

import { memo } from "react";
import { GatherendOutlineSVG } from "@/lib/gatherend-outline";

/**
 * Fallback de carga para vistas en Suspense.
 * Memoizado para evitar reconciliación innecesaria cuando el padre re-renderiza.
 */
export const ViewLoadingFallback = memo(function ViewLoadingFallback() {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-4">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-theme-border-primary" />
        <GatherendOutlineSVG className="absolute inset-0 w-full h-full p-2 text-theme-accent-light animate-pulse" />
      </div>
      <p className="text-[18px] text-theme-text-accent">Loading...</p>
    </div>
  );
});

/**
 * Fallback de error para Error Boundaries.
 * Memoizado para evitar re-creación innecesaria del componente.
 */
export const ViewErrorFallback = memo(function ViewErrorFallback({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  const handleReload = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-full items-center justify-center gap-3 p-8 text-center">
      <h2 className="text-lg font-semibold text-theme-text-light">
        Something went wrong
      </h2>
      <p className="text-sm text-theme-text-muted max-w-sm">
        An error occurred while loading this view.
      </p>
      <button
        onClick={handleReload}
        className="mt-2 px-4 py-2 bg-theme-bg-tertiary hover:bg-theme-bg-tertiary/70 text-theme-text-light rounded-lg transition-colors text-sm"
      >
        Retry
      </button>
    </div>
  );
});

/**
 * Skeleton genérico para listas.
 * Memoizado — output es estático.
 */
export const ListSkeleton = memo(function ListSkeleton({
  count = 5,
}: {
  count?: number;
}) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-theme-bg-tertiary animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 bg-theme-bg-tertiary rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-theme-bg-tertiary rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
});
