"use client";

import { useEffect, useCallback, useRef } from "react";

interface UseInfiniteScrollOptions {
  /** Callback cuando se debe cargar más contenido */
  onLoadMore: () => void;
  /** Si hay más páginas disponibles */
  hasNextPage: boolean;
  /** Si está cargando actualmente */
  isLoading: boolean;
  /** Distancia en píxeles desde el fondo para disparar la carga (default: 200) */
  threshold?: number;
  /** Si el scroll está habilitado */
  enabled?: boolean;
}

interface UseInfiniteScrollResult {
  /** Ref para el contenedor scrolleable */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook reutilizable para infinite scroll.
 *
 * Consolida la lógica de scroll listener que estaba duplicada
 * entre el feed virtualizado y la búsqueda en DiscoveryCommunityView.
 *
 * @example
 * ```tsx
 * const { scrollContainerRef } = useInfiniteScroll({
 *   onLoadMore: loadMoreSearch,
 *   hasNextPage: searchHasNextPage,
 *   isLoading: isSearchLoading,
 *   enabled: isSearching,
 * });
 *
 * return <div ref={scrollContainerRef}>...</div>;
 * ```
 */
export function useInfiniteScroll({
  onLoadMore,
  hasNextPage,
  isLoading,
  threshold = 200,
  enabled = true,
}: UseInfiniteScrollOptions): UseInfiniteScrollResult {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasNextPage || isLoading) return;

    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;

    // Trigger cuando falten `threshold` píxeles para llegar al fondo
    if (scrollHeight - scrollTop - clientHeight < threshold) {
      onLoadMore();
    }
  }, [hasNextPage, isLoading, onLoadMore, threshold]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!enabled || !container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [enabled, handleScroll]);

  return { scrollContainerRef };
}
