"use client";

import { memo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActionTooltipProps {
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

/**
 * ActionTooltip - Tooltip optimizado
 *
 * OPTIMIZACIÓN: Ya no crea su propio TooltipProvider.
 * Usa el TooltipProvider global definido en el root layout.
 * Esto evita crear N contextos React cuando hay N tooltips.
 *
 * OPTIMIZACIÓN 2: Memoizado para evitar re-renders cuando las props no cambian.
 * Esto es especialmente importante cuando se usa dentro de listas (NavigationItem).
 */
export const ActionTooltip = memo(function ActionTooltip({
  label,
  children,
  side,
  align,
}: ActionTooltipProps) {
  return (
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        <p className="font-semibold text-sm">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
});
