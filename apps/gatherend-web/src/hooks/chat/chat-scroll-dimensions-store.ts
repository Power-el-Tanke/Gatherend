import { useSyncExternalStore } from "react";

export interface ChatScrollDimensionsState {
  key: string;
  /**
   * Stored as absolute scrollTop minus placeholderHeight.
   * When restoring, caller re-adds current placeholder height.
   */
  normalizedScrollTop: number;
  normalizedScrollHeight: number;
  clientHeight: number;
  isPinned: boolean;
  updatedAt: number;
}

const DEFAULT_STATE: ChatScrollDimensionsState = {
  key: "__default__",
  normalizedScrollTop: 0,
  normalizedScrollHeight: 0,
  clientHeight: 0,
  isPinned: true,
  updatedAt: 0,
};

const store = new Map<string, ChatScrollDimensionsState>();
const defaults = new Map<string, ChatScrollDimensionsState>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  for (const l of set) l();
}

function getOrDefault(key: string): ChatScrollDimensionsState {
  const existing = store.get(key);
  if (existing) return existing;

  const cachedDefault = defaults.get(key);
  if (cachedDefault) return cachedDefault;

  const nextDefault: ChatScrollDimensionsState = { ...DEFAULT_STATE, key };
  defaults.set(key, nextDefault);
  return nextDefault;
}

function subscribeKey(key: string, callback: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(callback);
  return () => {
    set?.delete(callback);
    if (set && set.size === 0) listeners.delete(key);
  };
}

export const chatScrollDimensionsStore = {
  get(key: string): ChatScrollDimensionsState {
    return getOrDefault(key);
  },

  updateChannelDimensions(
    key: string,
    normalizedScrollTop: number,
    normalizedScrollHeight: number,
    clientHeight: number,
    options: { isPinned: boolean },
  ) {
    const prev = getOrDefault(key);
    const next: ChatScrollDimensionsState = {
      key,
      normalizedScrollTop,
      normalizedScrollHeight,
      clientHeight,
      isPinned: options.isPinned,
      updatedAt: Date.now(),
    };

    const same =
      prev.normalizedScrollTop === next.normalizedScrollTop &&
      prev.normalizedScrollHeight === next.normalizedScrollHeight &&
      prev.clientHeight === next.clientHeight &&
      prev.isPinned === next.isPinned;
    if (same) return;

    store.set(key, next);
    emit(key);
  },

  clear(key: string) {
    store.delete(key);
    defaults.delete(key);
    emit(key);
  },
};

export function useChatScrollDimensions(
  key: string,
): ChatScrollDimensionsState {
  return useSyncExternalStore(
    (cb) => subscribeKey(key, cb),
    () => getOrDefault(key),
    () => getOrDefault(key),
  );
}
