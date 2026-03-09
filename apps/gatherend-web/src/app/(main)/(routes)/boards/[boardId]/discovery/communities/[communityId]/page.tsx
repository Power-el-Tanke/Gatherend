"use client";

import { useParams } from "next/navigation";
import { useCallback } from "react";
import { useCommunityBoardsFeed } from "@/hooks/discovery/boards-feed/use-community-boards-feed";
import { useNewBoardsIndicator } from "@/hooks/discovery/use-new-boards-indicator";
import { DiscoveryBoardView } from "@/components/app-shell/views/discovery-board-view";

export default function CommunityBoardsPage() {
  const params = useParams();
  const communityId = params?.communityId as string;

  const {
    community,
    pageSlots,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    refresh,
    containerRef,
    bottomSentinelRef,
    measurePage,
  } = useCommunityBoardsFeed(communityId);

  // Hook para indicador de nuevos boards via WebSocket
  const { hasNewBoards, clearIndicator } = useNewBoardsIndicator(communityId);

  // Wrap refresh para limpiar el indicador al refrescar
  const handleRefresh = useCallback(async () => {
    clearIndicator();
    return refresh();
  }, [clearIndicator, refresh]);

  return (
    <DiscoveryBoardView
      community={community}
      pageSlots={pageSlots}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      error={error}
      emptyText="No hay boards en esta comunidad."
      onRefresh={handleRefresh}
      hasNewBoards={hasNewBoards}
      containerRef={containerRef}
      bottomSentinelRef={bottomSentinelRef}
      measurePage={measurePage}
    />
  );
}
