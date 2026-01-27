import { memo } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { mermaid } from "@streamdown/mermaid";
import { math } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";

interface MarkdownComponentProps {
  children: string;
  prevAttachment?: string;
  animated?: boolean;
}

const MarkdownComponent = memo(({ children, animated }: MarkdownComponentProps) => {
  return <Streamdown
    className="space-y-1 leading-[1.50]"
    components={{
      h1: ({ children }) => (
        <h1 className="text-lg font-bold mt-2">
          {children}
        </h1>
      ),

      h2: ({ children }) => (
        <h2 className="text-base font-bold mt-2 mb-1">
          {children}
        </h2>
      ),

      h3: ({ children }) => (
        <h3 className="text-sm font-bold mt-2">
          {children}
        </h3>
      ),
    }}
    plugins={{ code, mermaid, math, cjk }}
    isAnimating={animated}
    linkSafety={{ enabled: false }}
    >
    {children}
  </Streamdown>

  // return <Markdown options={markdownOptions}>{children}</Markdown>;
});

MarkdownComponent.displayName = "MarkdownComponent";
export default MarkdownComponent;
