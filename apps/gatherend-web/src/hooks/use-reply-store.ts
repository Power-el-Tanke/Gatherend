import { create } from "zustand";
import { Profile } from "@prisma/client";

interface ReplyMessage {
  id: string;
  content: string;
  sender: Profile;
  fileUrl?: string | null;
  fileName?: string | null;
  sticker?: {
    id: string;
    imageUrl: string;
    name: string;
  } | null;
}

interface ReplyStore {
  replyingTo: ReplyMessage | null;
  roomId: string | null; // channelId or conversationId
  focusTrigger: number; // Incrementa para disparar focus en el input
  setReplyingTo: (message: ReplyMessage | null, roomId?: string) => void;
  clearReply: () => void;
}

export const useReplyStore = create<ReplyStore>((set) => ({
  replyingTo: null,
  roomId: null,
  focusTrigger: 0,
  setReplyingTo: (message, roomId) =>
    set((state) => ({
      replyingTo: message,
      roomId: roomId || null,
      focusTrigger: message ? state.focusTrigger + 1 : state.focusTrigger,
    })),
  clearReply: () => set({ replyingTo: null, roomId: null }),
}));
