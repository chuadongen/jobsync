"use client";
import { useEffect, useRef, useState } from "react";
import { formatDateRange } from "@/lib/resume/dates";
import { cn } from "@/lib/utils";
import type { RenderedItem, RenderedResume } from "@/models/resume.model";

// A4 at 96dpi: the PDF page this preview stands in for.
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

function Item({ item, skills }: { item: RenderedItem; skills: boolean }) {
  if (skills) {
    return (
      <p className="mb-0.5">
        <span className="font-bold">{item.organisation}: </span>
        {item.details ?? item.bullets.map((b) => b.text).join(", ")}
      </p>
    );
  }
  const dates = formatDateRange(item.startDate, item.endDate);
  return (
    <div className="mb-[5.3px]">
      <div className="flex justify-between gap-4">
        <span className="font-bold">{item.organisation}</span>
        {item.location && <span className="shrink-0">{item.location}</span>}
      </div>
      {(item.title || dates) && (
        <div className="flex justify-between gap-4">
          <span className="italic">{item.title}</span>
          {dates && <span className="shrink-0">{dates}</span>}
        </div>
      )}
      {item.details
        ?.split("\n")
        .filter((l) => l.trim())
        .map((line, i) => <p key={i}>{line}</p>)}
      <ul className="mt-0.5 space-y-0.5 pl-1">
        {item.bullets.map((b) => (
          <li key={b.id} className="flex gap-2">
            <span>•</span>
            <span className="flex-1">{b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// An HTML stand-in for the PDF, laid out with the same type sizes so the
// one-page check is honest. It is never a file: drafts cannot be exported.
export function ResumePreview({ resume, className }: { resume: RenderedResume; className?: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Height the content needs, in pages; minHeight pads the box to a full page
  // so scrollHeight alone cannot tell a half-empty page from a full one.
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (wrapper.current) setScale(Math.min(1, wrapper.current.clientWidth / PAGE_WIDTH));
      const last = page.current?.lastElementChild as HTMLElement | null | undefined;
      if (page.current && last) {
        const padding = parseFloat(getComputedStyle(page.current).paddingBottom) || 0;
        setFill((last.offsetTop + last.offsetHeight + padding) / PAGE_HEIGHT);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (wrapper.current) observer.observe(wrapper.current);
    if (page.current) observer.observe(page.current);
    return () => observer.disconnect();
  }, [resume]);

  const pages = Math.max(1, Math.ceil(fill - 0.005));
  // react-pdf sets lines a touch looser than the browser, so leave headroom.
  const tight = pages === 1 && fill > 0.96;

  const { header } = resume;
  const contact = [
    header.location,
    header.email,
    header.phone,
    ...header.links.map((l) => l.url.replace(/^https?:\/\//, "")),
  ].filter(Boolean);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Preview (A4)</span>
        <span
          className={cn((pages > 1 || tight) && "font-medium text-amber-600 dark:text-amber-400")}
          data-testid="page-estimate"
        >
          {pages > 1
            ? `About ${pages} pages`
            : tight
              ? "Right at the one-page limit"
              : `Fits on one page (${Math.round(fill * 100)}% used)`}
        </span>
      </div>
      <div ref={wrapper} className="overflow-hidden rounded-md border bg-white shadow-sm">
        <div style={{ height: (page.current?.scrollHeight ?? PAGE_HEIGHT) * scale }}>
          <div
            ref={page}
            className="origin-top-left bg-white text-[12.67px] leading-[1.25] text-[#111]"
            style={{
              width: PAGE_WIDTH,
              minHeight: PAGE_HEIGHT,
              padding: "37px 48px",
              transform: `scale(${scale})`,
              fontFamily: "Helvetica, Arial, sans-serif",
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${PAGE_HEIGHT - 1}px, #f59e0b ${PAGE_HEIGHT - 1}px, #f59e0b ${PAGE_HEIGHT}px)`,
            }}
            data-testid="resume-preview"
          >
            <p className="text-center text-[24px] font-bold leading-none tracking-wide">{header.fullName || "Your Name"}</p>
            {contact.length > 0 && <p className="mt-2 text-center text-[12px] text-[#444]">{contact.join("  •  ")}</p>}
            {resume.sections.map((section) => (
              <div key={section.key} className="mt-[10.7px]">
                <p className="text-[13.3px] font-bold uppercase tracking-wider">{section.heading}</p>
                <div className="mb-1.5 mt-0.5 border-b border-[#111]" />
                {section.items.map((item) => (
                  <Item key={item.id} item={item} skills={section.key === "skills"} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
