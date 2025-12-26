import React from "react";

type Props = {
  content: string;
  className?: string;
};

export default function MarkdownRenderer({ content, className = "" }: Props) {
  // Minimal safe fallback (renders as text). Later we can upgrade to react-markdown.
  return (
    <pre className={`whitespace-pre-wrap break-words text-sm text-zinc-200 ${className}`}>
      {content}
    </pre>
  );
}
