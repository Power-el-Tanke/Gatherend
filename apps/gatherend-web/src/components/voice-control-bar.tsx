"use client";

import { useVoiceStore } from "@/hooks/use-voice-store";
import { cn } from "@/lib/utils";
import {
  Camera,
  CameraOff,
  Headphones,
  HeadphoneOff,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Volume2,
  X,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { useVoiceParticipantsStore } from "@/hooks/use-voice-participants-store";
import { useShallow } from "zustand/react/shallow";
import {
  useConnectionQualityIndicator,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import { Track, ConnectionQuality } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// Constants

const MAX_VIDEO_PRESENTERS = 2;

// Connection Quality Indicator Component

function ConnectionQualityDot() {
  // Get local participant first - may be undefined if not connected yet
  const { localParticipant } = useLocalParticipant();

  // Only use quality indicator if we have a participant
  const { quality } = useConnectionQualityIndicator({
    participant: localParticipant,
  });

  // Map quality to color and label
  const getQualityInfo = (quality: ConnectionQuality | undefined) => {
    if (quality === undefined || !localParticipant) {
      return { color: "bg-gray-400", label: "Connecting" };
    }
    switch (quality) {
      case ConnectionQuality.Excellent:
        return { color: "bg-green-500", label: "Excellent" };
      case ConnectionQuality.Good:
        return { color: "bg-green-500", label: "Good" };
      case ConnectionQuality.Poor:
        return { color: "bg-yellow-500", label: "Poor" };
      case ConnectionQuality.Lost:
        return { color: "bg-red-500", label: "Lost" };
      default:
        return { color: "bg-gray-400", label: "Connecting" };
    }
  };

  const { color, label } = getQualityInfo(quality);

  // Only animate if connection is good/excellent
  const shouldAnimate =
    quality === ConnectionQuality.Excellent ||
    quality === ConnectionQuality.Good;

  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full transition-colors duration-300",
        color,
        shouldAnimate && "animate-pulse",
      )}
      title={`Connection: ${label}`}
    />
  );
}

// Control Button Component (for non-LiveKit buttons)

interface ControlButtonProps {
  onClick?: () => void;
  isActive?: boolean;
  isDestructive?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  title: string;
}

function ControlButton({
  onClick,
  isActive = true,
  isDestructive = false,
  disabled = false,
  icon,
  activeIcon,
  title,
}: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center",
        "w-8 h-8 flex-shrink-0",
        disabled
          ? "bg-theme-bg-tertiary text-theme-text-muted cursor-not-allowed opacity-50"
          : isDestructive
            ? "bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300"
            : isActive
              ? "bg-theme-bg-tertiary hover:bg-theme-bg-quaternary text-theme-text-light"
              : "bg-red-500/20 text-red-400 hover:bg-red-500/30",
      )}
      title={title}
    >
      {isActive ? (activeIcon ?? icon) : icon}
    </button>
  );
}

// Main Voice Control Bar Component

interface VoiceControlBarProps {
  position?: "left" | "right";
}

