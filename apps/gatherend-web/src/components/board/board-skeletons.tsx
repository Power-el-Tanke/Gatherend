"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton para el Leftbar mientras carga
 */
export function LeftbarSkeleton() {
  return (
    <div className="flex flex-col h-full w-full p-3 gap-3">
      {/* Header skeleton */}
      <div className="flex items-center gap-2 px-2 py-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Channel skeletons */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <div className="space-y-1 pl-2">
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-1 pl-2">
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton para el Rightbar mientras carga
 */
export function RightbarSkeleton() {
  return (
    <div className="flex flex-col h-full w-full p-4 gap-4">
      {/* Members section */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <div className="grid grid-cols-4 gap-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-full" />
          ))}
        </div>
      </div>

      {/* Separator */}
      <Skeleton className="h-px w-full" />

      {/* DMs section */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
