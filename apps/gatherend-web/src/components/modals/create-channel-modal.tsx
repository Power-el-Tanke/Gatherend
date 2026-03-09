"use client";

import axios from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { ChannelType } from "@prisma/client";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { SlashSVG } from "@/lib/slash";
import { useTranslation } from "@/i18n";
import type {
  BoardWithData,
  BoardChannel,
} from "@/components/providers/board-provider";

export const CreateChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "createChannel";
  const { board, boardId: dataBoardId, categoryId } = data;

  // Usar boardId del data (preferir boardId directo sobre board.id)
  const boardId = dataBoardId || board?.id;

  const formSchema = z.object({
    name: z.string().min(1, {
      message: t.modals.createChannel.nameRequired,
    }),
    type: z.nativeEnum(ChannelType),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: ChannelType.TEXT,
    },
  });

  //  MUTATION con TanStack Query  //
  const createChannelMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const response = await axios.post(`/api/boards/${boardId}/channels`, {
        ...values,
        categoryId: categoryId ?? null,
      });

      return response.data as BoardChannel;
    },
    onMutate: async (values) => {
      if (!boardId) return;

      // Cancelar queries en progreso
      await queryClient.cancelQueries({ queryKey: ["board", boardId] });

      // Snapshot del estado anterior
      const previousBoard = queryClient.getQueryData<BoardWithData>([
        "board",
        boardId,
      ]);

      // Crear canal optimista
      const tempId = `temp-${Date.now()}`;
      const optimisticChannel: BoardChannel = {
        id: tempId,
        name: values.name,
        type: values.type,
        boardId: boardId,
        parentId: categoryId ?? null,
        position: 999, // Se corregirá cuando la API responda
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Actualizar cache optimísticamente
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old) return old;

        if (categoryId) {
          // Agregar a categoría
          return {
            ...old,
            categories: old.categories.map((cat) =>
              cat.id === categoryId
                ? { ...cat, channels: [...cat.channels, optimisticChannel] }
                : cat,
            ),
          };
        } else {
          // Agregar como canal root
          return {
            ...old,
            channels: [...old.channels, optimisticChannel],
          };
        }
      });

      return { previousBoard, tempId };
    },
    onSuccess: (newChannel, _variables, context) => {
      if (!boardId) return;

      // Reemplazar el canal optimista con el real
      queryClient.setQueryData<BoardWithData>(["board", boardId], (old) => {
        if (!old || !context?.tempId) return old;

        if (newChannel.parentId) {
          // Está en una categoría
          return {
            ...old,
            categories: old.categories.map((cat) =>
              cat.id === newChannel.parentId
                ? {
                    ...cat,
                    channels: cat.channels.map((ch) =>
                      ch.id === context.tempId ? newChannel : ch,
                    ),
                  }
                : cat,
            ),
          };
        } else {
          // Es un canal root
          return {
            ...old,
            channels: old.channels.map((ch) =>
              ch.id === context.tempId ? newChannel : ch,
            ),
          };
        }
      });

      toast.success(t.modals.createChannel.success);
      form.reset();
      onClose();
    },
    onError: (error, _variables, context) => {
      console.error(error);
      toast.error(t.modals.createChannel.error);

      // Rollback al estado anterior
      if (context?.previousBoard && boardId) {
        queryClient.setQueryData(["board", boardId], context.previousBoard);
      }
    },
  });

  const isLoading = createChannelMutation.isPending;

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createChannelMutation.mutate(values);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-theme-bg-modal max-w-[400px]! text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.createChannel.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t.modals.createChannel.nameLabel}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-3 px-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      htmlFor="create-channel-name"
                      className="uppercase text-[15px] font-bold text-theme-text-subtle"
                    >
                      {t.modals.createChannel.nameLabel}
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="create-channel-name"
                        disabled={isLoading}
                        className="bg-theme-bg-input-modal border-0
                          focus-visible:ring-0 text-theme-text-primary 
                          focus-visible:ring-offset-0 text-[15px]!"
                        placeholder={t.modals.createChannel.namePlaceholder}
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <span
                      id="create-channel-type-label"
                      className="uppercase text-[15px] font-bold text-theme-text-subtle"
                    >
                      {t.modals.createChannel.typeLabel}
                    </span>
                    <FormControl>
                      <div
                        className="flex gap-10 justify-center"
                        role="group"
                        aria-labelledby="create-channel-type-label"
                      >
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => field.onChange(ChannelType.TEXT)}
                          className={cn(
                            "flex items-center justify-center gap-0 py-2 px-3 rounded-md transition cursor-pointer",
                            "border-2 w-28",
                            field.value === ChannelType.TEXT
                              ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                              : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                          )}
                        >
                          <SlashSVG className="w-6 h-6 -mr-1" />
                          <span className="mr-4">
                            {t.modals.createChannel.text}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => field.onChange(ChannelType.VOICE)}
                          className={cn(
                            "flex items-center justify-center gap-0 py-2 px-3 rounded-md transition cursor-pointer",
                            "border-2 w-28",
                            field.value === ChannelType.VOICE
                              ? "border-theme-channel-type-active-border bg-theme-channel-type-active-bg text-theme-channel-type-active-text"
                              : "border-theme-channel-type-inactive-border bg-theme-channel-type-inactive-bg text-theme-channel-type-inactive-text hover:border-theme-channel-type-inactive-hover-border",
                          )}
                        >
                          <Mic className="w-6 h-6" />
                          <span>{t.modals.createChannel.voice}</span>
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="bg-theme-bg-modal px-6 py-4">
              <div className="flex items-center justify-center gap-20 w-full -mt-4">
                <Button
                  type="button"
                  disabled={isLoading}
                  onClick={handleClose}
                  className="bg-theme-bg-cancel-button hover:bg-theme-bg-cancel-button-hover cursor-pointer text-theme-text-subtle hover:text-theme-text-light"
                >
                  {t.common.cancel}
                </Button>
                <Button
                  className="bg-theme-tab-button-bg hover:bg-theme-tab-button-hover text-theme-text-light cursor-pointer"
                  disabled={isLoading}
                >
                  {t.modals.createChannel.create}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
