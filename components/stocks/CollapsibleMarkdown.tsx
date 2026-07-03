"use client";

import { useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function CollapsibleMarkdown({ markdown, label }: { markdown: string; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!markdown.trim()) return null;

  return (
    <div className="mt-4 border-t border-hairline pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded font-mono text-[12px] tracking-[0.08em] text-muted transition-colors hover:text-ink"
      >
        <span>{open ? "HIDE" : "SHOW"} {label.toUpperCase()}</span>
        <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      <div
        id={id}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="md-body pt-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
