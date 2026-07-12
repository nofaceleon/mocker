import { type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';

export function CodeBlock({
  language,
  tabs,
  children,
  className,
}: {
  language?: string;
  tabs?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('code-editor', className)}>
      {(language || tabs) && (
        <div className="code-editor-toolbar">
          <div className="code-editor-tabs-left">
            {language && <span className="lang">{language}</span>}
            {tabs}
          </div>
        </div>
      )}
      <pre className="code-content">{children}</pre>
    </div>
  );
}

export function CopyButton({ text, label = '已复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded text-ink-subtle transition-colors hover:text-ink"
      title="复制"
      onClick={() => {
        copyToClipboard(text).then(() => {
          setCopied(true);
          toast.success(label);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
