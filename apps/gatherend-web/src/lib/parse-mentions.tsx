import React from "react";

/**
 * Parsea el contenido de un mensaje y convierte las menciones en elementos React clicables
 * Formato de mención: @[username]/[discriminator]
 */
export const parseMentions = (
  content: string,
  onMentionClick?: (username: string, discriminator: string) => void
): React.ReactNode[] => {
  // Regex para encontrar menciones en formato @[username]/[discriminator]
  const mentionRegex = /@\[([^\]]+)\]\/\[([^\]]+)\]/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Agregar texto antes de la mención
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const username = match[1];
    const discriminator = match[2];

    // Agregar la mención como elemento React
    parts.push(
      <span
        key={`mention-${match.index}`}
        onClick={() => onMentionClick?.(username, discriminator)}
        className="text-[#9AD0C2] hover:text-[#7AB8A8] font-medium cursor-pointer hover:underline"
      >
        @{username}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Agregar texto restante después de la última mención
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
};

/**
 * Extrae los username/discriminator de las menciones de un contenido
 * Formato de mención: @[username]/[discriminator]
 */
export const extractMentionIdentifiers = (
  content: string
): { username: string; discriminator: string }[] => {
  const mentionRegex = /@\[([^\]]+)\]\/\[([^\]]+)\]/g;
  const identifiers: { username: string; discriminator: string }[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    identifiers.push({ username: match[1], discriminator: match[2] });
  }

  return identifiers;
};

/**
 * Convierte el formato de mención para mostrar solo @username (para preview)
 */
export const formatMentionsForDisplay = (content: string): string => {
  return content.replace(/@\[([^\]]+)\]\/\[[^\]]+\]/g, "@$1");
};
