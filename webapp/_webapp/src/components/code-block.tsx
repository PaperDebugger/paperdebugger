import hljs from "highlight.js";
import "highlight.js/styles/default.min.css";
import latex from "highlight.js/lib/languages/latex";
hljs.registerLanguage("latex", latex);

import { useMemo } from "react";

type CodeBlockProps = {
  code: string;
  className?: string;
};

export const CodeBlock = ({ code, className }: CodeBlockProps) => {
  const highlightedCode = useMemo(() => hljs.highlight(code, { language: "latex" }).value, [code]);

  return (
    <pre
      className={`p-2 rounded-md bg-gray-200 dark:!bg-default-200 text-sm text-wrap wrap-break-word ${className}`}
      dangerouslySetInnerHTML={{ __html: highlightedCode }}
    />
  );
};
