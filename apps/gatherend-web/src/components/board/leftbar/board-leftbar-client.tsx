"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { LeftbarChannel } from "./leftbar-channel";
import { LeftbarCategory } from "./leftbar-category";
import { SortableItem } from "./leftbar-sortable-item";
import { FEATURES } from "@/lib/features";

import { MemberRole, ChannelType } from "@prisma/client";
import { useBoardData } from "@/hooks/use-board-data";
import { useVoiceParticipantsSocket } from "@/hooks/use-voice-participants-socket";
import {
  useChannelReorder,
  type ChannelTree,
} from "@/hooks/use-channel-reorder";

interface LeftbarClientProps {
  role?: MemberRole;
  boardId: string;
  initialTree: ChannelTree;
}

/**
 * Sidebar izquierdo con canales y categorías.
 * Soporta drag & drop para reordenar.
 */
export const LeftbarClient = ({
  role,
  boardId,
  initialTree,
}: LeftbarClientProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const [openCategory, setOpenCategory] = useState<Record<string, boolean>>({});

  // React Query para datos del board
  const { data: board } = useBoardData(boardId);

  // Escuchar eventos de participantes de voice channels
  useVoiceParticipantsSocket(boardId);

  // Construir tree desde React Query o usar initial
  const tree = useMemo((): ChannelTree => {
    if (!board) return initialTree;

    return {
      rootChannels: board.channels
        .filter((ch) => ch.type !== ChannelType.MAIN)
        .map((ch) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          position: ch.position,
          parentId: null as null,
        })),
      rootCategories: board.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        position: cat.position,
        channels: cat.channels
          .filter((ch) => ch.type !== ChannelType.MAIN)
          .map((ch) => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
            position: ch.position,
            parentId: cat.id,
          })),
      })),
    };
  }, [board, initialTree]);

  // Hook de reordenamiento (extrae toda la lógica de drag & drop)
  const {
    rootChannels,
    rootCategories,
    sortedRootChannels,
    sortedRootCategories,
    activeId,
    onDragStart,
    onDragEnd,
    syncTreeFromQuery,
  } = useChannelReorder({ boardId, initialTree: tree });

  // Evitar hydration error con DndContext
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sincronizar estado local cuando React Query cache cambia
  useEffect(() => {
    syncTreeFromQuery(tree);
  }, [tree, syncTreeFromQuery]);

  // Sensores de DnD
  const pointerSensorOptions = useMemo(
    () => ({
      activationConstraint: { distance: 8 },
    }),
    [],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, pointerSensorOptions)
  );

  // Toggle de categorías
  const toggleOpen = useCallback((id: string) => {
    setOpenCategory((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Render del drag overlay
  const renderDragOverlay = useCallback(
    (id: string) => {
      const rootCh = rootChannels.find((ch) => ch.id === id);
      if (rootCh) {
        return (
          <LeftbarChannel channel={rootCh} boardId={boardId} role={role} />
        );
      }

      const rootCat = rootCategories.find((cat) => cat.id === id);
      if (rootCat) {
        return (
          <div className="px-2 py-1.5 bg-zinc-700/20 rounded-md">
            {rootCat.name}
          </div>
        );
      }

      for (const cat of rootCategories) {
        const ch = cat.channels.find((ch) => ch.id === id);
        if (ch) {
          return <LeftbarChannel channel={ch} boardId={boardId} role={role} />;
        }
      }

      return null;
    },
    [rootChannels, rootCategories, boardId, role]
  );

  // Pre-render sin DnD para evitar hydration error
  if (!isMounted) {
    return (
      <div className="flex flex-col gap-1">
        {sortedRootChannels.map((ch) => (
          <div key={ch.id}>
            <LeftbarChannel channel={ch} boardId={boardId} role={role} />
          </div>
        ))}
        {FEATURES.CATEGORIES_ENABLED &&
          sortedRootCategories.map((cat) => (
            <div key={cat.id} className="w-full">
              <LeftbarCategory
                category={cat}
                boardId={boardId}
                role={role}
                isOpen={!!openCategory[cat.id]}
                toggleOpen={() => toggleOpen(cat.id)}
              />
            </div>
          ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Root Channels */}
      <SortableContext
        items={sortedRootChannels.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-1">
          {sortedRootChannels.map((ch) => (
            <div key={ch.id}>
              <SortableItem id={ch.id}>
                <LeftbarChannel channel={ch} boardId={boardId} role={role} />
              </SortableItem>
            </div>
          ))}
        </div>
      </SortableContext>

      {/* Root Categories - Controlled by feature flag */}
      {FEATURES.CATEGORIES_ENABLED && (
        <div className="mt-1">
          <SortableContext
            items={sortedRootCategories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedRootCategories.map((cat) => (
              <div key={cat.id} className="w-full">
                <SortableItem id={cat.id}>
                  <LeftbarCategory
                    category={cat}
                    boardId={boardId}
                    role={role}
                    isOpen={!!openCategory[cat.id]}
                    toggleOpen={() => toggleOpen(cat.id)}
                  />
                </SortableItem>
              </div>
            ))}
          </SortableContext>
        </div>
      )}

      {/* Drag Overlay */}
      <DragOverlay>{activeId ? renderDragOverlay(activeId) : null}</DragOverlay>
    </DndContext>
  );
};
