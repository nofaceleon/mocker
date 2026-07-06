import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  Check,
  Code2,
  FileText,
  Link2,
  Play,
  Plus,
  Save,
  Send,
  Settings,
  Shield,
  TestTube,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Breadcrumb,
  Button,
  Card,
  CodeBlock,
  CopyButton,
  FormField,
  Input,
  MethodBadge,
  Modal,
  Select,
  Switch,
  Textarea,
} from '@/components/ui';
import {
  type MockApiPayload,
  useCreateMockApi,
  useDeleteMockApi,
  useMockApi,
  useTestMockApi,
  useUpdateMockApi,
} from '@/hooks/queries/use-mock-apis';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { HttpMethod, MockApi } from '@/types/api';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'WS', 'SSE'];
const DATA_OPS = ['none', 'insert', 'select', 'update', 'delete'] as const;

type ConfigTab =
  | 'basic'
  | 'params'
  | 'response'
  | 'validate'
  | 'callback'
  | 'datalink'
  | 'script'
  | 'test';

const TABS: Array<{ value: ConfigTab; label: string; icon: any; badge?: string }> = [
  { value: 'basic', label: '基本配置', icon: Settings },
  { value: 'params', label: '请求参数', icon: FileText, badge: '5' },
  { value: 'response', label: '响应配置', icon: Check },
  { value: 'validate', label: '参数校验', icon: Shield, badge: '3' },
  { value: 'callback', label: '延迟回调', icon: Send, badge: 'ON' },
  { value: 'datalink', label: '数据联动', icon: Link2, badge: 'ON' },
  { value: 'script', label: '自定义脚本', icon: Code2, badge: 'ON' },
  { value: 'test', label: '在线测试', icon: TestTube },
];

export function ApiEditPage() {
  const params = useParams();
  const apiId = params.apiId === 'new' ? undefined : Number(params.apiId);
  const projectId = Number(params.projectId);
  const navigate = useNavigate();
  const isNew = params.apiId === 'new';

  const { data: api, isLoading } = useMockApi(apiId);
  const updateMut = useUpdateMockApi();
  const deleteMut = useDeleteMockApi();
  const createMut = useCreateMockApi();
  const testMut = useTestMockApi();

  const [draft, setDraft] = useState<MockApiPayload>(() => newDraft());
  const [tab, setTab] = useState<ConfigTab>('basic');
  const [deleteOpen, setDeleteOpen] = useState(false);

  // 加载远端数据 → 写入本地 draft
  useEffect(() => {
    if (api && !isNew) {
      setDraft(apiToDraft(api));
    }
  }, [api, isNew]);

  useEffect(() => {
    if (isNew) setDraft(newDraft());
  }, [isNew]);

  if ((!isNew && isLoading) || (!isNew && !api)) {
    return (
      <div className="page-container">
        <div className="text-[13px] text-ink-tertiary">加载中...</div>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      if (isNew) {
        const featureGroupId = Number(new URLSearchParams(location.search).get('gid'));
        if (!featureGroupId) {
          toast.error('缺少功能组 ID');
          return;
        }
        await createMut.mutateAsync({ featureGroupId, body: draft });
        toast.success('接口已创建');
        navigate(`/projects/${projectId}`);
      } else if (api) {
        const updated = await updateMut.mutateAsync({ id: api.id, data: draft });
        toast.success('已保存');
        setDraft(apiToDraft(updated));
      }
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleDelete = async () => {
    if (!api) return;
    setDeleteOpen(false);
    try {
      await deleteMut.mutateAsync(api.id);
      toast.success('接口已删除');
      navigate(`/projects/${projectId}`);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const showApi = api ?? ({
    id: 0,
    featureGroupId: 0,
    name: draft.name,
    description: draft.description ?? null,
    method: draft.method,
    path: draft.path,
    isEnabled: draft.isEnabled ?? true,
    sortOrder: 0,
    responseStatus: draft.responseStatus ?? 200,
    responseDelay: draft.responseDelay ?? 0,
    responseDelayMax: 0,
    responseContentType: draft.responseContentType ?? 'application/json',
    responseHeaders: draft.responseHeaders ?? null,
    responseBody: draft.responseBody ?? {},
    validationRules: draft.validationRules ?? null,
    dataOp: draft.dataOp ?? 'none',
    dataTable: draft.dataTable ?? null,
    dataWhere: draft.dataWhere ?? null,
    script: draft.script ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as MockApi);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 54px)' }}>
      {/* 顶部导航 */}
      <header className="topbar !relative">
        <a href="/projects" className="brand">
          <div className="brand-mark">M</div>
          <span>Mock Studio</span>
        </a>
        <Breadcrumb
          items={[
            { label: '项目', to: '/projects' },
            { label: showApi.name || '新建接口', to: `/projects/${projectId}` },
            ...(isNew
              ? [{ label: '新建接口', current: true }]
              : [{ label: showApi.name, current: true }]),
          ]}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="secondary">
            <BookOpen className="h-3.5 w-3.5" />
            调用日志
          </Button>
          <Button variant="primary" onClick={handleSave} loading={updateMut.isPending || createMut.isPending}>
            <Save className="h-3.5 w-3.5" />
            保存配置
          </Button>
        </div>
      </header>

      {/* 接口摘要 */}
      <section className="flex items-center gap-3.5 border-b border-line bg-white px-5 py-3">
        <MethodBadge method={showApi.method} />
        <div className="min-w-0 flex-1">
          <h1 className="mb-0.5 flex items-center gap-2.5 text-[16px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            {showApi.name}
            {!isNew && showApi.isEnabled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-text">
                <span className="live-dot" />
                运行中
              </span>
            )}
          </h1>
          <p className="truncate text-[12.5px] leading-snug text-ink-tertiary">
            {showApi.description || '用于模拟接口的请求与响应'}
          </p>
        </div>
        <span className="param-code flex items-center gap-1.5">
          {showApi.method} {showApi.path}
          <CopyButton text={`${showApi.method} ${showApi.path}`} />
        </span>
      </section>

      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: '264px 1fr' }}>
        <ConfigNav
          current={tab}
          onChange={setTab}
          method={showApi.method}
          path={showApi.path}
        />

        <div className="overflow-y-auto bg-canvas">
          {tab === 'basic' && <BasicPanel draft={draft} onChange={setDraft} />}
          {tab === 'params' && <ParamsPanel draft={draft} onChange={setDraft} />}
          {tab === 'response' && <ResponsePanel draft={draft} onChange={setDraft} />}
          {tab === 'validate' && <ValidatePanel draft={draft} onChange={setDraft} />}
          {tab === 'callback' && <CallbackPanel draft={draft} onChange={setDraft} />}
          {tab === 'datalink' && <DataLinkPanel draft={draft} onChange={setDraft} />}
          {tab === 'script' && <ScriptPanel draft={draft} onChange={setDraft} />}
          {tab === 'test' && (
            <TestPanel
              api={showApi}
              onRun={async (input) => testMut.mutateAsync({ id: showApi.id, input })}
            />
          )}
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="删除接口"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              删除
            </Button>
          </>
        }
        width="sm"
      >
        <p className="text-[13px] text-ink-secondary">
          确定删除 <b>{showApi.name}</b>（{showApi.method} {showApi.path}）吗？该操作不可恢复。
        </p>
      </Modal>
    </div>
  );
}

