import { useSocketClient } from "@/components/providers/socket-provider";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface Profile {
  id: string;
  username: string;
  discriminator: string;
  imageUrl: string;
  email: string;
  userId: string;
}

interface Conversation {
  id: string;
  profileOneId: string;
  profileTwoId: string;
  profileOne: Profile;
  profileTwo: Profile;
  createdAt: string;
  updatedAt: string;
}

interface NewConversationEvent {
  conversation: Conversation;
  otherProfile: Profile;
}

interface UseNewConversationSocketProps {
  profileId: string;
  onNewConversation?: (data: NewConversationEvent) => void;
}

/**
 * Hook que escucha eventos de nuevas conversaciones via socket
 * Se usa para actualizar la lista de DMs en tiempo real cuando se acepta una solicitud de amistad
 */
export const useNewConversationSocket = ({
  profileId,
  onNewConversation,
}: UseNewConversationSocketProps) => {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !profileId) return;

    const eventKey = `user:${profileId}:new-conversation`;

    const handleNewConversation = (data: NewConversationEvent) => {

      // Invalidar queries relacionadas con conversaciones
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });

      // Callback personalizado si se proporciona
      if (onNewConversation) {
        onNewConversation(data);
      }
    };

    socket.on(eventKey, handleNewConversation);

    return () => {
      socket.off(eventKey, handleNewConversation);
    };
  }, [socket, profileId, queryClient, onNewConversation]);
};

