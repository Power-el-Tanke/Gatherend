"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Copy, RefreshCw } from "lucide-react";
import { useOrigin } from "@/hooks/use-origin";
import { useState } from "react";
import axios from "axios";
import { Switch } from "../ui/switch";
import { useTranslation } from "@/i18n";

export const InviteModal = () => {
  const { onOpen, isOpen, onClose, type, data } = useModal();
  const origin = useOrigin();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "invite";
  const { board } = data;

  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inviteUrl = `${origin}/invite/${board?.inviteCode}`;

  // Copiar invitación
  const onCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1000);
  };

  // Regenerar invitación
  const onRegenerate = async () => {
    try {
      setIsLoading(true);
      const response = await axios.patch(
        `/api/boards/${board?.id}/invite-code`,
        { action: "regenerate" },
      );

      onOpen("invite", { board: response.data });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle de enable/disable
  const onToggleInvite = async () => {
    try {
      setIsLoading(true);

      const action = board?.inviteEnabled ? "disable" : "enable";

      const response = await axios.patch(
        `/api/boards/${board?.id}/invite-code`,
        { action },
      );

      // volver a abrir el modal con board actualizado
      onOpen("invite", { board: response.data });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-theme-bg-modal max-w-[400px]! text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.invite.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t.modals.invite.boardInviteLinkLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Toggle ENABLED */}
          <div className="flex justify-between items-center">
            <Label
              htmlFor="invite-enabled-switch"
              className="uppercase text-[15px] font-bold text-theme-text-subtle"
            >
              {t.modals.invite.inviteEnabledLabel}
            </Label>
            <Switch
              id="invite-enabled-switch"
              checked={board?.inviteEnabled}
              disabled={isLoading}
              onCheckedChange={onToggleInvite}
              className="data-[state=checked]:bg-theme-tab-button-bg cursor-pointer"
            />
          </div>

          {/* Invite URL */}
          <div>
            <Label
              htmlFor="invite-url"
              className="uppercase text-[15px] font-bold text-theme-text-subtle"
            >
              {t.modals.invite.boardInviteLinkLabel}
            </Label>

            <div className="flex items-center mt-2 gap-x-2">
              <Input
                id="invite-url"
                name="invite-url"
                disabled={isLoading || !board?.inviteEnabled}
                className="bg-theme-bg-input-modal border-0 focus-visible:ring-0 text-theme-text-light focus-visible:ring-offset-0 text-[15px]!"
                value={inviteUrl}
                readOnly
              />

              <Button
                disabled={isLoading || !board?.inviteEnabled}
                onClick={onCopy}
                size="icon"
                className="bg-theme-tab-button-bg cursor-pointer hover:bg-theme-tab-button-hover text-theme-text-light hover:text-theme-text-light"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Regenerate */}
            <Button
              onClick={onRegenerate}
              disabled={isLoading || !board?.inviteEnabled}
              variant="link"
              size="sm"
              className="text-xs cursor-pointer text-theme-text-tertiary mt-4 hover:text-theme-text-secondary"
            >
              {t.modals.invite.generateNewLink}
              <RefreshCw className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
