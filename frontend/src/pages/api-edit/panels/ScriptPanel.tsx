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

type Template = {
  label: string;
  code: string;
};

const TEMPLATES: Template[] = [
  {
    label: '默认示例 - 写入数据',
    code: `// handle 返回值作为最终响应体；返回 undefined 则继续使用「响应配置」模板
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
}`,
  },
  {
    label: 'dbResult - SELECT 标准格式',
    code: `// 将数据联动的查询结果包装成标准 API 格式
function handle(req, db, log) {
  if (Array.isArray(dbResult)) {
    return {
      code: 0,
      message: 'success',
      data: dbResult,
      total: dbResult.length
    };
  }
  return { code: 0, data: dbResult };
}`,
  },
  {
    label: 'dbResult - SELECT 分页格式',
    code: `// 查询结果包装成分页格式
function handle(req, db, log) {
  return {
    code: 0,
    data: {
      list: dbResult,
      total: dbResult.length,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20
    }
  };
}`,
  },
  {
    label: 'dbResult - INSERT 返回简化结果',
    code: `// 写入后只返回 id
function handle(req, db, log) {
  return {
    code: 0,
    message: '创建成功',
    data: { id: dbResult.id }
  };
}`,
  },
  {
    label: 'dbResult - UPDATE/DELETE 操作结果',
    code: `// 更新/删除后返回影响行数
function handle(req, db, log) {
  return {
    code: 0,
    message: \`操作完成，影响 \${dbResult.affected} 条记录\`,
    affected: dbResult.affected
  };
}`,
  },
];

const DEFAULT_TEMPLATE = TEMPLATES[0].code;

export function ScriptPanel({ formData, onChange, onSave, saving }: ScriptPanelProps) {
  const enabled = !!formData.script;
  const [script, setScript] = useState(formData.script ?? DEFAULT_TEMPLATE);
  const [templateIdx, setTemplateIdx] = useState(0);

  useEffect(() => {
    setScript(formData.script ?? DEFAULT_TEMPLATE);
  }, [formData.script]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    setTemplateIdx(idx);
    const newScript = TEMPLATES[idx].code;
    setScript(newScript);
    if (enabled) {
      onChange({ ...formData, script: newScript });
    }
  };

  const handleToggle = (v: boolean) => {
    if (v) {
      onChange({ ...formData, script: script || DEFAULT_TEMPLATE });
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
          <div className="flex flex-1 items-center justify-between gap-3">
            <span className="shrink-0">
              handle(req, db, log) <span className="font-normal text-ink-subtle">· JavaScript</span>
            </span>
            <select
              value={templateIdx}
              onChange={handleTemplateChange}
              className="h-6 min-w-[180px] rounded border border-line bg-white px-2 text-[11px] text-ink-secondary"
              disabled={!enabled}
            >
              {TEMPLATES.map((t, i) => (
                <option key={i} value={i}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
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
