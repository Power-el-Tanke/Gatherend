"use client";

import { create } from "zustand";

type VoiceContext = "board" | "conversation";

interface VoiceState {
  // Channel info
  channelId: string | null;
  channelName: string | null;
  context: VoiceContext | null;
  boardId: string | null; // Board ID for optimization (avoids DB query in backend)
  connectionAttemptId: number; // Incremented per startConnecting (used to guard timeouts)

  // Connection states (server-as-truth)
  isConnecting: boolean; // Intent: user clicked to connect, waiting for LiveKit
  isConnected: boolean; // Confirmed: LiveKit connection established
  isReconnecting: boolean; // Auto-reconnect in progress

  // Audio states
  isDeafened: boolean; // User has muted incoming audio

  // Actions
  /**
   * Start connecting to a voice channel
   * Sets isConnecting = true, waits for LiveKit to confirm
   * @param boardId - Optional boardId for board channels (optimization)
   */
  startConnecting: (
    channelId: string,
    channelName: string,
    context: VoiceContext,
    boardId?: string,
  ) => void;

  /**
   * LiveKit confirmed connection - set isConnected = true
   */
  confirmConnected: () => void;

  /**
   * Connection failed or was cancelled
   */
  connectionFailed: () => void;

  /**
   * Leave voice channel - resets all state
   */
  leaveVoice: () => void;

  /**
   * Toggle deafen state (mute incoming audio)
   */
  toggleDeafen: () => void;

  /**
   * Set deafen state explicitly
   */
  setDeafened: (deafened: boolean) => void;

  /**
   * Set reconnecting state
   */
  setReconnecting: (reconnecting: boolean) => void;

  // Legacy - keep for compatibility but mark as internal
  setConnected: (connected: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  channelId: null,
  channelName: null,
  context: null,
  boardId: null,
  connectionAttemptId: 0,
  isConnecting: false,
  isConnected: false,
  isReconnecting: false,
  isDeafened: false,

  startConnecting: (channelId, channelName, context, boardId) => {
    const currentState = get();

    // If already connecting/connected to same channel, ignore
    if (
      currentState.channelId === channelId &&
      (currentState.isConnecting || currentState.isConnected)
    ) {
      return;
    }

    // If in another call, reset first
    if (currentState.isConnected || currentState.isConnecting) {
      set({
        isConnecting: false,
        isConnected: false,
        isReconnecting: false,
      });
    }

    // Set intent to connect
    set({
      channelId,
      channelName,
      context,
      boardId: boardId ?? null,
      connectionAttemptId: currentState.connectionAttemptId + 1,
      isConnecting: true,
      isConnected: false,
      isReconnecting: false,
    });
  },

  confirmConnected: () => {
    const state = get();
    // Confirm connection if we were trying to connect OR reconnecting
    if ((state.isConnecting || state.isReconnecting) && state.channelId) {
      set({
        isConnecting: false,
        isConnected: true,
        isReconnecting: false,
      });
    }
  },

  connectionFailed: () => {
    set({
      channelId: null,
      channelName: null,
      context: null,
      boardId: null,
      isConnecting: false,
      isConnected: false,
      isReconnecting: false,
    });
  },

  leaveVoice: () =>
    set({
      channelId: null,
      channelName: null,
      context: null,
      boardId: null,
      isConnecting: false,
      isConnected: false,
      isReconnecting: false,
      isDeafened: false, // Reset deafen when leaving
    }),

  toggleDeafen: () => {
    set((state) => ({ isDeafened: !state.isDeafened }));
  },

  setDeafened: (deafened) => {
    set({ isDeafened: deafened });
  },

  setReconnecting: (reconnecting) => {
    set({ isReconnecting: reconnecting });
  },

  // Legacy compatibility
  setConnected: (connected) => {
    if (connected) {
      set({ isConnected: true, isConnecting: false, isReconnecting: false });
    } else {
      set({ isConnected: false });
    }
  },
}));
