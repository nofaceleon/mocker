import { Code2, AlertCircle, Play } from 'lucide-react';
import { Card, Switch } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { PanelHeader } from '../PanelHeader';

type ScriptPanelProps = {
  draft: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
};

const STARTER = `// 在此处编写响应前的处理逻辑
// 返回对象将作为最终响应体
async function handle(req) {
  const { name, imageUrl } = req.body;
  if (!name || !imageUrl) {
    throw new Error('参数不完整');
  }
  return {
    code: 0,
    message: 'success',
    data: {
      faceId: \`face_\${Date.now()}\`,
      createdAt: new Date().toISOString(),
    },
  };
}`;

export function ScriptPanel({ draft: _draft, onChange: _onChange }: ScriptPanelProps) {
  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Code2}
        title="自定义脚本"
        action={
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-warning-border bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-text">
              P1 计划中
            </span>
            <Switch checked={false} onChange={() => undefined} disabled />
          </div>
        }
        description="编写 JavaScript 自定义响应逻辑。P1 将在隔离沙箱内执行（无法访问文件系统与网络）。"
      />

      <div className="info-tip dark">
        <AlertCircle />
        <div>
          <strong>当前仅 UI 预览</strong>：脚本会被原样写入 <code>mock_apis.script</code> 字段，但执行沙箱尚未实现。
          当前生效方式仍为模板变量替换（见「响应配置」）。
        </div>
      </div>

      <Card
        className="mt-3"
        title={
          <>
            handle(req, res, db) <span className="font-normal text-ink-subtle">· JavaScript</span>
          </>
        }
        extra={
          <div className="flex items-center gap-3 text-[12px]">
            <span className="inline-flex cursor-not-allowed items-center gap-1 text-success-text opacity-60">
              <Play className="h-3 w-3" />
              运行测试
            </span>
            <span className="text-ink-disabled">|</span>
            <span className="tool-link cursor-not-allowed opacity-60">格式化</span>
            <span className="tool-link cursor-not-allowed opacity-60">示例</span>
          </div>
        }
      >
        <div className="code-editor" style={{ borderRadius: 0, border: 'none' }}>
          <div className="code-editor-toolbar">
            <div className="code-editor-tabs-left">
              <span className="lang">JavaScript · ES2022</span>
              <span style={{ color: '#52525B', fontSize: 11 }}>对象：</span>
              <code style={{ color: '#C4B5FD' }}>req</code>
              <code style={{ color: '#93C5FD' }}>res</code>
              <code style={{ color: '#86EFAC' }}>db</code>
              <code style={{ color: '#FBBF24' }}>log</code>
            </div>
            <span style={{ fontSize: 11, color: '#71717A' }}>行 {STARTER.split('\n').length} · UTF-8</span>
          </div>
          <textarea
            readOnly
            defaultValue={STARTER}
            rows={20}
            className="block w-full resize-y border-0 bg-[#09090B] p-4 font-mono text-[13px] leading-[1.75] text-[#E4E4E7] outline-none focus:outline-none"
            spellCheck={false}
          />
        </div>
      </Card>

      <div className="info-tip mt-3">
        <AlertCircle />
        <div>
          <strong>沙箱限制</strong>：<code>fs</code> / <code>net</code> / <code>child_process</code> 等敏感模块将被禁用。返回对象即接口响应；用 <code>res.status(400)</code> 可修改状态码。
        </div>
      </div>
    </div>
  );
}