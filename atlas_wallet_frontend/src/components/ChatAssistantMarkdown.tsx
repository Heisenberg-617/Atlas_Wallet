import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

type Props = {
  text: string;
  className?: string;
};

const markdownComponents: Components = {
  a: ({ href, children, ...rest }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  ),
};

/** Renders assistant chat text as Markdown; product cards stay separate in Chat. */
export default function ChatAssistantMarkdown({ text, className = "" }: Props) {
  return (
    <div
      className={[
        "prose prose-sm prose-neutral max-w-none text-foreground dark:prose-invert",
        "prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:rounded prose-code:bg-muted/80 prose-code:px-1 prose-code:py-0.5",
        "[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2",
        className,
      ].join(" ")}
    >
      <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
    </div>
  );
}