export function VoiceControlBar({ position = "left" }: VoiceControlBarProps) {
  const {
    channelId,
    channelName,
    context,
    isConnecting,
    isConnected,
    isReconnecting,
    isDeafened,
    toggleDeafen,
    leaveVoice,
  } = useVoiceStore();
  const { t } = useTranslation();
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();

  // Track if we need to restore mic state after un-deafening
  const micWasEnabledRef = useRef(true);

  // State for showing the limit warning
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTogglingScreenShare, setIsTogglingScreenShare] = useState(false);
  const [isTogglingMic, setIsTogglingMic] = useState(false);
  const [isTogglingCamera, setIsTogglingCamera] = useState(false);

  // Cleanup warning timeout on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);

  // Get all video and screen share tracks in the room
  const videoTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  // Calculate number of presenters (video or screen share)
  const presenterCount = useMemo(() => {
    // Get unique participant IDs that have video or screen share enabled
    const presenters = new Set<string>();

    videoTracks.forEach((track) => {
      if (track.publication?.track) {
        presenters.add(track.participant.identity);
      }
    });

    screenShareTracks.forEach((track) => {
      if (track.publication?.track) {
        presenters.add(track.participant.identity);
      }
    });

    return presenters.size;
  }, [videoTracks, screenShareTracks]);

  // Check if current user is already presenting
  const isCurrentUserPresenting = useMemo(() => {
    return isCameraEnabled || isScreenShareEnabled;
  }, [isCameraEnabled, isScreenShareEnabled]);

  // Check if we can enable video/screen share
  // Allow if: less than 2 presenters OR current user is already presenting
  const canEnableVideo =
    presenterCount < MAX_VIDEO_PRESENTERS || isCurrentUserPresenting;

  // Obtener participantes del canal actual
  const participants = useVoiceParticipantsStore(
    useShallow((state) =>
      channelId ? (state.participants[channelId] ?? []) : [],
    ),
  );

  // When deafening, also mute the microphone
  // When un-deafening, restore previous mic state
  useEffect(() => {
    // IMPORTANT: Only run when actually connected to voice
    // localParticipant exists even when not connected (from LiveKitRoom context)
    if (!localParticipant || !isConnected) return;

    if (isDeafened) {
      // Save current mic state before muting
      micWasEnabledRef.current = localParticipant.isMicrophoneEnabled;
      // Mute mic when deafened
      if (localParticipant.isMicrophoneEnabled) {
        localParticipant.setMicrophoneEnabled(false);
      }
    } else {
      // Restore mic state when un-deafening (only if it was enabled before)
      if (micWasEnabledRef.current && !localParticipant.isMicrophoneEnabled) {
        localParticipant.setMicrophoneEnabled(true);
      }
    }
  }, [isDeafened, localParticipant, isConnected]);

  // Handle deafen toggle
  const handleDeafen = useCallback(() => {
    toggleDeafen();
  }, [toggleDeafen]);

  // Handle clicking on disabled video/screen share button
  const handleDisabledMediaClick = useCallback(() => {
    // Clear existing timeout if any
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    setShowLimitWarning(true);
    // Auto-hide after 5 seconds
    warningTimeoutRef.current = setTimeout(() => {
      setShowLimitWarning(false);
      warningTimeoutRef.current = null;
    }, 5000);
  }, []);

  const handleToggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;

    // Respect presenter limit (but allow stopping if already sharing)
    if (!canEnableVideo && !isScreenShareEnabled) {
      handleDisabledMediaClick();
      return;
    }

    if (isTogglingScreenShare) return;
    setIsTogglingScreenShare(true);

    try {
      if (isScreenShareEnabled) {
        // IMPORTANT: `VoiceLiveKitProvider` sets `stopLocalTrackOnUnpublish: false`.
        // LiveKit will unpublish the tracks in-app, but Chromium will keep showing the
        // "sharing your screen" UI until the underlying `getDisplayMedia` tracks are stopped.
        //
        // Force-stop by unpublishing with `stopOnUnpublish: true`.
        const screenPub = localParticipant.getTrackPublication(
          Track.Source.ScreenShare,
        );
        const screenAudioPub = localParticipant.getTrackPublication(
          Track.Source.ScreenShareAudio,
        );

        if (screenPub?.track) {
          await localParticipant.unpublishTrack(screenPub.track, true);
        }
        if (screenAudioPub?.track) {
          await localParticipant.unpublishTrack(screenAudioPub.track, true);
        }
      } else {
        // Enable tab/system audio capture when supported by the browser.
        // LiveKit will still start screenshare even if audio capture isn't available.
        await localParticipant.setScreenShareEnabled(true, { audio: true });
      }
    } catch (error) {
      // Common case: user cancels the browser picker (AbortError/NotAllowedError).
      if (
        error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "NotAllowedError")
      ) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unknown screenshare error";
      toast.error(`Screen share failed: ${message}`);
    } finally {
      setIsTogglingScreenShare(false);
    }
  }, [
    localParticipant,
    canEnableVideo,
    handleDisabledMediaClick,
    isScreenShareEnabled,
    isTogglingScreenShare,
  ]);

  const handleToggleMic = useCallback(async () => {
    if (!localParticipant) return;
    if (isTogglingMic) return;

    setIsTogglingMic(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown microphone error";
      toast.error(`Microphone toggle failed: ${message}`);
    } finally {
      setIsTogglingMic(false);
    }
  }, [localParticipant, isMicrophoneEnabled, isTogglingMic]);

  const handleToggleCamera = useCallback(async () => {
    if (!localParticipant) return;

    // Respect presenter limit (but allow stopping if already enabled)
    if (!canEnableVideo && !isCameraEnabled) {
      handleDisabledMediaClick();
      return;
    }

    if (isTogglingCamera) return;

    setIsTogglingCamera(true);
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown camera error";
      toast.error(`Camera toggle failed: ${message}`);
    } finally {
      setIsTogglingCamera(false);
    }
  }, [
    localParticipant,
    canEnableVideo,
    handleDisabledMediaClick,
    isCameraEnabled,
    isTogglingCamera,
  ]);

  const isOptimisticConnecting = isConnecting && !isConnected;

  // Don't render if not connected/connecting or no channel
  if ((!isConnected && !isConnecting) || !channelId) {
    return null;
  }

  // Only show in the correct sidebar based on context
  // Left sidebar = board calls, Right sidebar = conversation calls
  const shouldShow =
    (position === "left" && context === "board") ||
    (position === "right" && context === "conversation");

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-theme-bg-primary border-t border-theme-border-primary",
        // En rightbar, empujar al fondo del contenedor flex
        position === "right" && "mt-auto",
      )}
    >
      {/* Reconnecting banner */}
      {isReconnecting && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 border-b border-blue-500/30">
          <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
          <span className="text-xs text-blue-400 flex-1">
            {t.voice.reconnecting}
          </span>
        </div>
      )}

      {/* Limit warning banner */}
      {showLimitWarning && !isReconnecting && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border-b border-amber-500/30">
          <span className="text-xs text-amber-400 flex-1">
            {t.voice.maxPresentersReached}
          </span>
          <button
            onClick={() => setShowLimitWarning(false)}
            className="p-0.5 hover:bg-amber-500/20 rounded"
          >
            <X className="w-3 h-3 text-amber-400" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1 px-3 pt-2 pb-1.5">
        {/* Channel info */}
        {isOptimisticConnecting ? (
          <div className="flex items-center gap-2 px-1">
            <Loader2 className="w-3.5 h-3.5 text-theme-accent-primary animate-spin" />
            <span className="text-xs font-medium text-theme-text-secondary truncate flex-1">
              {t.voice.connecting}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <ConnectionQualityDot />
            <Volume2 className="w-3.5 h-3.5 text-theme-text-secondary" />
            <span className="text-xs font-medium text-theme-text-secondary truncate flex-1">
              {channelName || "Voice Channel"}
            </span>
            <span className="text-xs text-theme-text-muted">
              {participants.length}
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2.5">
          {/* Microphone - Disabled when deafened */}
          {isDeafened ? (
            // When deafened, show disabled mic button
            <button
              disabled
              className={cn(
                "p-2 rounded-lg transition-all duration-200 flex items-center justify-center",
                "w-8 h-8 flex-shrink-0",
                "bg-red-500/20 text-red-400 cursor-not-allowed opacity-50",
              )}
              title={`${t.voice.mute} (${t.voice.deafen})`}
            >
              <MicOff className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleToggleMic}
              disabled={isOptimisticConnecting || isTogglingMic}
              data-lk-enabled={isMicrophoneEnabled ? "true" : "false"}
              aria-pressed={!!isMicrophoneEnabled}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center",
                "w-8 h-8 flex-shrink-0",
                "bg-theme-bg-tertiary hover:bg-theme-bg-quaternary text-theme-text-light",
                "data-[lk-enabled=false]:bg-red-500/20 data-[lk-enabled=false]:text-red-400",
                isTogglingMic && "opacity-70 cursor-wait",
                isOptimisticConnecting && "cursor-not-allowed opacity-50",
              )}
              title={isMicrophoneEnabled ? t.voice.mute : t.voice.unmute}
            >
              {isTogglingMic ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isMicrophoneEnabled ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Deafen */}
          <ControlButton
            onClick={handleDeafen}
            disabled={isOptimisticConnecting}
            isActive={!isDeafened}
            icon={<HeadphoneOff className="w-4 h-4" />}
            activeIcon={<Headphones className="w-4 h-4" />}
            title={isDeafened ? t.voice.undeafen : t.voice.deafen}
          />

          {/* Camera - Custom button with presenter limit */}
          <button
            onClick={
              canEnableVideo || isCameraEnabled
                ? handleToggleCamera
                : handleDisabledMediaClick
            }
            disabled={isOptimisticConnecting || isTogglingCamera}
            data-lk-enabled={isCameraEnabled ? "true" : "false"}
            aria-pressed={!!isCameraEnabled}
            className={cn(
              "p-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center",
              "w-8 h-8 flex-shrink-0",
              canEnableVideo || isCameraEnabled
                ? "bg-theme-bg-tertiary hover:bg-theme-bg-quaternary text-theme-text-light"
                : "bg-zinc-600/30 text-zinc-500 cursor-not-allowed",
              "data-[lk-enabled=true]:bg-theme-button-primary data-[lk-enabled=true]:text-white",
              isTogglingCamera && "opacity-70 cursor-wait",
              isOptimisticConnecting && "cursor-not-allowed opacity-50",
            )}
            title={
              !canEnableVideo && !isCameraEnabled
                ? t.voice.maxPresentersReached
                : isCameraEnabled
                  ? t.voice.stopCamera
                  : t.voice.camera
            }
          >
            {isTogglingCamera ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isCameraEnabled ? (
              <Camera className="w-4 h-4" />
            ) : (
              <CameraOff className="w-4 h-4" />
            )}
          </button>

          {/* Screen Share - Custom button with presenter limit */}
          <button
            onClick={handleToggleScreenShare}
            disabled={isOptimisticConnecting || isTogglingScreenShare}
            data-lk-enabled={isScreenShareEnabled ? "true" : "false"}
            aria-pressed={!!isScreenShareEnabled}
            className={cn(
              "p-2 rounded-lg cursor-pointer transition-all duration-200 flex items-center justify-center",
              "w-8 h-8 flex-shrink-0",
              canEnableVideo || isScreenShareEnabled
                ? "bg-theme-bg-tertiary hover:bg-theme-bg-quaternary text-theme-text-light"
                : "bg-zinc-600/30 text-zinc-500 cursor-not-allowed",
              "data-[lk-enabled=true]:bg-theme-button-primary data-[lk-enabled=true]:text-white",
              isTogglingScreenShare && "opacity-70 cursor-wait",
              isOptimisticConnecting && "cursor-not-allowed opacity-50",
            )}
            title={
              !canEnableVideo && !isScreenShareEnabled
                ? t.voice.maxPresentersReached
                : isScreenShareEnabled
                  ? t.voice.stopScreenShare
                  : t.voice.screenShare
            }
          >
            {isTogglingScreenShare ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MonitorUp className="w-4 h-4" />
            )}
          </button>

          {/* Leave */}
          <div className="ml-auto">
            <ControlButton
              onClick={leaveVoice}
              isDestructive
              icon={<PhoneOff className="w-4 h-4" />}
              title={
                isOptimisticConnecting
                  ? t.voice.cancelConnection
                  : t.voice.leaveCall
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Exported variants for easier usage

export function VoiceControlBarLeft() {
  return <VoiceControlBar position="left" />;
}

export function VoiceControlBarRight() {
  return <VoiceControlBar position="right" />;
}
