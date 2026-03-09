"use client";

import { useSocketConnection } from "@/components/providers/socket-provider";
import { Badge } from "./ui/badge";
import { useTranslation } from "@/i18n";

export const SocketIndicator = () => {
  const isConnected = useSocketConnection();
  const { t } = useTranslation();

  if (!isConnected) {
    return (
      <Badge variant="outline" className="bg-yellow-600 text-white border-name">
        {t.socketIndicator.fallbackPolling}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-emerald-600 text-white border-name">
      {t.socketIndicator.liveUpdates}
    </Badge>
  );
};

