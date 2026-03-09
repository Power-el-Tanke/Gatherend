"use client";

import { useVoiceStore } from "@/hooks/use-voice-store";
import { VoiceParticipantsView } from "./voice-participants-view";
import { ChannelType } from "@prisma/client";
import { Button } from "./ui/button";
import { Phone } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useCallback } from "react";

interface ConditionalMediaRoomProps {
  channelId: string;
  channelName: string;
  channelType: ChannelType;
  boardId: string;
}

export function ConditionalMediaRoom({
  channelId,
  channelName,
  channelType,
  boardId,
}: ConditionalMediaRoomProps) {
  const { isConnected, isConnecting, startConnecting } = useVoiceStore();
  const { t } = useTranslation();

  // Handler para unirse a la llamada
  const handleJoinCall = useCallback(() => {
    startConnecting(channelId, channelName, "board", boardId);
  }, [channelId, channelName, boardId, startConnecting]);

  // Solo para canales de voz
  if (channelType !== ChannelType.VOICE) {
    return null;
  }

  // Si está conectado O conectando, mostrar la vista de participantes
  // El LiveKitRoom context viene del VoiceLiveKitProvider en AppShell
  // Necesitamos renderizar esto para que LiveKit pueda establecer la conexión
  if (isConnected || isConnecting) {
    return (
      <div
        id={`voice-media-room-${channelId}`}
        className="flex-1 min-h-0 overflow-hidden"
      >
        <VoiceParticipantsView chatId={channelId} />
      </div>
    );
  }

  // Si no está conectado ni conectando, mostrar botón para unirse
  return (
    <div className="flex flex-col flex-1 justify-center items-center gap-4 bg-linear-to-b from-theme-bg-primary to-theme-bg-secondary">
      <div className="p-4 rounded-full bg-theme-bg-tertiary">
        <Phone className="h-12 w-12 text-theme-accent-primary" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-theme-text-light mb-2">
          {t.voice.noOneHere}
        </h3>
        <p className="text-sm text-theme-text-subtle mb-4">
          {t.voice.beFirstToJoin}
        </p>
      </div>
      <Button
        onClick={handleJoinCall}
        className="bg-theme-button-primary cursor-pointer hover:bg-theme-button-hover text-white"
      >
        <Phone className="w-4 h-4 mr-2" />
        {t.voice.joinCall}
      </Button>
    </div>
  );
}
