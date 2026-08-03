"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

// Dynamically import the editor to avoid SSR issues (uses `self` which is undefined in Node)
const MarkdownEditor = dynamic(() => import("react-markdown-editor-lite"), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-800 rounded-md animate-pulse flex items-center justify-center text-gray-500">
      Loading editor...
    </div>
  ),
});

interface CustomMarkdownEditorProps {
  value: string;
  onChange: (text: string) => void;
  id?: string;
  className?: string;
}

export function CustomMarkdownEditor({
  value,
  onChange,
  id,
  className = "h-96",
}: CustomMarkdownEditorProps) {
  const handleEditorChange = ({ text }: { text: string }) => {
    onChange(text);
  };

  return (
    <MarkdownEditor
      id={id}
      value={value}
      onChange={handleEditorChange}
      className={`markdown-editor ${className}`}
      renderHTML={(text: string) => (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={[rehypeRaw]}
        >
          {text}
        </ReactMarkdown>
      )}
      view={{ menu: true, md: true, html: true }}
      theme="dark"
    />
  );
}
