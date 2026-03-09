"use client";

import { memo, Suspense, useCallback, useMemo } from "react";
import { useBoardSwitchRouting } from "@/contexts/board-switch-context";
import { ChannelView } from "./views/channel-view";
import { ConversationView } from "./views/conversation-view";
import { BoardView } from "./views/board-view";
import { DiscoveryCommunityView } from "./views/discovery-community-view";
import { DiscoveryBoardView } from "./views/discovery-board-view";
import { useCommunityBoardsFeed } from "@/hooks/discovery/boards-feed/use-community-boards-feed";
import { useNewBoardsIndicator } from "@/hooks/discovery/use-new-boards-indicator";
import { ErrorBoundary } from "@/components/error-boundary";
import { ViewLoadingFallback, ViewErrorFallback } from "./views/view-fallbacks";
// Instancia estable de loading fallback — evita recrear JSX en cada render
const LOADING_FALLBACK = <ViewLoadingFallback />;

// Render prop estable para error fallback
const ERROR_FALLBACK_RENDER = ({ reset }: { reset: () => void }) => (
  <ViewErrorFallback onRetry={reset} />
);

/**
 * CenterContentRouter - Enrutador de vistas del centro
 *
 * Este componente decide qué vista mostrar en el área central
 * basándose en el estado del BoardSwitchContext, NO en los params de la URL.
 *
 * OPTIMIZACIÓN: Usa useBoardSwitchRouting() en lugar de useBoardSwitch()
 * para evitar re-renders cuando cambian propiedades que no afectan el routing.
 *
 * Vistas posibles:
 * - DiscoveryBoardView: cuando hay un currentCommunityId (boards de una comunidad)
 * - DiscoveryCommunityView: cuando isDiscovery es true (lista de comunidades)
 * - ConversationView: cuando hay un currentConversationId
 * - ChannelView: cuando hay un currentChannelId
 * - BoardView: fallback (redirige al primer canal)
 */
function CenterContentRouterInner() {
  // Hook selectivo - solo se suscribe a valores de routing
  const {
    currentBoardId,
    currentChannelId,
    currentConversationId,
    currentCommunityId,
    isDiscovery,
  } = useBoardSwitchRouting();

  // Memoizar la vista para evitar recrear JSX innecesariamente
  const currentView = useMemo(() => {
    // Prioridad de renderizado:
    // 1. Discovery con communityId (boards de una comunidad)
    if (isDiscovery && currentCommunityId) {
      return (
        <CommunityBoardsView
          key={`community-${currentCommunityId}`}
          communityId={currentCommunityId}
        />
      );
    }

    // 2. Discovery sin communityId (lista de comunidades)
    if (isDiscovery) {
      return <DiscoveryCommunityView key={`discovery-${currentBoardId}`} />;
    }

    // 3. Conversación (si hay currentConversationId)
    if (currentConversationId) {
      return (
        <ConversationView
          key={`conversation-${currentConversationId}`}
          conversationId={currentConversationId}
          boardId={currentBoardId}
        />
      );
    }

    // 4. Canal (si hay currentChannelId)
    if (currentChannelId) {
      return (
        <ChannelView
          key={`channel-${currentChannelId}`}
          channelId={currentChannelId}
          boardId={currentBoardId}
        />
      );
    }

    // 5. BoardView (fallback - redirige al primer canal)
    return <BoardView key={`board-${currentBoardId}`} />;
  }, [
    currentBoardId,
    currentChannelId,
    currentConversationId,
    currentCommunityId,
    isDiscovery,
  ]);

  const routeKey = useMemo(
    () =>
      `${currentBoardId}:${currentChannelId ?? "none"}:${
        currentConversationId ?? "none"
      }:${currentCommunityId ?? "none"}:${isDiscovery ? "1" : "0"}`,
    [
      currentBoardId,
      currentChannelId,
      currentConversationId,
      currentCommunityId,
      isDiscovery,
    ],
  );

  return (
    <ErrorBoundary key={routeKey} fallback={ERROR_FALLBACK_RENDER}>
      <Suspense fallback={LOADING_FALLBACK}>{currentView}</Suspense>
    </ErrorBoundary>
  );
}

// Memoizar para evitar re-renders innecesarios del padre
export const CenterContentRouter = memo(CenterContentRouterInner);

/**
 * Componente wrapper que carga los boards de una comunidad y los pasa a DiscoveryBoardView
 *
 * OPTIMIZACIÓN: Memoizado para evitar re-renders cuando el router cambia
 * pero el communityId sigue siendo el mismo.
 */
const CommunityBoardsView = memo(function CommunityBoardsView({
  communityId,
}: {
  communityId: string;
}) {
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
});
