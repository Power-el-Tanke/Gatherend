"use client";

import React from "react";
import { InviteLinkPreview } from "@/components/chat/invite-link-preview";
import { LinkPreview } from "@/components/chat/link-preview";
import { parseTextWithFormatting } from "@/lib/parse-text-formatting";

/**
 * Extrae el inviteCode de un enlace de invitación
 * Soporta formatos: /invite/CODE, domain.com/invite/CODE, https://domain.com/invite/CODE
 */
export const extractInviteCode = (url: string): string | null => {
  // Regex para capturar el código de invitación
  const inviteRegex = /(?:https?:\/\/[^/]+)?\/invite\/([a-zA-Z0-9-]+)/;
  const match = url.match(inviteRegex);
  return match ? match[1] : null;
};

/**
 * Detecta si un texto contiene un enlace de invitación
 */
export const containsInviteLink = (content: string): boolean => {
  const inviteRegex = /(?:https?:\/\/[^\s]+)?\/invite\/[a-zA-Z0-9-]+/;
  return inviteRegex.test(content);
};

/**
 * Extrae URLs https:// del contenido (excluyendo enlaces de invitación)
 */
export const extractUrls = (content: string): string[] => {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const inviteRegex = /\/invite\/[a-zA-Z0-9-]+/;
  const matches = content.match(urlRegex) || [];

  // Filter out invite links and deduplicate
  const uniqueUrls = [...new Set(matches)].filter(
    (url) => !inviteRegex.test(url)
  );

  return uniqueUrls;
};

/**
 * Parsea el contenido de un mensaje y convierte los enlaces de invitación en componentes visuales
 */
export const parseInviteLinks = (
  content: string
): { hasInviteLinks: boolean; inviteCodes: string[]; cleanContent: string } => {
  const inviteRegex = /(?:https?:\/\/[^\s]+)?\/invite\/([a-zA-Z0-9-]+)/g;
  const inviteCodes: string[] = [];
  let match;

  while ((match = inviteRegex.exec(content)) !== null) {
    inviteCodes.push(match[1]);
  }

  // Limpiar el contenido removiendo los enlaces de invitación
  const cleanContent = content
    .replace(/(?:https?:\/\/[^\s]+)?\/invite\/[a-zA-Z0-9-]+/g, "")
    .trim();

  return {
    hasInviteLinks: inviteCodes.length > 0,
    inviteCodes: [...new Set(inviteCodes)], // Eliminar duplicados
    cleanContent,
  };
};

interface ParsedMessageContentProps {
  content: string;
  renderMentions: (text: string) => React.ReactNode[];
}

/**
 * Componente que renderiza el contenido del mensaje con menciones, formato de texto y enlaces de invitación
 */
export const ParsedMessageContent = ({
  content,
  renderMentions,
}: ParsedMessageContentProps) => {
  const { hasInviteLinks, inviteCodes, cleanContent } =
    parseInviteLinks(content);

  // Extract URLs from the clean content (after removing invite links)
  const externalUrls = extractUrls(cleanContent);

  // Aplicar formato de texto junto con menciones
  const renderWithFormatting = (text: string) =>
    parseTextWithFormatting(text, renderMentions);

  return (
    <>
      {/* Texto del mensaje (sin los enlaces de invitación) */}
      {cleanContent && <>{renderWithFormatting(cleanContent)}</>}

      {/* Previews de invitación */}
      {hasInviteLinks && (
        <div className="flex flex-col gap-2 mt-2">
          {inviteCodes.map((code) => (
            <InviteLinkPreview key={code} inviteCode={code} />
          ))}
        </div>
      )}

      {/* Previews de enlaces externos */}
      {externalUrls.length > 0 && (
        <div className="flex flex-col gap-2">
          {externalUrls.slice(0, 3).map((url) => (
            <LinkPreview key={url} url={url} />
          ))}
        </div>
      )}
    </>
  );
};
