"use client";

import { cn } from "@/lib/utils";
import { memo, useMemo, useState } from "react";
import { getButtonColors } from "@/lib/color-extraction";
import { Siren } from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useTranslation } from "@/i18n";
import { useColorExtraction } from "@/hooks/use-color-extraction";
import { getNeverAnimatedImageUrl } from "@/lib/media-static";

export interface CommunityCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  memberCount: number;
  boardCount: number;
  onExplore: () => void;
  className?: string;
}

function CommunityCardInner({
  id,
  name,
  imageUrl,
  memberCount,
  boardCount,
  onExplore,
  className,
}: CommunityCardProps) {
  const { onOpen } = useModal();
  const { data: currentProfile } = useCurrentProfile();
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const displayImageUrl = useMemo(() => {
    if (!imageUrl) return null;
    return getNeverAnimatedImageUrl(imageUrl, { w: 1024, h: 512, q: 82 });
  }, [imageUrl]);

  // Use Web Worker for color extraction (eliminates main thread blocking)
  const { dominantColor, handleImageLoad } = useColorExtraction({
    imageUrl: displayImageUrl || imageUrl,
  });

  const buttonColors = dominantColor
    ? getButtonColors(dominantColor)
    : {
        buttonBg: "var(--theme-button-primary)",
        buttonHoverBg: "var(--theme-button-hover)",
        buttonText: "#ffffff",
      };

  return (
    <div
      data-community-id={id}
      className={cn(
        "w-full rounded-xl overflow-hidden shadow-md flex flex-col transition-colors duration-300 group",
        className,
      )}
      style={{
        backgroundColor: dominantColor || "var(--theme-bg-secondary)",
      }}
    >
      {/* Imagen arriba */}
      <div className="relative w-full h-30 bg-theme-bg-tertiary overflow-hidden">
        {imageUrl && displayImageUrl && !imageFailed ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImageUrl}
              alt={name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-101"
              loading="eager"
              decoding="async"
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
              onError={() => setImageFailed(true)}
            />
            {/* FADE OVERLAY */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-theme-text-muted bg-theme-bg-tertiary">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* REPORT BUTTON - esquina superior derecha */}
        <div className="absolute top-2 right-2 z-10">
          <ActionTooltip label={t.discovery.reportCommunity} side="left">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen("reportCommunity", {
                  reportCommunityId: id,
                  reportCommunityName: name,
                  reportCommunityImageUrl: imageUrl,
                  profileId: currentProfile?.id,
                });
              }}
              className="p-1.5 rounded-md bg-black/50 hover:bg-red-500/30 transition-colors cursor-pointer"
            >
              <Siren className="w-4 h-4 text-red-400" />
            </button>
          </ActionTooltip>
        </div>
      </div>
      {/* Inferior: título y botón */}
      <div className="flex flex-row items-center justify-between px-6 py-2.5 flex-1">
        <div className="flex flex-col gap-1">
          <div className="text-[22px] font-bold text-white truncate max-w-[320px]">
            {name}
          </div>
          <div className="text-[14px] text-white/70 font-medium">
            {memberCount} miembro{memberCount === 1 ? "" : "s"} — {boardCount}{" "}
            board{boardCount === 1 ? "" : "s"} abierto
            {boardCount === 1 ? "" : "s"}
          </div>
        </div>
        <button
          onClick={onExplore}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="ml-4 px-4 py-2 cursor-pointer rounded-md text-sm font-semibold transition-colors duration-200"
          style={{
            backgroundColor: isHovered
              ? buttonColors.buttonHoverBg
              : buttonColors.buttonBg,
            color: buttonColors.buttonText,
          }}
        >
          Explorar
        </button>
      </div>
    </div>
  );
}

// Memoizado para que inline arrows en onExplore no causen re-renders
// si las demás props son iguales (name, id, etc.)
export const CommunityCard = memo(CommunityCardInner);
