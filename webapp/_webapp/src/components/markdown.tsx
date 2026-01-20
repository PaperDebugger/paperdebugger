import Markdown from "markdown-to-jsx";
import { TextPatches } from "./text-patches";
import { ReactNode, useMemo, memo } from "react";
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

interface ComponentProps {
  children: ReactNode;
  [key: string]: ReactNode | string | number | boolean | undefined;
}

const AnimatedText = ({ children, animated }: { children: ReactNode; animated?: boolean }) => {
  if (!animated) {
    return children;
  }

  const str = typeof children === "string" ? children : children?.toString() || "";

  if (str.length > 0 && !str.includes("[object Object]")) {
    return str.split(" ").map((word, index) => (
      <span
        key={index}
        className="fade-in-word"
        style={
          {
            "--delay": `${index}ms`,
          } as React.CSSProperties
        }
      >
        {word + " "}
      </span>
    ));
  }
  return children;
};

const MarkdownComponent = memo(({ children, prevAttachment, animated }: MarkdownComponentProps) => {
  const markdownOptions = useMemo(
    () => ({
      overrides: {
        PaperDebugger: {
          component: TextPatches,
        },
        span: {
          component: ({ children, ...props }: ComponentProps) => (
            <span {...props}>
              <AnimatedText animated={animated}>{children}</AnimatedText>
            </span>
          ),
        },
        // p: {
        //   component: ({ children, ...props }: ComponentProps) => (
        //     <div {...props} className="mb-2 original-p">
        //       <AnimatedText animated={animated}>{children}</AnimatedText>
        //     </div>
        //   ),
        // },

        code: {
          component: ({ children, ...props }: ComponentProps) => (
            <code {...props} className="text-xs break-all">
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </code>
          ),
        },
        pre: {
          component: ({ children, ...props }: ComponentProps) => (
            <TextPatches {...props} attachment={prevAttachment}>
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </TextPatches>
          ),
        },
        a: {
          component: ({ children, ...props }: ComponentProps) => (
            <a {...props} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </a>
          ),
        },
        hr: {
          component: ({ ...props }: ComponentProps) => <hr {...props} className="border-t !border-gray-300 my-3" />,
        },
        li: {
          component: ({ children, ...props }: ComponentProps) => (
            <li {...props} className="ml-4 mt-2">
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </li>
          ),
        },

        ol: {
          component: ({ children, ...props }: ComponentProps) => (
            <ol {...props} className="list-decimal mb-2 mt-2">
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </ol>
          ),
        },
      },
    }),
    [prevAttachment, animated],
  );

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
    isAnimating={animated}>
    {children}
  </Streamdown>

  // return <Markdown options={markdownOptions}>{children}</Markdown>;
});

MarkdownComponent.displayName = "MarkdownComponent";
export default MarkdownComponent;
