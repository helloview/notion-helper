"use client";

import { Fragment, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * Zero-dependency Markdown renderer tuned for the model's output: headings,
 * bold/inline-code, ordered/unordered lists, fenced code blocks (with their
 * own copy button), horizontal rules, and paragraphs. Not a full CommonMark
 * implementation — just the subset the tarot scripts actually use.
 */

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // Fenced code block.
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushParagraph();
      const lang = fence[1].trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", lang, code: code.join("\n") });
      continue;
    }

    // Horizontal rule (--- or the model's ━━━ separators).
    if (/^\s*([-*_])\1{2,}\s*$/.test(line) || /^\s*━{3,}.*$/.test(line)) {
      flushParagraph();
      blocks.push({ type: "hr" });
      continue;
    }

    // Heading.
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    // List item (start of a list group).
    const unordered = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.、)]\s+(.*)$/);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index];
        const currentUnordered = current.match(/^\s*[-*]\s+(.*)$/);
        const currentOrdered = current.match(/^\s*\d+[.、)]\s+(.*)$/);
        const match = isOrdered ? currentOrdered : currentUnordered;
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

// Inline: **bold**, `code`. Everything else renders as-is.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={`${keyPrefix}-t${key}`}>{text.slice(lastIndex, match.index)}</Fragment>);
    }

    if (match[2] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b${key}`} className="font-semibold text-slate-900">
          {match[2]}
        </strong>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${key}`}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800"
        >
          {match[3]}
        </code>,
      );
    }

    lastIndex = pattern.lastIndex;
    key += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-tEnd`}>{text.slice(lastIndex)}</Fragment>);
  }

  return nodes;
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="group relative my-3">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white/90 px-2 text-[11px] font-medium text-slate-600 opacity-0 shadow-sm transition hover:bg-slate-50 group-hover:opacity-100"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? "已复制" : "复制"}
      </button>
      <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 pr-16 text-[12.5px] leading-6 text-slate-800">
        {code}
      </pre>
    </div>
  );
}

const headingClass: Record<number, string> = {
  1: "mt-4 mb-2 text-lg font-bold text-slate-900 first:mt-0",
  2: "mt-4 mb-2 text-base font-bold text-slate-900 first:mt-0",
  3: "mt-3 mb-1.5 text-sm font-semibold text-slate-900 first:mt-0",
};

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);

  return (
    <div className="text-[13px] leading-6 text-slate-700">
      {blocks.map((block, index) => {
        const key = `b${index}`;

        if (block.type === "heading") {
          const className = headingClass[block.level] ?? headingClass[3];
          const content = renderInline(block.text, key);
          if (block.level <= 2) return <h2 key={key} className={className}>{content}</h2>;
          if (block.level === 3) return <h3 key={key} className={className}>{content}</h3>;
          return (
            <p key={key} className="mt-2 mb-1 text-[13px] font-semibold text-slate-900">
              {content}
            </p>
          );
        }

        if (block.type === "code") {
          return <CodeBlock key={key} code={block.code} />;
        }

        if (block.type === "hr") {
          return <hr key={key} className="my-4 border-slate-200" />;
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={key}
              className={`my-2 space-y-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-slate-400`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-i${itemIndex}`}>{renderInline(item, `${key}-i${itemIndex}`)}</li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={key} className="my-2 whitespace-pre-wrap">
            {renderInline(block.text, key)}
          </p>
        );
      })}
    </div>
  );
}
