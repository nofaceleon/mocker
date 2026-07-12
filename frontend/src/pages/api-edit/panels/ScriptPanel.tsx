import { useEffect, useState } from 'react';
import { Code2, AlertCircle } from 'lucide-react';
import { Card, Switch } from '@/components/ui';
import { CodeEditor } from '@/components/CodeEditor';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';

type ScriptPanelProps = {
  formData: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
};

const STARTER = `// handle 返回值作为最终响应体；返回 undefined 则继续使用「响应配置」模板
// 可用对象：req / db / log / dbResult（数据联动结果）
async function handle(req, db, log) {
  const { name, imageUrl } = req.body || {};
  if (!name || !imageUrl) {
    throw new Error('参数不完整：需要 name 与 imageUrl');
  }

  const faceId = 'face_' + Date.now();
  const row = db.insert('face_data', {
    faceId,
    name,
    imageUrl,
    requestId: req.body.requestId || '',
  });
  log.info('人脸已写入', row);

  return {
    code: 0,
    message: 'success',
    data: {
      id: row.id,
      faceId,
      name,
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
        description="在隔离沙箱中执行 JavaScript：可访问 req / db / log，返回值作为响应体。无法访问文件系统与网络。"
      />

      <Card
        className="mt-3"
        title={
          <>
            handle(req, db, log) <span className="font-normal text-ink-subtle">· JavaScript</span>
          </>
        }
      >
        <div className="info-tip">
          <AlertCircle />
          <div>
            <code>req.body</code> / <code>req.query</code> / <code>req.params</code> ·{' '}
            <code>db.insert/select/update/delete</code> · <code>log.info</code> ·{' '}
            <code>dbResult</code>（声明式数据联动结果）。超时 2s；抛错返回{' '}
            <code>SCRIPT_ERROR</code>。
          </div>
        </div>

        <div className="mt-2.5">
          <div className="mb-0 flex items-center gap-2 rounded-t-md border border-b-0 border-[#27272A] bg-[#1f1f23] px-3 py-1.5 text-[11px]">
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[#A1A1AA]">JavaScript</span>
            <span style={{ color: '#52525B' }}>对象：</span>
            <code style={{ color: '#C4B5FD' }}>req</code>
            <code style={{ color: '#86EFAC' }}>db</code>
            <code style={{ color: '#FBBF24' }}>log</code>
            <code style={{ color: '#F0ABFC' }}>dbResult</code>
          </div>
          <CodeEditor
            className="!rounded-t-none"
            value={script}
            onChange={handleScriptChange}
            language="javascript"
            height={440}
            readOnly={!enabled}
            path="mock-api-script.js"
          />
        </div>
      </Card>

      <PanelActions hint="下次请求生效 · 脚本返回值优先于响应模板" onSave={onSave} saving={saving} />
    </div>
  );
}
