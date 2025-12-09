import hljs from "highlight.js";
import "highlight.js/styles/default.min.css";
import latex from "highlight.js/lib/languages/latex";
hljs.registerLanguage("latex", latex);

import { useState, useEffect } from "react";

type CodeBlockProps = {
  code: string;
  className?: string;
};

export const CodeBlock = ({ code, className }: CodeBlockProps) => {
  const [highlightedCode, setHighlightedCode] = useState(code);

  useEffect(() => {
    setHighlightedCode(hljs.highlight(code, { language: "latex" }).value);
  }, [code]);

  return (
    <pre
      className={`p-2 rounded-md bg-gray-200 text-sm text-wrap break-words ${className}`}
      dangerouslySetInnerHTML={{ __html: highlightedCode }}
    />
  );
};
