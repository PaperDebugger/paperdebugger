import { memo } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";
import "katex/dist/katex.min.css";

interface MarkdownComponentProps {
  children: string;
  prevAttachment?: string;
  animated?: boolean;
}

const MarkdownComponent = memo(({ children, animated }: MarkdownComponentProps) => {
  return (
    <Streamdown
      className="space-y-1 leading-[1.50]"
      shikiTheme={["github-light", "ayu-dark"]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-lg font-bold mt-2 text-default-800! dark:text-default-800!">{children}</h1>
        ),

        h2: ({ children }) => (
          <h2 className="text-base font-bold mt-2 mb-1 text-default-800! dark:text-default-800!">{children}</h2>
        ),

        h3: ({ children }) => (
          <h3 className="text-sm font-bold mt-2 text-default-800! dark:text-default-800!">{children}</h3>
        ),

        h4: ({ children }) => (
          <h4 className="text-xs font-bold mt-2 text-default-800! dark:text-default-800!">{children}</h4>
        ),

        h5: ({ children }) => (
          <h5 className="text-xs font-bold mt-2 text-default-800! dark:text-default-800!">{children}</h5>
        ),

        h6: ({ children }) => (
          <h6 className="text-xs font-bold mt-2 text-default-800! dark:text-default-800!">{children}</h6>
        ),
      }}
      plugins={{ code, mermaid, math, cjk }}
      isAnimating={animated}
      linkSafety={{ enabled: false }}
    >
      {children}
    </Streamdown>
  );

  // return <Markdown options={markdownOptions}>{children}</Markdown>;
});

MarkdownComponent.displayName = "MarkdownComponent";
export default MarkdownComponent;
