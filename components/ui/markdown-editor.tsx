"use client";

import MarkdownEditor from "react-markdown-editor-lite";
import "react-markdown-editor-lite/lib/index.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

MarkdownEditor.use({
  mode: "dark",
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
      renderHTML={(text) => (
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
