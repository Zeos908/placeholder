"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Headings never exceed 16 px in a chat bubble (spec §12.2).
const heading = ({ children }: { children?: React.ReactNode }) => (
  <p className="mt-2 mb-1 text-base leading-[22px] font-semibold first:mt-0">{children}</p>
);

const components: Components = {
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-link underline-offset-2 hover:underline">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
  code: ({ children }) => (
    <code className="rounded bg-black/10 px-1 py-px font-mono text-[13px] dark:bg-white/10">{children}</code>
  ),
  pre: ({ children }) => <pre className="my-1.5 overflow-x-auto rounded-lg bg-black/10 p-2 dark:bg-white/10">{children}</pre>,
  img: () => null, // no remote images from model output
};

/** Assistant markdown: GFM, links open in a new tab, and raw HTML is dropped (no rehype-raw). */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
      {children}
    </ReactMarkdown>
  );
}
