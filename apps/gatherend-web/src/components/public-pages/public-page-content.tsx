import React from "react";

type ListItemNode = {
  text: string;
  children?: ListNode;
};

type ListNode = {
  items: ListItemNode[];
};

function isUppercaseHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 4) return false;
  if (trimmed.length > 90) return false;
  if (/^\d+\./.test(trimmed)) return false;
  if (trimmed.startsWith("•")) return false;
  return trimmed === trimmed.toUpperCase();
}

function renderList(node: ListNode, key: string): React.ReactNode {
  return (
    <ul key={key} className="list-disc pl-6 space-y-1 text-zinc-300">
      {node.items.map((item, index) => (
        <li key={`${key}.item.${index}`}>
          <span>{item.text}</span>
          {item.children ? (
            <div className="mt-2">{renderList(item.children, `${key}.n`)}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function renderTextBlocks(params: {
  content: string;
  treatUppercaseAsHeading?: boolean;
}): React.ReactNode {
  const { content, treatUppercaseAsHeading = false } = params;

  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];

  let paragraphLines: string[] = [];
  let currentList: ListNode | null = null;
  let listStack: ListNode[] = [];
  let lastItemStack: ListItemNode[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(" ").trim();
    if (text) {
      nodes.push(
        <p key={`p.${nodes.length}`} className="text-zinc-300 leading-relaxed">
          {text}
        </p>,
      );
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (!currentList) return;
    nodes.push(renderList(currentList, `ul.${nodes.length}`));
    currentList = null;
    listStack = [];
    lastItemStack = [];
  };

  const addListItem = (level: number, text: string) => {
    if (!currentList) {
      currentList = { items: [] };
      listStack = [currentList];
      lastItemStack = [];
    }

    let normalizedLevel = level;
    if (normalizedLevel > 0 && !lastItemStack[normalizedLevel - 1]) {
      normalizedLevel = 0;
    }

    while (listStack.length <= normalizedLevel) {
      const parentItem = lastItemStack[listStack.length - 1];
      const nextList: ListNode = { items: [] };
      if (parentItem) parentItem.children = nextList;
      listStack.push(nextList);
    }

    const targetList = listStack[normalizedLevel];
    const item: ListItemNode = { text };
    targetList.items.push(item);
    lastItemStack[normalizedLevel] = item;
    lastItemStack = lastItemStack.slice(0, normalizedLevel + 1);
    listStack = listStack.slice(0, normalizedLevel + 1);
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (treatUppercaseAsHeading && isUppercaseHeading(trimmed)) {
      flushParagraph();
      flushList();
      nodes.push(
        <h2
          key={`h2.${nodes.length}`}
          className="text-xl font-semibold text-theme-text-light"
        >
          {trimmed}
        </h2>,
      );
      continue;
    }

    if (trimmed.startsWith("• ")) {
      flushParagraph();
      addListItem(0, trimmed.slice(2).trim());
      continue;
    }

    const dashMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (dashMatch) {
      flushParagraph();
      const leadingSpaces = dashMatch[1]?.length ?? 0;
      const level = Math.max(0, Math.floor(leadingSpaces / 2));
      addListItem(level, (dashMatch[2] ?? "").trim());
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <div className="space-y-6">{nodes}</div>;
}

export function FaqContent({ content }: { content: string }) {
  const blocks = content
    .split(/\n{2,}/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const items = blocks
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length >= 2)
    .map((lines) => ({
      question: lines[0] ?? "",
      answer: lines.slice(1).join(" ").trim(),
    }))
    .filter((x) => x.question && x.answer);

  return (
    <div className="space-y-8 text-zinc-300">
      {items.map((item, index) => (
        <div key={`faq.${index}`}>
          <h2 className="text-lg font-semibold text-theme-text-light mb-2">
            {item.question}
          </h2>
          <p className="leading-relaxed">{item.answer}</p>
        </div>
      ))}
    </div>
  );
}

export function PrivacyPolicyContent({ content }: { content: string }) {
  return <>{renderTextBlocks({ content, treatUppercaseAsHeading: true })}</>;
}

export function TosContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const sections: Array<{ title: string; body: string }> = [];

  let current: { title: string; bodyLines: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.bodyLines.push("");
      continue;
    }

    const heading = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (heading) {
      if (current) {
        sections.push({
          title: current.title,
          body: current.bodyLines.join("\n").trim(),
        });
      }
      current = { title: heading[2] ?? trimmed, bodyLines: [] };
      continue;
    }

    if (!current) {
      current = { title: "Terms", bodyLines: [] };
    }
    current.bodyLines.push(line);
  }

  if (current) {
    sections.push({
      title: current.title,
      body: current.bodyLines.join("\n").trim(),
    });
  }

  return (
    <ol className="list-decimal pl-6 space-y-6 text-zinc-300">
      {sections.map((section, index) => (
        <li key={`tos.${index}`}>
          <p className="font-semibold text-theme-text-light">{section.title}</p>
          <div className="mt-2">
            {renderTextBlocks({ content: section.body })}
          </div>
        </li>
      ))}
    </ol>
  );
}

