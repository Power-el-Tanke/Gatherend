"use client";

import { useSocketClient } from "@/components/providers/socket-provider";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface Profile {
  id: string;
  username: string;
  discriminator: string;
  imageUrl: string;
  email?: string;
}

interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  requester: Profile;
  receiver: Profile;
  createdAt: string;
}

interface FriendRequestEvent {
  type: "new" | "accepted" | "rejected";
  friendship: Friendship;
}

interface UseFriendRequestSocketProps {
  profileId: string;
  onNewRequest?: (data: FriendRequestEvent) => void;
}

/**
 * Hook que escucha eventos de solicitudes de amistad via socket
 * Se usa para actualizar la lista de pending requests en tiempo real
 */
export const useFriendRequestSocket = ({
  profileId,
  onNewRequest,
}: UseFriendRequestSocketProps) => {
  const { socket } = useSocketClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !profileId) return;

    const eventKey = `user:${profileId}:friend-request`;

    const handleFriendRequest = (data: FriendRequestEvent) => {

      // Invalidar queries relacionadas con friend requests
      queryClient.invalidateQueries({
        queryKey: ["friendRequests", "pending"],
      });
      queryClient.invalidateQueries({ queryKey: ["friends"] });

      // Callback personalizado si se proporciona
      if (onNewRequest) {
        onNewRequest(data);
      }
    };

    socket.on(eventKey, handleFriendRequest);

    return () => {
      socket.off(eventKey, handleFriendRequest);
    };
  }, [socket, profileId, queryClient, onNewRequest]);
};

