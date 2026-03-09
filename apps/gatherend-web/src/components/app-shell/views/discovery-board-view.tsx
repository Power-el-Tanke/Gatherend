"use client";

import { memo, useState } from "react";
import { DiscoveryBoardCard } from "@/components/discovery/discovery-search-results/discovery-board-card";
import { DiscoverySkeleton } from "@/components/discovery/discovery-skeleton";
import { FeedBottomSkeleton } from "@/components/discovery/feed-bottom-skeleton";
import { RefreshCw } from "lucide-react";
import type {
  CommunityInfo,
  BoardPageSlot,
} from "@/hooks/discovery/boards-feed/use-community-boards-feed";
import type { Languages } from "@prisma/client";
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { getNeverAnimatedImageUrl } from "@/lib/media-static";

export interface DiscoveryBoardViewProps {
  community: CommunityInfo | null;
  pageSlots: BoardPageSlot[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error?: string | null;
  emptyText?: string;
  onRefresh?: () => Promise<unknown> | void;
  /** Indica si hay nuevos boards (via WebSocket) */
  hasNewBoards?: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  bottomSentinelRef: React.RefObject<HTMLDivElement>;
  measurePage: (pageIndex: number, element: HTMLElement | null) => void;
}

function DiscoveryBoardViewInner({
  community,
  pageSlots,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  error,
  emptyText,
  onRefresh,
  hasNewBoards,
  containerRef,
  bottomSentinelRef,
  measurePage,
}: DiscoveryBoardViewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Hook optimizado para extracción de color (usa Web Worker)
  const bannerImageUrl = community?.imageUrl
    ? getNeverAnimatedImageUrl(community.imageUrl, { w: 2048, h: 512, q: 82 })
    : undefined;

  const { dominantColor, handleImageLoad } = useColorExtraction({
    imageUrl: bannerImageUrl,
  });

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col overflow-y-auto scrollbar-chat"
    >
      {/* Header de la comunidad */}
      {community && (
        <>
          {/* Banner/Imagen - no sticky, sale del viewport al hacer scroll */}
          <div className="relative w-full h-40 bg-theme-bg-tertiary shrink-0">
            {bannerImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerImageUrl}
                alt={community.name}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
                crossOrigin="anonymous"
                onLoad={handleImageLoad}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-theme-text-muted bg-theme-bg-tertiary">
                {community.name.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Gradiente overlay para legibilidad */}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
          </div>
          {/* Info de la comunidad - sticky, se queda fijo */}
          <div
            className="px-6 py-4 border-b border-theme-border flex items-center justify-between sticky top-0 z-20 transition-colors duration-300 shrink-0"
            style={{
              backgroundColor: dominantColor || "var(--theme-bg-secondary)",
            }}
          >
            <div>
              <h1 className="text-2xl font-bold text-white">
                {community.name}
              </h1>
              <p className="text-sm text-white/70 mt-1">
                {community.memberCount} miembro
                {community.memberCount === 1 ? "" : "s"} —{" "}
                {community.activeBoardsCount} board
                {community.activeBoardsCount === 1 ? "" : "s"} abierto
                {community.activeBoardsCount === 1 ? "" : "s"}
              </p>
            </div>
            {/* Botón de refresh */}
            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="relative p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                title={hasNewBoards ? "Hay nuevos boards" : "Refrescar boards"}
              >
                <RefreshCw
                  className={`h-5 w-5 text-white/70 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                {/* Indicador de nuevos boards */}
                {hasNewBoards && !isRefreshing && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                )}
              </button>
            )}
          </div>
        </>
      )}

      {/* Lista de boards */}
      <div className="px-6 py-4 flex-1">
        {isLoading ? (
          <DiscoverySkeleton />
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            Error: {error}
          </div>
        ) : pageSlots.length === 0 ? (
          <div className="text-center py-8 text-theme-text-muted">
            {emptyText || "No hay boards."}
          </div>
        ) : (
          <>
            {pageSlots.map((slot) => {
              if (slot.type === "virtualized") {
                // Placeholder for virtualized pages
                return (
                  <div
                    key={`placeholder-${slot.pageIndex}`}
                    style={{ height: slot.height }}
                    className="shrink-0"
                  />
                );
              }

              // Rendered page with measurement
              return (
                <div
                  key={`page-${slot.pageIndex}`}
                  ref={(el) => measurePage(slot.pageIndex, el)}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  {slot.page.items.map((board) => (
                    <DiscoveryBoardCard
                      key={board.id}
                      board={{
                        ...board,
                        languages: board.languages as Languages[],
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Sentinel for infinite scroll - triggers when viewport bottom touches this point */}
            <div ref={bottomSentinelRef} className="h-1 shrink-0" />

            {/* Bottom skeleton for loading more */}
            {(isFetchingNextPage || hasNextPage) && <FeedBottomSkeleton />}
          </>
        )}
      </div>
    </div>
  );
}

// Memoizar para evitar re-renders innecesarios
export const DiscoveryBoardView = memo(DiscoveryBoardViewInner);
