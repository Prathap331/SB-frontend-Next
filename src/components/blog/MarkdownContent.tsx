import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownContentProps = {
  content: string;
};

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-neutral prose-lg max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[#1d1d1f] prose-p:text-[#3a3a3c] prose-p:leading-relaxed prose-li:text-[#3a3a3c] prose-strong:text-[#1d1d1f] prose-a:text-[#1d1d1f] prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-black prose-table:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
