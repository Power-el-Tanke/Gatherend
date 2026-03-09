"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface AddReactionVariables {
  emoji: string;
  messageId?: string;
  directMessageId?: string;
  profileId: string;
  channelId?: string;
  conversationId?: string;
}

interface RemoveReactionVariables {
  reactionId: string;
  profileId: string;
  channelId?: string;
  conversationId?: string;
}

export const useAddReaction = () => {
  const queryClient = useQueryClient();
  const getToken = useTokenGetter();

  return useMutation({
    mutationFn: async ({
      emoji,
      messageId,
      directMessageId,
      profileId,
      channelId,
      conversationId,
    }: AddReactionVariables) => {
      // Get token from TokenManager (cached + auto-refresh)
      const token = IS_PRODUCTION ? await getToken() : undefined;

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/reactions`,
        {
          emoji,
          messageId,
          directMessageId,
          channelId,
          conversationId,
        },
        getExpressAxiosConfig(profileId, token)
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries to refetch messages with updated reactions
      if (variables.channelId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "channel", variables.channelId],
        });
      }
      if (variables.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "conversation", variables.conversationId],
        });
      }
    },
    onError: (error) => {
      console.error("[useAddReaction] Error:", error);
    },
  });
};

export const useRemoveReaction = () => {
  const queryClient = useQueryClient();
  const getToken = useTokenGetter();

  return useMutation({
    mutationFn: async ({
      reactionId,
      profileId,
      channelId,
      conversationId,
    }: RemoveReactionVariables) => {
      // Get token in production
      const token = IS_PRODUCTION ? await getToken() : undefined;

      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/reactions/${reactionId}`,
        {
          ...getExpressAxiosConfig(profileId, token),
          data: {
            channelId,
            conversationId,
          },
        }
      );
    },
    onSuccess: (_, variables) => {
      if (variables.channelId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "channel", variables.channelId],
        });
      }
      if (variables.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", "conversation", variables.conversationId],
        });
      }
    },
  });
};

