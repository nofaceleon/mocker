import { useEffect, useState } from 'react';
import { Code2, AlertCircle } from 'lucide-react';
import { Card, Switch } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';

type ScriptPanelProps = {
  formData: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
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

export function ScriptPanel({ formData, onChange, onSave, saving }: ScriptPanelProps) {
  const enabled = !!formData.script;
  const [script, setScript] = useState(formData.script ?? STARTER);

  useEffect(() => {
    setScript(formData.script ?? STARTER);
  }, [formData.script]);

  const handleToggle = (v: boolean) => {
    if (v) {
      onChange({ ...formData, script: script || STARTER });
    } else {
      onChange({ ...formData, script: null });
    }
  };

  const handleScriptChange = (value: string) => {
    setScript(value);
    if (enabled) {
      onChange({ ...formData, script: value });
    }
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Code2}
        title="自定义脚本"
        action={
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11.5px] text-ink-tertiary">{enabled ? '已启用' : '未启用'}</span>
            <Switch checked={enabled} onChange={handleToggle} />
          </div>
        }
        description="编写 JavaScript 自定义响应逻辑。脚本会在响应前执行，返回对象将作为最终响应体。"
      />

      <Card
        className="mt-3"
        title={
          <>
            handle(req) <span className="font-normal text-ink-subtle">· JavaScript</span>
          </>
        }
      >
        <div className="info-tip">
          <AlertCircle />
          <div>
            支持变量：<code>req.body</code> 请求体、<code>req.query</code> 查询参数、<code>req.params</code> 路径参数
          </div>
        </div>

        <div className="code-editor mt-2.5" style={{ borderRadius: 6 }}>
          <div className="code-editor-toolbar">
            <div className="code-editor-tabs-left">
              <span className="lang">JavaScript</span>
              <span style={{ color: '#52525B', fontSize: 11 }}>对象：</span>
              <code style={{ color: '#C4B5FD' }}>req</code>
            </div>
          </div>
          <textarea
            value={script}
            onChange={(e) => handleScriptChange(e.target.value)}
            rows={20}
            disabled={!enabled}
            className="block w-full resize-y border-0 bg-transparent font-mono text-[12.5px] leading-[1.75] text-[#E4E4E7] outline-none focus:outline-none disabled:opacity-50"
            spellCheck={false}
            style={{ caretColor: '#E4E4E7' }}
          />
        </div>
      </Card>

      <PanelActions hint="下次请求生效" onSave={onSave} saving={saving} />
    </div>
  );
}