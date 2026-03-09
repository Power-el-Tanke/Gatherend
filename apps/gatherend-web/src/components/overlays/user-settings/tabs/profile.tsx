"use client";

import axios from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Languages } from "@prisma/client";
import type { ClientProfile } from "@/hooks/use-current-profile";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface ProfileTabProps {
  user: ClientProfile;
}

const schema = z.object({
  username: z
    .string()
    .min(2, {
      message: "Username must be at least 2 characters",
    })
    .max(32, {
      message: "Username must be at most 32 characters",
    }),
  imageUrl: z.string().optional(),
  languages: z.array(z.nativeEnum(Languages)).min(1, {
    message: "Select at least one language",
  }),
});

type FormSchema = z.infer<typeof schema>;

export const ProfileTab = ({ user }: ProfileTabProps) => {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<Languages[]>(
    user.languages || [Languages.EN]
  );

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user.username,
      imageUrl: user.imageUrl || "",
      languages: user.languages || [Languages.EN],
    },
  });

  const onSubmit = async (values: FormSchema) => {
    try {
      setIsSaving(true);

      await axios.patch("/api/profile", {
        username: values.username,
        imageUrl: values.imageUrl,
        languages: selectedLanguages,
      });

      toast.success("Profile updated successfully!");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const addLanguage = (language: Languages) => {
    if (!selectedLanguages.includes(language)) {
      const newLanguages = [...selectedLanguages, language];
      setSelectedLanguages(newLanguages);
      form.setValue("languages", newLanguages);
    }
  };

  const removeLanguage = (language: Languages) => {
    if (selectedLanguages.length > 1) {
      const newLanguages = selectedLanguages.filter((l) => l !== language);
      setSelectedLanguages(newLanguages);
      form.setValue("languages", newLanguages);
    } else {
      toast.error("You must have at least one language selected");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-theme-text-primary">
          My Account
        </h2>
        <p className="text-sm text-theme-text-tertiary">
          Manage your profile information
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center justify-center text-center">
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs font-bold text-theme-text-muted">
                    Avatar
                  </FormLabel>
                  <FormControl>
                    <FileUpload
                      endpoint="boardImage"
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Username */}
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs font-bold text-theme-text-muted">
                  Username
                </FormLabel>
                <FormControl>
                  <Input
                    disabled={isSaving}
                    className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
                    placeholder="Enter your username"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email (Read-only) */}
          <div>
            <FormLabel className="uppercase text-xs font-bold text-theme-text-muted">
              Email
            </FormLabel>
            <Input
              disabled
              className="bg-zinc-300/50 border-0 text-black cursor-not-allowed"
              value={user.email}
            />
            <p className="text-xs text-theme-text-tertiary mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* User ID (Read-only) */}
          <div>
            <FormLabel className="uppercase text-xs font-bold text-theme-text-muted">
              User ID
            </FormLabel>
            <Input
              disabled
              className="bg-zinc-300/50 border-0 text-black cursor-not-allowed font-mono text-xs"
              value={user.id}
            />
            <p className="text-xs text-theme-text-tertiary mt-1">
              Your unique user identifier
            </p>
          </div>

          {/* Languages */}
          <FormField
            control={form.control}
            name="languages"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase text-xs font-bold text-theme-text-muted">
                  Languages
                </FormLabel>
                <div className="space-y-2">
                  <Select
                    disabled={isSaving}
                    onValueChange={(value) => addLanguage(value as Languages)}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-zinc-300/50 border-0 focus:ring-0 text-black ring-offset-0 focus:ring-offset-0">
                        <SelectValue placeholder="Add a language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(Languages).map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang === Languages.EN ? "English" : "Español"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Selected Languages */}
                  <div className="flex flex-wrap gap-2">
                    {selectedLanguages.map((lang) => (
                      <Badge
                        key={lang}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {lang === Languages.EN ? "English" : "Español"}
                        <button
                          type="button"
                          onClick={() => removeLanguage(lang)}
                          className="ml-1 hover:bg-black/10 rounded-full"
                          disabled={selectedLanguages.length === 1}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <FormDescription className="text-xs text-theme-text-tertiary">
                  Select the languages you speak. This helps match you with
                  boards.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-theme-tab-button-bg hover:bg-theme-tab-button-hover text-white"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
