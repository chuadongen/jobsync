"use client";
import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import { cn } from "@/lib/utils";

// For text Claude writes (prep notes, debriefs, gap reports). Raw HTML is off,
// so whatever the text contains is escaped rather than rendered.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
const defaultLink = md.renderer.rules.link_open;
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet("target", "_blank");
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return defaultLink ? defaultLink(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
};

export function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => md.render(text), [text]);
  return (
    <div
      className={cn(
        "space-y-2 text-sm leading-relaxed",
        "[&_a]:text-primary [&_a]:underline [&_h1]:text-base [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
