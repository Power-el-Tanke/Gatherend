"use client";

import { useState, useMemo, useCallback } from "react";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ChannelType } from "@prisma/client";
import axios from "axios";
import { fractional } from "@/lib/fractional";

// Types
export interface RootChannel {
  id: string;
  name: string;
  type: ChannelType;
  position: number;
  parentId: null;
}

export interface ChildChannel {
  id: string;
  name: string;
  type: ChannelType;
  position: number;
  parentId: string;
}

export interface RootCategory {
  id: string;
  name: string;
  position: number;
  channels: ChildChannel[];
}

export interface ChannelTree {
  rootChannels: RootChannel[];
  rootCategories: RootCategory[];
}

interface UseChannelReorderOptions {
  boardId: string;
  initialTree: ChannelTree;
}

interface UseChannelReorderReturn {
  rootChannels: RootChannel[];
  rootCategories: RootCategory[];
  sortedRootChannels: RootChannel[];
  sortedRootCategories: RootCategory[];
  activeId: string | null;
  setRootChannels: React.Dispatch<React.SetStateAction<RootChannel[]>>;
  setRootCategories: React.Dispatch<React.SetStateAction<RootCategory[]>>;
  onDragStart: (event: DragEndEvent) => void;
  onDragEnd: (event: DragEndEvent) => Promise<void>;
  syncTreeFromQuery: (tree: ChannelTree) => void;
}

/**
 * Hook para manejar toda la lógica de reordenamiento de canales y categorías.
 * Extrae la complejidad del drag & drop del componente principal.
 */
