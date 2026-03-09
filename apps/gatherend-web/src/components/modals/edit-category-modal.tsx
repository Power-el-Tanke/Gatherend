"use client";

import axios from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
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
import { useBoardMutations } from "@/hooks/use-board-data";
import { useTranslation } from "@/i18n";

export const EditCategoryModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const { t } = useTranslation();

  const isModalOpen = isOpen && type === "editCategory";
  const { board, boardId: dataBoardId, categoryId } = data;

  // Usar boardId del data (preferir boardId directo sobre board.id)
  const boardId = dataBoardId || board?.id;
  const { updateCategory } = useBoardMutations(boardId || "");

  const formSchema = z.object({
    name: z
      .string()
      .min(1, { message: t.modals.editCategory.nameRequired })
      .max(50, { message: t.modals.editCategory.nameTooLong }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await axios.patch(
        `/api/boards/${boardId}/categories/${categoryId}`,
        values,
      );

      // Actualizar cache de React Query localmente (sin router.refresh)
      if (categoryId) {
        updateCategory(categoryId, values);
      }

      form.reset();
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-theme-bg-modal text-theme-text-subtle p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t.modals.editCategory.title}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-theme-text-muted">
                      {t.modals.editCategory.nameLabel}
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="bg-theme-bg-input-modal border-0
                          focus-visible:ring-0 text-theme-text-light
                          focus-visible:ring-offset-0"
                        placeholder={t.modals.editCategory.namePlaceholder}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="bg-theme-bg-modal px-6 py-4">
              <Button
                className="bg-theme-tab-button-bg hover:bg-theme-tab-button-hover text-theme-text-light cursor-pointer"
                disabled={isLoading}
              >
                {t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
