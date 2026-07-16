import { Check, Copy, Download, FileText, Link2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AGENTS_EDIT_URLS,
  buildAgentsEditPrompt,
  resolveAgentBaseUrl,
} from '@/data/agents-edit';
import { copyToClipboard } from '@/lib/clipboard';
import { Button, Modal } from '@/components/ui';

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
};

export function AgentsEditModal({ open, onClose, projectId, projectName }: Props) {
  const baseUrl = resolveAgentBaseUrl();
  const prompt = useMemo(
    () => buildAgentsEditPrompt({ projectId, projectName, baseUrl }),
    [projectId, projectName, baseUrl],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="xl"
      title="AI 对话编辑"
      footer={
        <Button variant="primary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="space-y-5">
        <p className="text-[13px] leading-[1.65] text-ink-secondary">
          把下面的提示词复制到 <b className="font-medium text-ink">Cursor / 本地 Copilot / 可访问本机的
          Agent</b>
          ，用自然语言描述要改的接口。AI 会通过管理 REST API 直接改本项目（
          <code className="rounded bg-canvas-subtle px-1 text-[12px]">id={projectId}</code>
          ）。云端 ChatGPT 默认访问不到 localhost，请用本机 Agent。
        </p>

        <div className="rounded-md border border-line bg-canvas-subtle/60 px-3 py-2 text-[12px] text-ink-secondary">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              项目：<b className="text-ink">{projectName}</b>
            </span>
            <span>
              PROJECT_ID：<b className="font-mono text-ink">{projectId}</b>
            </span>
            <span>
              BASE_URL：<b className="font-mono text-ink">{baseUrl}</b>
            </span>
          </div>
          <div className="mt-1 text-[11.5px] text-ink-tertiary">
            第一步：GET {baseUrl}/api/projects/{projectId}/agent-tree
          </div>
        </div>

        <GuideSection
          icon={<FileText className="h-3.5 w-3.5" />}
          title="完整提示词（已注入项目上下文）"
          hint="复制后粘贴给 AI，再说你的修改需求"
          language="markdown"
          text={prompt}
          fileName={`MockHub-Agents-Edit-P${projectId}.md`}
          mime="text/markdown;charset=utf-8"
          publicUrl={AGENTS_EDIT_URLS.manual}
        />

        <div className="flex items-start gap-2 rounded-md border border-dashed border-line px-3 py-2.5 text-[12px] text-ink-tertiary">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" />
          <span>
            从零建项目请用首页「AGENTS 对接指南」生成导入 JSON；本入口用于对
            <b className="font-medium text-ink-secondary">已有项目</b>
            做对话式增删改。
          </span>
        </div>
      </div>
    </Modal>
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
    toast.success('已复制手册 URL（不含项目上下文，优先复制上方完整提示词）');
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
            {urlCopied ? '已复制 URL' : '手册 URL'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
            下载
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-canvas-deep">
        <div className="flex items-center justify-between gap-2 border-b border-line/60 bg-canvas-deep px-3 py-1.5 text-[11px] font-medium text-ink-tertiary">
          <span className="font-mono">{language}</span>
          <span className="text-ink-subtle">{text.length} 字符</span>
        </div>
        <pre className="m-0 max-h-[360px] overflow-auto whitespace-pre bg-canvas-deep px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[#E4E4E7]">
          {text}
        </pre>
      </div>
    </section>
  );
}
