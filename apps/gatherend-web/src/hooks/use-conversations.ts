import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import axios from "axios";
import { Conversation, Profile } from "@prisma/client";
import type { UsernameColor, UsernameFormatConfig } from "../../types";

// Tipos para las conversaciones (compatibles con los del servidor)
type ProfileSelect = Pick<
  Profile,
  "id" | "username" | "imageUrl" | "email" | "userId"
> & {
  discriminator?: string;
  usernameColor?: UsernameColor;
  usernameFormat?: UsernameFormatConfig;
};

interface LastMessage {
  content: string;
  fileUrl: string | null;
  deleted: boolean;
  senderId: string;
}

export type FormattedConversation = Conversation & {
  profileOne: ProfileSelect;
  profileTwo: ProfileSelect;
  otherProfile: ProfileSelect;
  isOne: boolean;
  lastMessage?: LastMessage | null;
};

// Query key para las conversaciones
export const conversationsQueryKey = ["conversations"] as const;

/**
 * Hook para obtener y gestionar las conversaciones del usuario
 * Usa TanStack Query para cache y actualizaciones optimistas
 */
export const useConversations = (initialData?: FormattedConversation[]) => {
  const queryClient = useQueryClient();

  // Query para obtener las conversaciones
  const {
    data: conversations = [],
    isLoading,
    isFetched,
    error,
    refetch,
  } = useQuery({
    queryKey: conversationsQueryKey,
    queryFn: async (): Promise<FormattedConversation[]> => {
      const { data } = await axios.get("/api/conversations/list");
      return data;
    },
    initialData,
    staleTime: 1000 * 60, // 1 minuto
  });

  // Mutación para ocultar una conversación
  const hideConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await axios.patch(`/api/conversations/${conversationId}/hide`);
      return conversationId;
    },
    // Actualización optimista
    onMutate: async (conversationId) => {
      // Cancelar queries en progreso
      await queryClient.cancelQueries({ queryKey: conversationsQueryKey });

      // Snapshot del estado anterior
      const previousConversations = queryClient.getQueryData<
        FormattedConversation[]
      >(conversationsQueryKey);

      // Actualización optimista: remover la conversación de la lista
      queryClient.setQueryData<FormattedConversation[]>(
        conversationsQueryKey,
        (old) => old?.filter((c) => c.id !== conversationId) ?? []
      );

      return { previousConversations };
    },
    onError: (_err, _conversationId, context) => {
      // Rollback en caso de error
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationsQueryKey,
          context.previousConversations
        );
      }
    },
    onSettled: () => {
      // Invalidar para sincronizar con el servidor
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  // Función para añadir/mostrar una conversación (cuando se reabre)
  const showConversation = async (_conversationId: string) => {
    // Invalidar la query para refrescar la lista
    await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
  };

  // Función para forzar refetch
  const refreshConversations = () => {
    return queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
  };

  return {
    conversations,
    isLoading,
    isFetched,
    error,
    refetch,
    hideConversation: hideConversationMutation.mutate,
    isHiding: hideConversationMutation.isPending,
    showConversation,
    refreshConversations,
  };
};

/**
 * Hook para invalidar las conversaciones desde cualquier componente
 * Útil para componentes que no necesitan la lista completa pero sí
 * necesitan poder refrescarla (ej: UserAvatarMenu)
 */
export const useInvalidateConversations = () => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    return queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
  };

  return { invalidateConversations: invalidate };
};

/**
 * Hook para obtener IDs de perfiles de conversaciones.
 * Los IDs son estables (no cambian referencia si los valores son iguales).
 *
 * @returns Array de profile IDs de las conversaciones
 */
export const useConversationProfileIds = (): string[] => {
  const { conversations } = useConversations();

  return useMemo(() => {
    if (!conversations) return [];
    return conversations
      .map((c) => c.otherProfile?.id)
      .filter((id): id is string => !!id);
  }, [conversations]);
};
