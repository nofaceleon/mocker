import { Check, Copy, Download, FileJson, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AGENTS_GUIDE_EXAMPLE_BUNDLE, AGENTS_GUIDE_PROMPT } from '@/data/agents-guide';
import { copyToClipboard } from '@/lib/clipboard';
import { Button, Modal } from '@/components/ui';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AgentsGuideModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="xl"
      title="AGENTS 对接指南"
      footer={
        <Button variant="primary" onClick={onClose}>
          关闭
        </Button>
      }
    >
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
        />

        <GuideSection
          icon={<FileJson className="h-3.5 w-3.5" />}
          title="② 完整 JSON 示例（可直接导入）"
          hint="覆盖 HTTP / SSE / WebSocket / 数据联动 / 脚本 / 回调 / 多响应"
          language="json"
          text={AGENTS_GUIDE_EXAMPLE_BUNDLE}
          fileName="MockHub-Example-Bundle.json"
          mime="application/json;charset=utf-8"
        />
      </div>
    </Modal>
  );
}

function GuideSection({
  icon,
  title,
  hint,
  language,
  text,
  fileName,
  mime,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  language: string;
  text: string;
  fileName: string;
  mime: string;
}) {
  const [copied, setCopied] = useState(false);

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

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            {icon}
            {title}
          </h4>
          <span className="text-[11.5px] text-ink-tertiary">{hint}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={onCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
            下载
          </Button>
        </div>
      </div>
      <CodeBlock language={language} text={text} />
    </section>
  );
}

function CodeBlock({ language, text }: { language: string; text: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-canvas-deep">
      <div className="flex items-center justify-between border-b border-line/60 bg-canvas-deep px-3 py-1.5 text-[11px] font-medium text-ink-tertiary">
        <span className="font-mono">{language}</span>
        <span className="text-ink-subtle">{text.length} 字符</span>
      </div>
      <pre className="m-0 max-h-[300px] overflow-auto whitespace-pre bg-canvas-deep px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[#E4E4E7]">
        {text}
      </pre>
    </div>
  );
}
