"use client";

import { Globe, Mail, User } from "lucide-react"; // User = fallback
import { SlotMode } from "@prisma/client";

interface SlotAvatarProps {
  x: number;
  y: number;
  size: string;
  mode: SlotMode;
}

export const SlotAvatar = ({ x, y, size, mode }: SlotAvatarProps) => {
  let Icon;
  let iconVar: string;
  let bgVar: string;

  switch (mode) {
    case "BY_DISCOVERY":
      Icon = Globe;
      iconVar = "var(--theme-slot-discovery-icon)";
      bgVar = "var(--theme-slot-discovery-bg)";
      break;
    case "BY_INVITATION":
      Icon = Mail;
      iconVar = "var(--theme-slot-invitation-icon)";
      bgVar = "var(--theme-slot-invitation-bg)";
      break;
    default:
      Icon = User;
      iconVar = "var(--theme-text-tertiary)";
      bgVar = "var(--theme-bg-tertiary)";
      break;
  }

  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="transition-transform duration-200 hover:scale-110">
        <div
          className={`rounded-full border flex items-center justify-center ${size}`}
          style={{
            backgroundColor: bgVar,
            borderColor: "var(--theme-slot-border)",
          }}
        >
          <Icon
            className="w-4 h-4"
            strokeWidth={1.5}
            style={{ color: iconVar }}
          />
        </div>
      </div>
    </div>
  );
};
