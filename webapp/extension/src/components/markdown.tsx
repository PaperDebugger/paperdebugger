import Markdown from "markdown-to-jsx";
import { TextPatches } from "./text-patches";
import { ReactNode, useMemo, memo } from "react";

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
        h1: {
          component: ({ children, ...props }: ComponentProps) => (
            <div {...props} className="text-lg font-bold mt-2">
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </div>
          ),
        },
        h2: {
          component: ({ children, ...props }: ComponentProps) => (
            <div {...props} className="text-base font-bold mt-2">
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </div>
          ),
        },
        h3: {
          component: ({ children, ...props }: ComponentProps) => (
            <div {...props} className="text-sm font-bold mt-2">
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </div>
          ),
        },
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
          component: ({ ...props }: ComponentProps) => <hr {...props} className="border-t border-gray-300 my-3" />,
        },
        li: {
          component: ({ children, ...props }: ComponentProps) => (
            <li {...props} className="ml-4 mt-2">
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </li>
          ),
        },
        ul: {
          component: ({ children, ...props }: ComponentProps) => (
            <ul {...props} className="list-disc mb-2 mt-2">
              {typeof children === "string" ? <AnimatedText animated={animated}>{children}</AnimatedText> : children}
            </ul>
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

  return <Markdown options={markdownOptions}>{children}</Markdown>;
});

MarkdownComponent.displayName = "MarkdownComponent";
export default MarkdownComponent;
