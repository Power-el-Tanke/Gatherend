"use client";

import { memo } from "react";
import { SKELETON_HEIGHT } from "@/hooks/chat";

interface ChatSkeletonProps {
  visible: boolean;
  heightPx?: number;
  origin?: "top" | "bottom";
}

function ChatSkeletonComponent({ visible, heightPx, origin }: ChatSkeletonProps) {
  const height = heightPx ?? SKELETON_HEIGHT;
  const estimatedRowPx = 56; // avatar+text blocks + vertical gap
  const rowCount = Math.max(8, Math.min(80, Math.ceil(height / estimatedRowPx)));
  return (
    <div
      data-chat-skeleton={origin}
      className="transition-[height] duration-0"
      style={{
        height: visible ? height : 0,
        overflow: "hidden",
        minHeight: visible ? height : 0,
        overflowAnchor: "none", // Never use skeleton as scroll anchor
      }}
    >
      <div className="flex flex-col gap-4 px-4 py-4">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-theme-bg-secondary shrink-0" />
            <div className="flex-1 space-y-2">
              <div
                className="h-4 bg-theme-bg-secondary rounded"
                style={{ width: `${20 + (i % 4) * 15}%` }}
              />
              <div
                className="h-3 bg-theme-bg-secondary rounded"
                style={{ width: `${50 + (i % 3) * 15}%` }}
              />
              {i % 2 === 0 && (
                <div
                  className="h-3 bg-theme-bg-secondary rounded"
                  style={{ width: `${30 + (i % 5) * 10}%` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ChatSkeleton = memo(ChatSkeletonComponent);
