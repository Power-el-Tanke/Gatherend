"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  disableDrag?: boolean;
}

export const SortableItem = ({
  id,
  children,
  disableDrag = false,
}: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, isDragging, isOver } = useSortable(
    {
      id,
      disabled: disableDrag,
    },
  );

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.5 : 1,

    // Estos estilos hacen visible el hover cuando arrastras encima
    borderBottom: isOver ? "2px solid rgba(99,102,241,0.6)" : "transparent",
    background: isOver ? "rgba(99,102,241,0.05)" : "transparent",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!disableDrag ? attributes : {})}
      {...(!disableDrag ? listeners : {})}
    >
      {children}
    </div>
  );
};
