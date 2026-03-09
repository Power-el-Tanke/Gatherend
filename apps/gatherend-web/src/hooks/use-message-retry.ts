import { create } from "zustand";

interface RetryMessageData {
  tempId: string;
  content: string;
  sticker?: {
    id: string;
    imageUrl: string;
    name: string;
  };
  apiUrl: string;
  query: Record<string, string>;
  profileId: string;
  queryKey: string[];
  replyToId?: string;
}

interface MessageRetryStore {
  // Store retry data for each message (using Record for better Zustand compatibility)
  retryData: Record<string, RetryMessageData>;

  // Add retry data when creating optimistic message
  setRetryData: (tempId: string, data: RetryMessageData) => void;

  // Get retry data for a message
  getRetryData: (tempId: string) => RetryMessageData | undefined;

  // Remove retry data (when message is successfully sent)
  removeRetryData: (tempId: string) => void;
}

export const useMessageRetryStore = create<MessageRetryStore>((set, get) => ({
  retryData: {},

  setRetryData: (tempId, data) => {
    set((state) => ({
      retryData: {
        ...state.retryData,
        [tempId]: data,
      },
    }));
  },

  getRetryData: (tempId) => {
    return get().retryData[tempId];
  },

  removeRetryData: (tempId) => {
    set((state) => {
      const { [tempId]: _, ...rest } = state.retryData;
      return { retryData: rest };
    });
  },
}));