function ConfigNav({
  current,
  onChange,
  method,
  path,
}: {
  current: ConfigTab;
  onChange: (v: ConfigTab) => void;
  method: HttpMethod;
  path: string;
}) {
  return (
    <aside className="overflow-y-auto border-r border-line bg-white scrollbar-thin">
      <div className="border-b border-line-subtle px-4 py-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          <MethodBadge method={method} className="!text-[10px] !py-[2.5px] !px-[7px]" />
          <span className="param-code flex-1 truncate !text-[11.5px]">{path}</span>
        </div>
        <div className="text-[11px] text-ink-tertiary">人脸管理 · 已调用 486 次</div>
      </div>

      <div className="px-3 pb-2 pt-3.5">
        <div className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
          基础配置
        </div>
        {TABS.slice(0, 4).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={cn(
                'group mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-[450] transition-all',
                current === t.value
                  ? 'bg-canvas-deep font-medium text-ink-inverse shadow-sm'
                  : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink',
              )}
            >
              <span
                className={cn(
                  'grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded transition-colors',
                  current === t.value
                    ? 'bg-white/15 text-ink-inverse'
                    : 'text-ink-tertiary group-hover:text-ink-secondary',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 truncate tracking-[-0.005em]">{t.label}</span>
              {t.badge && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[10px] font-medium',
                    current === t.value
                      ? t.badge === 'ON'
                        ? 'border border-transparent bg-white/15 text-ink-inverse'
                        : 'border border-transparent bg-white/15 text-ink-inverse'
                      : t.badge === 'ON'
                        ? 'border border-success-border bg-success-soft text-success-text'
                        : 'border border-line bg-canvas-subtle text-ink-secondary',
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-line-subtle px-3 pb-2 pt-3.5">
        <div className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
          高级特性
        </div>
        {TABS.slice(4, 7).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={cn(
                'group mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-[450] transition-all',
                current === t.value
                  ? 'bg-canvas-deep font-medium text-ink-inverse shadow-sm'
                  : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink',
              )}
            >
              <span
                className={cn(
                  'grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded transition-colors',
                  current === t.value
                    ? 'bg-white/15 text-ink-inverse'
                    : 'text-ink-tertiary group-hover:text-ink-secondary',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 truncate tracking-[-0.005em]">{t.label}</span>
              {t.badge && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[10px] font-medium',
                    current === t.value
                      ? 'border border-transparent bg-white/15 text-ink-inverse'
                      : t.badge === 'ON'
                        ? 'border border-success-border bg-success-soft text-success-text'
                        : 'border border-line bg-canvas-subtle text-ink-secondary',
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-line-subtle px-3 pb-2 pt-3.5">
        <div className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
          调试
        </div>
        {TABS.slice(7).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={cn(
                'group mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-[450] transition-all',
                current === t.value
                  ? 'bg-canvas-deep font-medium text-ink-inverse shadow-sm'
                  : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink',
              )}
            >
              <span
                className={cn(
                  'grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded transition-colors',
                  current === t.value
                    ? 'bg-white/15 text-ink-inverse'
                    : 'text-ink-tertiary group-hover:text-ink-secondary',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 truncate tracking-[-0.005em]">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-line-subtle px-3 py-3.5 text-[11px] leading-[1.8] text-ink-subtle">
        <div>
          上次保存 · <span className="text-ink-secondary">3 分钟前</span>
        </div>
        <div>
          上次调用 · <span className="text-ink-secondary">13:35:42</span>
        </div>
      </div>
    </aside>
  );
}

// ---------- 各个面板 ----------
function PanelHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h2 className="mb-2 flex items-center gap-2.5 text-[22px] font-semibold leading-tight tracking-[-0.025em] text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-md border border-line bg-canvas-subtle text-ink [&>svg]:h-[15px] [&>svg]:w-[15px]">
          <Icon />
        </span>
        {title}
        {action}
      </h2>
      <p className="max-w-[600px] text-[13.5px] leading-[1.6] text-ink-secondary">{description}</p>
    </div>
  );
}

function PanelActions({
  left,
  right,
}: {
  left?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-line pt-[18px]">
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-subtle before:block before:h-1 before:w-1 before:rounded-full before:bg-success before:content-['']">
        {left ?? '所有修改自动保存到草稿'}
      </span>
      <div className="flex items-center gap-2">
        {right ?? (
          <>
            <Button variant="secondary">取消</Button>
            <Button variant="primary">
              <Save className="h-3.5 w-3.5" />
              保存
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function BasicPanel({ draft, onChange }: { draft: MockApiPayload; onChange: (d: MockApiPayload) => void }) {
  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Settings}
        title="基本配置"
        description="定义 Mock 接口的基础信息：名称、HTTP 方法、路由路径、归属分组与启用状态。"
      />

      <Card title="接口信息">
        <div className="form-row">
          <FormField label="接口名称" required>
            <Input
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              placeholder="接口名"
            />
          </FormField>
          <FormField label="所属功能组" hint="项目 / 模块">
            <Input value="人脸管理" disabled />
          </FormField>
        </div>

        <div className="form-row three-col">
          <FormField label="HTTP 方法" required>
            <Select
              value={draft.method}
              onChange={(e) => onChange({ ...draft, method: e.target.value as HttpMethod })}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="协议">
            <Select defaultValue="http">
              <option value="http">HTTP / REST</option>
              <option value="ws">WebSocket</option>
              <option value="sse">SSE</option>
            </Select>
          </FormField>
          <FormField label="路由优先级">
            <Select defaultValue="high">
              <option value="high">高（精确匹配）</option>
              <option value="mid">中（参数匹配）</option>
              <option value="low">低（通配符）</option>
            </Select>
          </FormField>
        </div>

        <FormField label="路由路径" required>
          <div className="input-group">
            <span className="input-group-text">{draft.method}</span>
            <Input
              className="mono"
              value={draft.path}
              onChange={(e) => onChange({ ...draft, path: e.target.value })}
              placeholder="/api/face/add"
            />
          </div>
          <div className="form-helper">
            支持 <code>:id</code> 占位符、<code>*</code> 通配符；匹配优先级：精确 &gt; 参数 &gt; 通配符
          </div>
        </FormField>

        <FormField label="接口描述">
          <Textarea
            value={draft.description ?? ''}
            onChange={(e) => onChange({ ...draft, description: e.target.value || null })}
            rows={2}
            placeholder="一段简短描述"
          />
        </FormField>

        <div className="form-row">
          <FormField label="Content-Type">
            <Select defaultValue="application/json">
              <option>application/json</option>
              <option>multipart/form-data</option>
              <option>application/x-www-form-urlencoded</option>
            </Select>
          </FormField>
          <FormField label="启用接口">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch
                checked={draft.isEnabled ?? true}
                onChange={(v) => onChange({ ...draft, isEnabled: v })}
              />
              <span className="text-[12.5px] text-ink-secondary">启用后接收外部调用</span>
            </div>
          </FormField>
        </div>
      </Card>

      <PanelActions />
    </div>
  );
}

function ParamsPanel({ onChange: _onChange }: { draft: MockApiPayload; onChange: (d: MockApiPayload) => void }) {
  const [rows, setRows] = useState<ParamRow[]>([
    { name: 'name', type: 'string', location: 'Body', required: true, defaultValue: '', desc: '人脸名称' },
    { name: 'imageUrl', type: 'string', location: 'Body', required: true, defaultValue: '', desc: '人脸图片地址（公网可访问）' },
    { name: 'requestId', type: 'string', location: 'Body', required: true, defaultValue: '', desc: '请求唯一标识（用于回调关联）' },
    { name: 'callbackUrl', type: 'string', location: 'Body', required: false, defaultValue: '', desc: '异步回调地址（启用回调时必填）' },
    { name: 'metadata', type: 'object', location: 'Body', required: false, defaultValue: '{}', desc: '自定义元数据' },
  ]);

  const update = (idx: number, patch: Partial<ParamRow>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const remove = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));
  const add = () =>
    setRows((r) => [...r, { name: '', type: 'string', location: 'Body', required: false, defaultValue: '', desc: '' }]);

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={FileText}
        title="请求参数"
        description="定义接口期望接收的请求字段，涵盖 Query / Body / Path / Header。每行代表一个参数。"
      />

      <Card
        title={
          <>
            参数列表 <span className="font-normal text-ink-subtle">· {rows.length} 个参数</span>
          </>
        }
        noBody
        extra={
          <>
            <Button variant="ghost" size="sm">
              <Plus className="h-3 w-3" />
              导入 JSON
            </Button>
            <span className="add-link" onClick={add}>
              <Plus className="h-3 w-3" />
              添加参数
            </span>
          </>
        }
      >
        <table className="params-table">
          <thead>
            <tr>
              <th style={{ width: 18 }} />
              <th>参数名</th>
              <th style={{ width: 100 }}>类型</th>
              <th style={{ width: 90 }}>位置</th>
              <th style={{ width: 50 }}>必填</th>
              <th style={{ width: 110 }}>默认值</th>
              <th>说明</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td className="cursor-grab text-ink-disabled select-none">⋮⋮</td>
                <td>
                  <input className="table-input mono" value={r.name} onChange={(e) => update(idx, { name: e.target.value })} />
                </td>
                <td>
                  <select className="table-input" value={r.type} onChange={(e) => update(idx, { type: e.target.value as any })}>
                    <option>string</option>
                    <option>number</option>
                    <option>boolean</option>
                    <option>object</option>
                    <option>array</option>
                  </select>
                </td>
                <td>
                  <select className="table-input" value={r.location} onChange={(e) => update(idx, { location: e.target.value as any })}>
                    <option>Body</option>
                    <option>Query</option>
                    <option>Path</option>
                    <option>Header</option>
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer rounded accent-ink"
                    checked={r.required}
                    onChange={(e) => update(idx, { required: e.target.checked })}
                  />
                </td>
                <td>
                  <input className="table-input" value={r.defaultValue} onChange={(e) => update(idx, { defaultValue: e.target.value })} placeholder="—" />
                </td>
                <td>
                  <input className="table-input" value={r.desc} onChange={(e) => update(idx, { desc: e.target.value })} />
                </td>
                <td>
                  <button onClick={() => remove(idx)} className="border-none bg-transparent text-ink-subtle hover:text-ink">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <PanelActions left="支持拖拽排序" />
    </div>
  );
}

type ParamRow = {
  name: string;
  type: string;
  location: string;
  required: boolean;
  defaultValue: string;
  desc: string;
};

function ResponsePanel({ draft, onChange }: { draft: MockApiPayload; onChange: (d: MockApiPayload) => void }) {
  const [bodyText, setBodyText] = useState(() => safeStringify(draft.responseBody ?? {}));
  const [headersText, setHeadersText] = useState(() => safeStringify(draft.responseHeaders ?? {}));
  const [headersErr, setHeadersErr] = useState<string | null>(null);

  useEffect(() => {
    setBodyText(safeStringify(draft.responseBody ?? {}));
    setHeadersText(safeStringify(draft.responseHeaders ?? {}));
  }, [draft.responseBody, draft.responseHeaders]);

  const applyBody = () => {
    try {
      const parsed = JSON.parse(bodyText);
      onChange({ ...draft, responseBody: parsed });
    } catch {
      /* swallow */
    }
  };
  void applyBody;
  const applyHeaders = () => {
    try {
      const parsed = JSON.parse(headersText);
      setHeadersErr(null);
      onChange({ ...draft, responseHeaders: parsed as Record<string, string> });
    } catch (err) {
      setHeadersErr(err instanceof Error ? err.message : 'JSON 解析失败');
    }
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Check}
        title="响应配置"
        description="定义 Mock 接口如何响应外部请求：状态码、响应头、响应体、模拟延迟。"
      />

      <Card title="响应基本信息">
        <div className="form-row three-col">
          <FormField label="状态码">
            <Input
              type="number"
              value={draft.responseStatus ?? 200}
              onChange={(e) => onChange({ ...draft, responseStatus: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="响应延迟" hint="毫秒">
            <Input
              type="number"
              value={draft.responseDelay ?? 0}
              onChange={(e) => onChange({ ...draft, responseDelay: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="延迟类型">
            <Select defaultValue="fixed">
              <option value="fixed">固定延迟</option>
              <option value="range">随机范围（如 500-1500）</option>
            </Select>
          </FormField>
        </div>
        <FormField label="响应头" hint="可自定义">
          <Textarea className="mono" rows={3} value={headersText} onChange={(e) => setHeadersText(e.target.value)} />
          {headersErr && <div className="mt-1 text-[11px] text-danger">{headersErr}</div>}
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="secondary" onClick={applyHeaders}>
              <Check className="h-3 w-3" />
              应用
            </Button>
          </div>
        </FormField>
      </Card>

      <Card
        title={
          <>
            响应体 <span className="font-normal text-ink-subtle">· 支持变量插值</span>
          </>
        }
        extra={
          <div className="flex gap-3.5 text-[12px]">
            <span className="tool-link">格式化</span>
            <span className="tool-link">预览</span>
            <span className="tool-link">复制</span>
          </div>
        }
      >
        <div className="info-tip">
          <AlertCircle />
          <div>
            支持变量：<code>{'{{req.body.xxx}}'}</code> 请求体、<code>{'{{req.query.xxx}}'}</code> 查询参数、<code>{'{{global.xxx}}'}</code> 全局变量
          </div>
        </div>
        <CodeBlock
          className="mt-2.5"
          language="JSON"
          tabs={
            <>
              <code style={{ color: '#C4B5FD' }}>{'{{req.body.*}}'}</code>
              <code style={{ color: '#86EFAC' }}>{'{{req.query.*}}'}</code>
              <code style={{ color: '#F0ABFC' }}>{'{{global.*}}'}</code>
            </>
          }
        >
          <span className="com">// 立即返回"受理成功"，回调任务在 5 秒后推送识别结果</span>
          {'\n'}
          <span className="brkt">{'{'}</span>
          {'\n  '}
          <span className="key">"code"</span>: <span className="num">0</span>,
          {'\n  '}
          <span className="key">"message"</span>: <span className="str">"受理成功，人脸注册任务已创建"</span>,
          {'\n  '}
          <span className="key">"data"</span>: <span className="brkt">{'{'}</span>
          {'\n    '}
          <span className="key">"requestId"</span>: <span className="str">{'"{{req.body.requestId}}"'}</span>,
          {'\n    '}
          <span className="key">"faceId"</span>: <span className="str">{`"face_{{req.body.requestId}}"`}</span>,
          {'\n    '}
          <span className="key">"estimatedSeconds"</span>: <span className="num">5</span>,
          {'\n    '}
          <span className="key">"callbackUrl"</span>: <span className="str">{'"{{req.body.callbackUrl}}"'}</span>
          {'\n  '}
          <span className="brkt">{'}'}</span>
          {'\n'}
          <span className="brkt">{'}'}</span>
        </CodeBlock>
      </Card>

      <PanelActions left="下次请求生效" />
    </div>
  );
}

function ValidatePanel({ draft: _draft, onChange: _onChange }: { draft: MockApiPayload; onChange: (d: MockApiPayload) => void }) {
  const [rules] = useState([
    { param: 'name', rule: '必填 + string + 长度 1-50', code: '400', message: '参数 name 不能为空' },
    { param: 'imageUrl', rule: '必填 + 合法 URL', code: '400', message: 'imageUrl 必须为合法的 URL 地址' },
    { param: 'imageUrl', rule: '正则：^https://', code: '400', message: 'imageUrl 必须使用 HTTPS 协议' },
  ]);

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Shield}
        title="参数校验"
        description="为请求参数配置校验规则。校验失败时返回自定义错误响应：状态码、错误信息、错误详情。"
      />

      <Card
        title={
          <>
            校验规则 <span className="font-normal text-ink-subtle">· {rules.length} 条规则</span>
          </>
        }
        noBody
        extra={
          <span className="add-link">
            <Plus className="h-3 w-3" />
            添加规则
          </span>
        }
      >
        <table className="params-table">
          <thead>
            <tr>
              <th>参数</th>
              <th>规则</th>
              <th style={{ width: 80 }}>错误码</th>
              <th>错误信息模板</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={i}>
                <td>
                  <span className="param-code">{r.param}</span>
                </td>
                <td>
                  <select className="table-input">
                    <option>{r.rule}</option>
                  </select>
                </td>
                <td>
                  <input className="table-input mono" defaultValue={r.code} />
                </td>
                <td>
                  <input className="table-input" defaultValue={r.message} />
                </td>
                <td>
                  <button className="border-none bg-transparent text-ink-subtle hover:text-ink">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="校验失败时的默认响应">
        <div className="form-row">
          <FormField label="HTTP 状态码">
            <Select defaultValue="400">
              <option>400 Bad Request</option>
              <option>422 Unprocessable Entity</option>
              <option>500 Server Error</option>
            </Select>
          </FormField>
          <FormField label="业务错误码">
            <Input className="mono" defaultValue="40001" />
          </FormField>
        </div>
        <FormField label="错误响应体">
          <CodeBlock language="JSON">
            <span className="brkt">{'{'}</span>
            {'\n  '}
            <span className="key">"code"</span>: <span className="num">40001</span>,
            {'\n  '}
            <span className="key">"message"</span>: <span className="str">{'"参数校验失败：{{errorMessage}}"'}</span>,
            {'\n  '}
            <span className="key">"errors"</span>: <span className="brkt">{'['}</span>
            {'\n    '}
            <span className="brkt">{'{'}</span> <span className="key">"field"</span>: <span className="str">{'"{{field}}"'}</span>, <span className="key">"rule"</span>: <span className="str">{'"{{rule}}"'}</span> <span className="brkt">{'}'}</span>
            {'\n  '}
            <span className="brkt">{']'}</span>
            {'\n'}
            <span className="brkt">{'}'}</span>
          </CodeBlock>
        </FormField>
      </Card>

      <PanelActions left={undefined} />
    </div>
  );
}

function CallbackPanel({ draft: _draft, onChange: _onChange }: { draft: MockApiPayload; onChange: (d: MockApiPayload) => void }) {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Send}
        title="延迟回调"
        action={
          <div className="ml-auto">
            <Switch checked={enabled} onChange={setEnabled} />
          </div>
        }
        description="启用后，接口响应后会自动按设定延迟向回调 URL 发送请求。常用于模拟支付、识别等异步通知。"
      />

      <div className="info-tip dark">
        <AlertCircle />
        <div>
          支持 <code>{'{{req.body.xxx}}'}</code> 动态提取 URL；请求体支持 <code>{'{{request.*}}'}</code>、<code>{'{{response.*}}'}</code>
        </div>
      </div>

      <Card className="mt-3" title="回调请求">
        <div className="form-row">
          <FormField label="回调 URL" required className="col-span-2">
            <Input className="mono" defaultValue="{{req.body.callbackUrl}}" />
            <div className="form-helper">
              支持变量替换，例 <code>{'{{req.body.callbackUrl}}'}</code> 或固定 URL
            </div>
          </FormField>
          <FormField label="回调方法">
            <Select defaultValue="POST">
              <option>POST</option>
              <option>GET</option>
              <option>PUT</option>
              <option>PATCH</option>
            </Select>
          </FormField>
        </div>

        <div className="form-row three-col">
          <FormField label="延迟类型">
            <Select defaultValue="fixed">
              <option>固定</option>
              <option>随机范围</option>
            </Select>
          </FormField>
          <FormField label="延迟时间" hint="毫秒">
            <Input defaultValue="5000" />
          </FormField>
          <FormField label="超时" hint="毫秒">
            <Input defaultValue="10000" />
          </FormField>
        </div>

        <FormField label="回调请求头">
          <Textarea
            className="mono"
            rows={3}
            defaultValue={`{
  "Content-Type": "application/json",
  "X-Callback-Event": "face.recognized",
  "Authorization": "Bearer mock_token"
}`}
          />
        </FormField>

        <FormField label="回调请求体">
          <CodeBlock
            language="JSON"
            tabs={
              <>
                <code>{'{{request.*}}'}</code>
                <code>{'{{response.*}}'}</code>
              </>
            }
          >
            <span className="brkt">{'{'}</span>
            {'\n  '}
            <span className="key">"requestId"</span>: <span className="str">{'"{{request.body.requestId}}"'}</span>,
            {'\n  '}
            <span className="key">"code"</span>: <span className="num">0</span>,
            {'\n  '}
            <span className="key">"message"</span>: <span className="str">"success"</span>,
            {'\n  '}
            <span className="key">"data"</span>: <span className="brkt">{'{'}</span>
            {'\n    '}
            <span className="key">"faceId"</span>: <span className="str">"face_1234567890"</span>,
            {'\n    '}
            <span className="key">"similarity"</span>: <span className="num">98.5</span>,
            {'\n    '}
            <span className="key">"livenessScore"</span>: <span className="num">0.96</span>,
            {'\n    '}
            <span className="key">"completedAt"</span>: <span className="str">"2026-07-06T13:35:42Z"</span>
            {'\n  '}
            <span className="brkt">{'}'}</span>
            {'\n'}
            <span className="brkt">{'}'}</span>
          </CodeBlock>
        </FormField>
      </Card>

      <Card
        title="重试策略"
        extra={<Switch checked={true} onChange={() => {}} />}
      >
        <div className="form-row three-col">
          <FormField label="最大重试次数">
            <Input defaultValue="3" />
          </FormField>
          <FormField label="重试间隔" hint="毫秒">
            <Input defaultValue="5000" />
          </FormField>
          <FormField label="重试策略">
            <Select defaultValue="exp">
              <option>指数退避</option>
              <option>固定间隔</option>
            </Select>
          </FormField>
        </div>
      </Card>

      <PanelActions left="回调任务在「回调任务」页面管理" />
    </div>
  );
}

function DataLinkPanel({ draft, onChange }: { draft: MockApiPayload; onChange: (d: MockApiPayload) => void }) {
  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Link2}
        title="数据联动"
        action={
          <div className="ml-auto">
            <Switch checked={(draft.dataOp ?? 'none') !== 'none'} onChange={(v) => onChange({ ...draft, dataOp: v ? 'select' : 'none' })} />
          </div>
        }
        description="将接口与业务表（自动建表）打通：可对请求做数据查询、写入、更新、删除，并把结果回填到响应。"
      />

      <Card title="数据源配置">
        <div className="form-row">
          <FormField label="操作类型">
            <Select
              value={draft.dataOp ?? 'none'}
              onChange={(e) => onChange({ ...draft, dataOp: e.target.value as MockApiPayload['dataOp'] })}
            >
              {DATA_OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="业务表名"
            hint={
              draft.dataOp === 'insert'
                ? '若表不存在，会按请求 body 自动建表'
                : draft.dataOp === 'none'
                ? '暂不联动'
                : '可参照已建表'
            }
          >
            <Input
              className="mono"
              value={draft.dataTable ?? ''}
              onChange={(e) => onChange({ ...draft, dataTable: e.target.value || null })}
              placeholder="例如 face_data"
              disabled={draft.dataOp === 'none'}
            />
          </FormField>
        </div>

        <FormField label="where 条件" hint="JSON 格式；path 参数自动注入" className="col-span-2">
          <JsonField
            value={(draft.dataWhere as Record<string, unknown> | null) ?? {}}
            onChange={(v) => onChange({ ...draft, dataWhere: v as Record<string, unknown> })}
            placeholder='{"status":"active"}'
          />
        </FormField>
      </Card>

      <div className="mt-3 rounded-md border border-line bg-canvas-subtle/40 p-3 text-[11px] text-ink-tertiary">
        <b>提示：</b>
        <ul className="ml-4 mt-1 list-disc space-y-0.5">
          <li>insert：用请求 body 作为待插入数据</li>
          <li>select / delete：以 path 参数 + where 条件作为查询条件</li>
          <li>update：以 path 参数 + where 定位，body 作为 patch</li>
        </ul>
      </div>

      <PanelActions left="数据查看请前往「数据管理」" />
    </div>
  );
}

function ScriptPanel({ draft: _draft, onChange: _onChange }: { draft: MockApiPayload; onChange: (d: MockApiPayload) => void }) {
  const [enabled, setEnabled] = useState(true);
  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Code2}
        title="自定义脚本"
        action={<div className="ml-auto"><Switch checked={enabled} onChange={setEnabled} /></div>}
        description="使用 JavaScript 编写自定义响应逻辑。可访问 req（请求）、global（全局变量）、db（数据联动）等内置对象。"
      />

      <Card
        title="脚本编辑器"
        extra={
          <div className="flex gap-3.5 text-[12px]">
            <span className="tool-link">格式化</span>
            <span className="tool-link">清空</span>
            <span className="tool-link">示例</span>
          </div>
        }
      >
        <CodeBlock
          language="JavaScript"
          tabs={
            <>
              <code>req.*</code>
              <code>db.*</code>
              <code>global.*</code>
            </>
          }
        >
          <span className="com">// 在此处编写响应前的处理逻辑</span>
          {'\n'}
          <span className="com">// 返回对象将作为最终响应体</span>
          {'\n\n'}
          <span className="kw">async function</span> <span className="fn">handle</span>(req) {'{'}
          {'\n  '}
          <span className="kw">const</span> {'{ name, imageUrl }'} = req.body;
          {'\n  '}
          <span className="kw">if</span> (!name || !imageUrl) {'{'}
          {'\n    '}
          <span className="kw">throw new</span> <span className="fn">Error</span>(<span className="str">'参数不完整'</span>);
          {'\n  '}
          {'}'}
          {'\n\n  '}
          <span className="kw">return</span> {'{'}
          {'\n    '}
          code: <span className="num">0</span>,
          {'\n    '}
          message: <span className="str">'success'</span>,
          {'\n    '}
          data: {'{'}
          {'\n      '}
          faceId: <span className="str">`face_${'{'}Date.now(){'}'}`</span>,
          {'\n      '}
          createdAt: <span className="kw">new</span> <span className="fn">Date</span>().<span className="fn">toISOString</span>(),
          {'\n    '}
          {'}'}
          {'\n  '}
          {'};'}
          {'\n'}
          {'}'}
        </CodeBlock>
      </Card>

      <PanelActions left="脚本异常时返回 500" />
    </div>
  );
}

function TestPanel({ api, onRun }: { api: MockApi; onRun: (input: any) => Promise<any> }) {
  const [path, setPath] = useState(api.path);
  const [bodyText, setBodyText] = useState('{\n  "name": "张三",\n  "imageUrl": "https://example.com/face.jpg"\n}');
  const [headersText, setHeadersText] = useState('{}');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    setResult(null);
    try {
      const body = bodyText.trim() ? JSON.parse(bodyText) : undefined;
      const headers = headersText.trim() ? JSON.parse(headersText) : undefined;
      setRunning(true);
      const r = await onRun({ path, body, headers });
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '运行失败');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={TestTube}
        title="在线测试"
        description="在保存前即可发起测试调用：传入请求体 / 头部，查看 Mock 服务的实际响应。便于联调前快速验证。"
      />

      <Card title="请求参数">
        <FormField label="Path">
          <Input className="mono" value={path} onChange={(e) => setPath(e.target.value)} />
        </FormField>
        {api.method !== 'GET' && (
          <FormField label="Body (JSON)">
            <Textarea className="mono" rows={6} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
          </FormField>
        )}
        <FormField label="Headers (JSON)">
          <Textarea className="mono" rows={4} value={headersText} onChange={(e) => setHeadersText(e.target.value)} />
        </FormField>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" onClick={run} loading={running}>
            <Play className="h-3.5 w-3.5" />
            发送
          </Button>
        </div>
      </Card>

      {err && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[12px] text-danger">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {result && (
        <Card
          className="mt-3"
          title="响应"
          extra={
            <div className="flex items-center gap-3 text-[12px]">
              <span className="status-badge status-success">{result.responseStatus} OK</span>
              <span className="text-ink-tertiary">{result.responseHeaders && Object.keys(result.responseHeaders).length} headers</span>
            </div>
          }
        >
          <pre className="code-content !rounded-b-md !mt-0">
            {JSON.stringify(result.responseBody, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}

function JsonField({
  value,
  onChange,
  placeholder,
}: {
  value: Record<string, unknown> | unknown[];
  onChange: (v: Record<string, unknown> | unknown[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => safeStringify(value));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setText(safeStringify(value));
  }, [value]);
  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      setErr(null);
      onChange(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '解析失败');
    }
  };
  return (
    <>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="mono !text-[12.5px]"
        placeholder={placeholder}
        invalid={!!err}
      />
      {err && <div className="mt-1 text-[11px] text-danger">{err}</div>}
      <div className="mt-1 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setText(prettyJson(text))}>
          格式化
        </Button>
        <Button size="sm" variant="secondary" onClick={apply}>
          应用
        </Button>
      </div>
    </>
  );
}

// ---------- Helpers ----------
function newDraft(): MockApiPayload {
  return {
    name: '',
    description: null,
    method: 'POST',
    path: '/',
    isEnabled: true,
    sortOrder: 0,
    responseStatus: 200,
    responseDelay: 0,
    responseDelayMax: 0,
    responseContentType: 'application/json',
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: { code: 0, message: 'success', data: {} },
    validationRules: {},
    dataOp: 'none',
    dataTable: null,
    dataWhere: {},
    script: null,
  };
}

function apiToDraft(api: MockApi): MockApiPayload {
  return {
    name: api.name,
    description: api.description,
    method: api.method,
    path: api.path,
    isEnabled: api.isEnabled,
    sortOrder: api.sortOrder,
    responseStatus: api.responseStatus,
    responseDelay: api.responseDelay,
    responseDelayMax: api.responseDelayMax,
    responseContentType: api.responseContentType,
    responseHeaders: api.responseHeaders,
    responseBody: api.responseBody,
    validationRules: api.validationRules,
    dataOp: api.dataOp,
    dataTable: api.dataTable,
    dataWhere: api.dataWhere,
    script: api.script,
  };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function formatApiError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : '操作失败';
}
