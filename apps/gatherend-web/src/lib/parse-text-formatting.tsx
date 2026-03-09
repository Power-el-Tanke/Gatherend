"use client";

import React from "react";

/**
 * Convierte URLs en enlaces clickeables
 */
export const parseUrls = (content: string): React.ReactNode[] => {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = urlRegex.exec(content)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // Add the URL as a clickable link
    const url = match[1];
    parts.push(
      <a
        key={`url-${keyIndex++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-theme-text-accent hover:text-theme-accent-light underline break-all"
      >
        {url}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
};

/**
 * Parsea el formato de texto y convierte a elementos con estilos
 * - *texto* → bold
 * - _texto_ → underline (subrayado)
 * - #texto# → italic (cursiva)
 * - Combinaciones: *#texto#* → bold + italic, *_texto_* → bold + underline, etc.
 */
export const parseTextFormatting = (content: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];

  // Regex para los diferentes formatos (orden importa: más específico primero)
  // Combinaciones de 3: *#_texto_#* o cualquier orden
  // Combinaciones de 2: *#texto#*, *_texto_*, #_texto_#
  // Individuales: *texto*, _texto_, #texto#
  const formatRegex = new RegExp(
    [
      // Triple combinación (los 3 formatos) - diferentes órdenes
      "(\\*#_([^_]+)_#\\*)", // *#_texto_#* → bold + italic + underline
      "(\\*_#([^#]+)#_\\*)", // *_#texto#_* → bold + underline + italic
      "(#\\*_([^_]+)_\\*#)", // #*_texto_*# → italic + bold + underline
      "(#_\\*([^*]+)\\*_#)", // #_*texto*_# → italic + underline + bold
      "(_\\*#([^#]+)#\\*_)", // _*#texto#*_ → underline + bold + italic
      "(_#\\*([^*]+)\\*#_)", // _#*texto*#_ → underline + italic + bold
      // Doble combinación
      "(\\*#([^#]+)#\\*)", // *#texto#* → bold + italic
      "(#\\*([^*]+)\\*#)", // #*texto*# → italic + bold
      "(\\*_([^_]+)_\\*)", // *_texto_* → bold + underline
      "(_\\*([^*]+)\\*_)", // _*texto*_ → underline + bold
      "(#_([^_]+)_#)", // #_texto_# → italic + underline
      "(_#([^#]+)#_)", // _#texto#_ → underline + italic
      // Individual
      "(\\*([^*]+)\\*)", // *texto* → bold
      "(_([^_]+)_)", // _texto_ → underline
      "(#([^#]+)#)", // #texto# → italic
    ].join("|"),
    "g"
  );

  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = formatRegex.exec(content)) !== null) {
    // Agregar texto antes del formato
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // Triple combinación (bold + italic + underline)
    if (match[1] || match[3] || match[5] || match[7] || match[9] || match[11]) {
      const text =
        match[2] || match[4] || match[6] || match[8] || match[10] || match[12];
      parts.push(
        <span
          key={`format-${keyIndex++}`}
          className="font-bold italic underline"
        >
          {text}
        </span>
      );
    }
    // *#texto#* o #*texto*# → bold + italic
    else if (match[13] || match[15]) {
      const text = match[14] || match[16];
      parts.push(
        <span key={`format-${keyIndex++}`} className="font-bold italic">
          {text}
        </span>
      );
    }
    // *_texto_* o _*texto*_ → bold + underline
    else if (match[17] || match[19]) {
      const text = match[18] || match[20];
      parts.push(
        <span key={`format-${keyIndex++}`} className="font-bold underline">
          {text}
        </span>
      );
    }
    // #_texto_# o _#texto#_ → italic + underline
    else if (match[21] || match[23]) {
      const text = match[22] || match[24];
      parts.push(
        <span key={`format-${keyIndex++}`} className="italic underline">
          {text}
        </span>
      );
    }
    // *texto* → bold
    else if (match[25]) {
      parts.push(
        <span key={`format-${keyIndex++}`} className="font-bold">
          {match[26]}
        </span>
      );
    }
    // _texto_ → underline
    else if (match[27]) {
      parts.push(
        <span key={`format-${keyIndex++}`} className="underline">
          {match[28]}
        </span>
      );
    }
    // #texto# → italic
    else if (match[29]) {
      parts.push(
        <span key={`format-${keyIndex++}`} className="italic">
          {match[30]}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Agregar texto restante
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
};

/**
 * Combina el parseo de menciones con el formato de texto y URLs
 */
export const parseTextWithFormatting = (
  content: string,
  parseMentionsFn: (text: string) => React.ReactNode[]
): React.ReactNode[] => {
  // Primero parseamos las menciones
  const mentionParts = parseMentionsFn(content);

  // Luego aplicamos formato de texto a las partes que son strings
  const result: React.ReactNode[] = [];

  mentionParts.forEach((part, index) => {
    if (typeof part === "string") {
      // Primero aplicar formato de texto
      const formattedParts = parseTextFormatting(part);
      formattedParts.forEach((formattedPart, fIndex) => {
        if (typeof formattedPart === "string") {
          // Luego convertir URLs en enlaces
          const urlParts = parseUrls(formattedPart);
          urlParts.forEach((urlPart, uIndex) => {
            if (typeof urlPart === "string") {
              result.push(urlPart);
            } else {
              result.push(
                React.cloneElement(urlPart as React.ReactElement, {
                  key: `url-${index}-${fIndex}-${uIndex}`,
                })
              );
            }
          });
        } else {
          result.push(
            React.cloneElement(formattedPart as React.ReactElement, {
              key: `formatted-${index}-${fIndex}`,
            })
          );
        }
      });
    } else {
      // Mantener elementos React (menciones) sin cambios
      result.push(part);
    }
  });

  return result;
};
