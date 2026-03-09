"use client";

import { memo, useCallback } from "react";
import { Plus } from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { useTranslation } from "@/i18n";

/**
 * NavigationAction - Botón para crear/unirse a un board
 *
 * OPTIMIZACIÓN: Memoizado + selector de Zustand para evitar re-renders
 * innecesarios cuando cambia el estado global del modal o la navegación.
 */
export const NavigationAction = memo(function NavigationAction() {
  // Selector de Zustand — solo se suscribe a onOpen, no al estado completo
  const onOpen = useModal(useCallback((state) => state.onOpen, []));
  const { t } = useTranslation();

  // Callback estable — evita recrear la función en cada render
  const handleClick = useCallback(() => {
    onOpen("createBoard");
  }, [onOpen]);

  return (
    <ActionTooltip side="right" align="center" label={t.navigation.createBoard}>
      <button
        onClick={handleClick}
        className="group flex items-center mx-3 h-[48px] w-[48px] rounded-[24px]
      transition-all overflow-hidden justify-center bg-theme-nav-action-bg
      hover:rounded-[16px] hover:bg-theme-nav-action-hover cursor-pointer"
      >
        <Plus
          className="transition text-theme-text-subtle group-hover:text-theme-text-secondary"
          size={25}
        />
      </button>
    </ActionTooltip>
  );
});