export function useChannelReorder({
  boardId,
  initialTree,
}: UseChannelReorderOptions): UseChannelReorderReturn {
  const [rootChannels, setRootChannels] = useState<RootChannel[]>(
    initialTree.rootChannels
  );
  const [rootCategories, setRootCategories] = useState<RootCategory[]>(
    initialTree.rootCategories
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sincronizar estado local cuando React Query cache cambia
  const syncTreeFromQuery = useCallback((tree: ChannelTree) => {
    setRootChannels(tree.rootChannels);
    setRootCategories(tree.rootCategories);
  }, []);

  // Memoizar sorted arrays
  const sortedRootChannels = useMemo(
    () => [...rootChannels].sort((a, b) => a.position - b.position),
    [rootChannels]
  );

  const sortedRootCategories = useMemo(
    () => [...rootCategories].sort((a, b) => a.position - b.position),
    [rootCategories]
  );

  const onDragStart = useCallback((event: DragEndEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  // Función principal de drag end con todos los casos
  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const draggedId = String(active.id);
      const targetId = String(over.id);

      if (draggedId === targetId) return;

      // Identificaciones
      const activeRootCategory = rootCategories.find((c) => c.id === draggedId);
      const activeRootChannelIndex = rootChannels.findIndex(
        (c) => c.id === draggedId
      );

      const activeChildChannelCat = rootCategories.find((cat) =>
        cat.channels.some((ch) => ch.id === draggedId)
      );
      const activeChildChannelIndex = activeChildChannelCat
        ? activeChildChannelCat.channels.findIndex((ch) => ch.id === draggedId)
        : -1;

      const overRootCategory = rootCategories.find((c) => c.id === targetId);
      const overRootChannelIndex = rootChannels.findIndex(
        (c) => c.id === targetId
      );

      const overChildChannelCat = rootCategories.find((cat) =>
        cat.channels.some((ch) => ch.id === targetId)
      );
      const overChildChannelIndex = overChildChannelCat
        ? overChildChannelCat.channels.findIndex((ch) => ch.id === targetId)
        : -1;

      // Caso 1: ROOT CHANNEL → CHILD CHANNEL
      if (
        activeRootChannelIndex !== -1 &&
        overChildChannelCat &&
        overChildChannelIndex !== -1
      ) {
        const movedChannel = rootChannels[activeRootChannelIndex];
        const newRootChannels = rootChannels.filter((c) => c.id !== draggedId);
        const sortedDest = [...overChildChannelCat.channels].sort(
          (a, b) => a.position - b.position
        );
        const insertionIndex = overChildChannelIndex + 1;
        const newDest = [...sortedDest];
        newDest.splice(insertionIndex, 0, {
          ...movedChannel,
          parentId: overChildChannelCat.id,
        });

        const prev = newDest[insertionIndex - 1]?.position ?? null;
        const next = newDest[insertionIndex + 1]?.position ?? null;
        const newPosition = fractional(prev, next);

        const updatedDest = newDest.map((ch, idx) =>
          idx === insertionIndex ? { ...ch, position: newPosition } : ch
        );

        const updatedCategories = rootCategories.map((cat) =>
          cat.id === overChildChannelCat.id
            ? { ...cat, channels: updatedDest }
            : cat
        );

        setRootChannels(newRootChannels);
        setRootCategories(updatedCategories);

        await axios.post(`/api/boards/${boardId}/reorder`, {
          id: movedChannel.id,
          position: newPosition,
          parentId: overChildChannelCat.id,
          type: "channels",
        });
        return;
      }

      // Caso 2: ROOT CHANNEL → CATEGORÍA (al inicio)
      if (activeRootChannelIndex !== -1 && overRootCategory) {
        const movedChannel = rootChannels[activeRootChannelIndex];
        const newRootChannels = rootChannels.filter((c) => c.id !== draggedId);
        const sortedDest = [...overRootCategory.channels].sort(
          (a, b) => a.position - b.position
        );
        const next = sortedDest[0]?.position ?? null;
        const newPosition = fractional(null, next);

        const newDest = [
          {
            ...movedChannel,
            position: newPosition,
            parentId: overRootCategory.id,
          },
          ...sortedDest,
        ];

        const updatedCategories = rootCategories.map((cat) =>
          cat.id === overRootCategory.id ? { ...cat, channels: newDest } : cat
        );

        setRootChannels(newRootChannels);
        setRootCategories(updatedCategories);

        await axios.post(`/api/boards/${boardId}/reorder`, {
          id: movedChannel.id,
          position: newPosition,
          parentId: overRootCategory.id,
          type: "channels",
        });
        return;
      }

      // Caso 3: CATEGORÍA → CATEGORÍA
      if (activeRootCategory && overRootCategory) {
        const sorted = sortedRootCategories;
        const oldIndex = sorted.findIndex((c) => c.id === draggedId);
        const newIndex = sorted.findIndex((c) => c.id === targetId);

        const moved = arrayMove(sorted, oldIndex, newIndex);
        const prev = moved[newIndex - 1]?.position ?? null;
        const next = moved[newIndex + 1]?.position ?? null;
        const newPosition = fractional(prev, next);

        const updated = moved.map((cat, idx) =>
          idx === newIndex ? { ...cat, position: newPosition } : cat
        );

        setRootCategories(updated);

        await axios.post(`/api/boards/${boardId}/reorder`, {
          id: draggedId,
          position: newPosition,
          parentId: null,
          type: "category",
        });
        return;
      }

      // Caso 4: ROOT CHANNEL → ROOT CHANNEL
      if (activeRootChannelIndex !== -1 && overRootChannelIndex !== -1) {
        const sorted = sortedRootChannels;
        const oldIndex = sorted.findIndex((c) => c.id === draggedId);
        const newIndex = sorted.findIndex((c) => c.id === targetId);

        const moved = arrayMove(sorted, oldIndex, newIndex);
        const prev = moved[newIndex - 1]?.position ?? null;
        const next = moved[newIndex + 1]?.position ?? null;
        const newPosition = fractional(prev, next);

        const updated = moved.map((ch, idx) =>
          idx === newIndex
            ? { ...ch, position: newPosition, parentId: null }
            : ch
        );

        setRootChannels(updated);

        await axios.post(`/api/boards/${boardId}/reorder`, {
          id: draggedId,
          position: newPosition,
          parentId: null,
          type: "channels",
        });
        return;
      }

      // Caso 5: CHILD CHANNEL → CHILD CHANNEL (misma categoría)
      if (
        activeChildChannelIndex !== -1 &&
        overChildChannelCat &&
        activeChildChannelCat?.id === overChildChannelCat.id
      ) {
        const sorted = [...activeChildChannelCat.channels].sort(
          (a, b) => a.position - b.position
        );
        const oldIndex = sorted.findIndex((ch) => ch.id === draggedId);
        const newIndex = sorted.findIndex((ch) => ch.id === targetId);

        const moved = arrayMove(sorted, oldIndex, newIndex);
        const prev = moved[newIndex - 1]?.position ?? null;
        const next = moved[newIndex + 1]?.position ?? null;
        const newPosition = fractional(prev, next);

        const updatedChannels = moved.map((ch, idx) =>
          idx === newIndex ? { ...ch, position: newPosition } : ch
        );

        const updatedCategories = rootCategories.map((cat) =>
          cat.id === activeChildChannelCat.id
            ? { ...cat, channels: updatedChannels }
            : cat
        );

        setRootCategories(updatedCategories);

        await axios.post(`/api/boards/${boardId}/reorder`, {
          id: draggedId,
          position: newPosition,
          parentId: activeChildChannelCat.id,
          type: "channels",
        });
        return;
      }

      // Caso 6: CHILD CHANNEL → ROOT
      if (
        activeChildChannelIndex !== -1 &&
        overRootChannelIndex !== -1 &&
        activeChildChannelCat
      ) {
        const movedChannel =
          activeChildChannelCat.channels[activeChildChannelIndex];
        const newSource = activeChildChannelCat.channels.filter(
          (ch) => ch.id !== draggedId
        );
        const sorted = sortedRootChannels;
        const newIndex = sorted.findIndex((c) => c.id === targetId);

        const moved = [...sorted];
        moved.splice(newIndex, 0, { ...movedChannel, parentId: null });

        const prev = moved[newIndex - 1]?.position ?? null;
        const next = moved[newIndex + 1]?.position ?? null;
        const newPosition = fractional(prev, next);

        const updatedRoot = moved.map((ch, idx) =>
          idx === newIndex
            ? { ...ch, position: newPosition, parentId: null }
            : ch
        );

        const updatedCategories = rootCategories.map((cat) =>
          cat.id === activeChildChannelCat.id
            ? { ...cat, channels: newSource }
            : cat
        );

        setRootChannels(updatedRoot);
        setRootCategories(updatedCategories);

        await axios.post(`/api/boards/${boardId}/reorder`, {
          id: draggedId,
          position: newPosition,
          parentId: null,
          type: "channels",
        });
        return;
      }

      // Caso 7: CHILD CHANNEL → CHILD CHANNEL (otra categoría)
      if (
        activeChildChannelIndex !== -1 &&
        overChildChannelIndex !== -1 &&
        activeChildChannelCat &&
        overChildChannelCat &&
        activeChildChannelCat.id !== overChildChannelCat.id
      ) {
        const movedChannel =
          activeChildChannelCat.channels[activeChildChannelIndex];
        const sortedSource = [...activeChildChannelCat.channels].sort(
          (a, b) => a.position - b.position
        );
        const newSource = sortedSource.filter((c) => c.id !== draggedId);

        const sortedDest = [...overChildChannelCat.channels].sort(
          (a, b) => a.position - b.position
        );
        const newIndex = sortedDest.findIndex((c) => c.id === targetId) + 1;

        const newDest = [...sortedDest];
        newDest.splice(newIndex, 0, {
          ...movedChannel,
          parentId: overChildChannelCat.id,
        });

        const prev = newDest[newIndex - 1]?.position ?? null;
        const next = newDest[newIndex + 1]?.position ?? null;
        const newPosition = fractional(prev, next);

        const updatedDest = newDest.map((ch, idx) =>
          idx === newIndex
            ? { ...ch, position: newPosition, parentId: overChildChannelCat.id }
            : ch
        );

        const updatedCategories = rootCategories.map((cat) => {
          if (cat.id === activeChildChannelCat.id)
            return { ...cat, channels: newSource };
          if (cat.id === overChildChannelCat.id)
            return { ...cat, channels: updatedDest };
          return cat;
        });

        setRootCategories(updatedCategories);

        await axios.post(`/api/boards/${boardId}/reorder`, {
          id: movedChannel.id,
          position: newPosition,
          parentId: overChildChannelCat.id,
          type: "channels",
        });
        return;
      }

      // Caso 8: CHILD CHANNEL → CATEGORÍA (al inicio)
      if (
        activeChildChannelIndex !== -1 &&
        overRootCategory &&
        activeChildChannelCat &&
        activeChildChannelCat.id !== overRootCategory.id
      ) {
        const movedChannel =
          activeChildChannelCat.channels[activeChildChannelIndex];
        const sortedSource = [...activeChildChannelCat.channels].sort(
          (a, b) => a.position - b.position
        );
        const newSource = sortedSource.filter((ch) => ch.id !== draggedId);

        const sortedDest = [...overRootCategory.channels].sort(
          (a, b) => a.position - b.position
        );
        const next = sortedDest[0]?.position ?? null;
        const newPosition = fractional(null, next);

        const newDest = [
          {
            ...movedChannel,
            position: newPosition,
            parentId: overRootCategory.id,
          },
          ...sortedDest,
        ];

        const updatedCategories = rootCategories.map((cat) => {
          if (cat.id === activeChildChannelCat.id)
            return { ...cat, channels: newSource };
          if (cat.id === overRootCategory.id)
            return { ...cat, channels: newDest };
          return cat;
        });

        setRootCategories(updatedCategories);

        await axios.post(`/api/boards/${boardId}/reorder`, {
          id: movedChannel.id,
          position: newPosition,
          parentId: overRootCategory.id,
          type: "channels",
        });
        return;
      }
    },
    [
      rootChannels,
      rootCategories,
      sortedRootChannels,
      sortedRootCategories,
      boardId,
    ]
  );

  return {
    rootChannels,
    rootCategories,
    sortedRootChannels,
    sortedRootCategories,
    activeId,
    setRootChannels,
    setRootCategories,
    onDragStart,
    onDragEnd,
    syncTreeFromQuery,
  };
}
