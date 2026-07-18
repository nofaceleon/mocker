import { Check, Copy, Download, FileJson, FileText, Link2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import {
  AGENTS_GUIDE_EXAMPLE_BUNDLE,
  AGENTS_GUIDE_PROMPT,
  AGENTS_GUIDE_URLS,
} from '@/data/agents-guide';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from '@/components/ui';
import { CodeEditor } from '@/components/CodeEditor';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AgentsGuideModal({ open, onClose }: Props) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* 紫色液态金属弹框 */}
      <div
        role="dialog"
        aria-modal="true"
        className="agents-guide-modal relative z-10 w-full max-w-4xl overflow-hidden"
      >
        {/* 装饰层：油膜虹彩 */}
        <div className="modal-aurora" aria-hidden />
        {/* 装饰层：镜面光带 */}
        <div className="modal-shine" aria-hidden />
        {/* 装饰层：颗粒纹理 */}
        <div className="modal-noise" aria-hidden />
        {/* 装饰层：漂浮亮点 */}
        <div className="modal-spark modal-spark-1" aria-hidden />
        <div className="modal-spark modal-spark-2" aria-hidden />
        <div className="modal-spark modal-spark-3" aria-hidden />

        {/* 标题栏 */}
        <div className="modal-header relative z-10 flex items-center justify-between border-b border-purple-200/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="modal-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="url(#modalIconGrad)" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="url(#modalIconGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="modalIconGrad" x1="2" y1="2" x2="22" y2="22">
                    <stop stopColor="#7c3aed" />
                    <stop offset="1" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h3 className="text-[15px] font-bold gold-text">AGENTS 对接指南</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="modal-body relative z-10 max-h-[calc(100vh-200px)] overflow-auto px-6 pb-6 scrollbar-modern">
          <div className="space-y-5">
            <p className="text-[13px] leading-[1.65] text-ink-secondary">
              把下面的提示词复制给任意 AI（ChatGPT / Claude / Gemini / Cursor / 内部 Copilot
              等），告诉它你的业务场景，AI 即可按照 MockHub 的 JSON 契约直接产出一份可导入的 项目包。把
              AI 给的 JSON 通过首页「导入项目」上传即可一键生成完整可调试的接口。
            </p>

            <GuideSection
              icon={<FileText className="h-3.5 w-3.5" />}
              title="① 完整提示词（Markdown）"
              hint="让 AI 按此规格输出"
              language="markdown"
              text={AGENTS_GUIDE_PROMPT}
              fileName="MockHub-AGENTS-Guide.md"
              mime="text/markdown;charset=utf-8"
              publicUrl={AGENTS_GUIDE_URLS.prompt}
            />

            <GuideSection
              icon={<FileJson className="h-3.5 w-3.5" />}
              title="② 完整 JSON 示例（可直接导入）"
              hint="覆盖 HTTP / SSE / WebSocket / 数据联动 / 脚本 / 回调 / 多响应"
              language="json"
              text={AGENTS_GUIDE_EXAMPLE_BUNDLE}
              fileName="MockHub-Example-Bundle.json"
              mime="application/json;charset=utf-8"
              publicUrl={AGENTS_GUIDE_URLS.example}
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="modal-footer relative z-10 flex items-center justify-end border-t border-purple-200/30 bg-purple-100/30 px-6 py-3">
          <Button variant="primary" className="modal-footer-button" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function absoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

function GuideSection({
  icon,
  title,
  hint,
  language,
  text,
  fileName,
  mime,
  publicUrl,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  language: string;
  text: string;
  fileName: string;
  mime: string;
  publicUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const onCopy = async () => {
    await copyToClipboard(text);
    setCopied(true);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopied(false), 1500);
  };

  const onDownload = () => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已下载 ${fileName}`);
  };

  const onCopyUrl = async () => {
    await copyToClipboard(absoluteUrl(publicUrl));
    setUrlCopied(true);
    toast.success('已复制 URL，发给 AI 让它直接打开阅读');
    setTimeout(() => setUrlCopied(false), 1500);
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            {icon}
            {title}
          </h4>
          <span className="text-[11.5px] text-ink-tertiary">{hint}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={onCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onCopyUrl} title={absoluteUrl(publicUrl)}>
            {urlCopied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            {urlCopied ? '已复制 URL' : '复制 URL'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
            下载
          </Button>
        </div>
      </div>
      <CodeBlock language={language} text={text} publicUrl={publicUrl} />
    </section>
  );
}

function CodeBlock({
  language,
  text,
  publicUrl,
}: {
  language: string;
  text: string;
  publicUrl: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#27272A] bg-[#18181B]">
      <div className="flex items-center justify-between gap-2 border-b border-[#27272A] bg-[#18181B] px-3 py-1.5 text-[11px] font-medium text-zinc-500">
        <span className="font-mono">{language}</span>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 truncate font-mono text-zinc-600 transition-colors hover:text-zinc-300"
          title="在浏览器中打开（发给 AI 时的可访问地址）"
        >
          <Link2 className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{publicUrl}</span>
        </a>
        <span className="text-zinc-600">{text.length} 字符</span>
      </div>
      <CodeEditor
        className="!rounded-none !border-0"
        language={language}
        value={text}
        height={300}
        readOnly
      />
    </div>
  );
}
