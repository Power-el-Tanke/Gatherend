import { Member, Profile, Message, DirectMessage, Board } from "@prisma/client";
import type { ClientProfile } from "@/hooks/use-current-profile";

// MESSAGE TYPES

export type MessageWithMember = Message & {
  member: Member & {
    profile: Profile;
  };
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
  sticker?: {
    id: string;
    imageUrl: string;
    name: string;
  } | null;
  reactions?: Array<{
    id: string;
    emoji: string;
    profileId: string;
    profile: {
      id: string;
      username: string;
      imageUrl: string;
    };
  }>;
  replyTo?: {
    id: string;
    content: string;
    sender: Profile;
    member?: Member & {
      profile: Profile;
    };
    fileUrl?: string | null;
    fileName?: string | null;
    sticker?: {
      id: string;
      imageUrl: string;
      name: string;
    } | null;
  } | null;
};

export type DirectMessageWithSender = DirectMessage & {
  sender: Profile;
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
  sticker?: {
    id: string;
    imageUrl: string;
    name: string;
  } | null;
  reactions?: Array<{
    id: string;
    emoji: string;
    profileId: string;
    profile: {
      id: string;
      username: string;
      imageUrl: string;
    };
  }>;
  replyTo?: {
    id: string;
    content: string;
    sender: Profile;
    member?: Member & {
      profile: Profile;
    };
    fileUrl?: string | null;
    fileName?: string | null;
    sticker?: {
      id: string;
      imageUrl: string;
      name: string;
    } | null;
  } | null;
};

export type ChatMessage = MessageWithMember | DirectMessageWithSender;

// PAGE TYPES

export interface ChatPage {
  id: string; // Cursor or unique identifier
  messages: ChatMessage[];
  nextCursor: string | null; // Cursor for older messages
  previousCursor: string | null; // Cursor for newer messages
}

// CONSTANTS

export const SKELETON_HEIGHT = 700; // Fixed skeleton height
export const MESSAGES_PER_PAGE = 40;

// HOOK PROPS

export interface ChatPagesProps {
  queryKey: string[];
  apiUrl: string;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
  profileId: string;
  boardId?: string; // Optional: for channel messages optimization
}

export interface ChatMessagesProps {
  name: string;
  currentProfile: ClientProfile;
  currentMember?: Member | null;
  board?: Board;
  apiUrl: string;
  socketQuery: Record<string, string>;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
  type: "channel" | "conversation";
}
