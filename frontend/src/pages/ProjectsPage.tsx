import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  FolderTree,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Zap,
  Upload,
  UploadCloud,
  FileText,
  X,
  AlertTriangle,
  Check,
  RefreshCw,
  SkipForward,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Empty,
  FormField,
  Input,
  MethodBadge,
  Modal,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  confirm,
} from '@/components/ui';
import {
  exportProjectBundle,
  useCreateProject,
  useDeleteProject,
  useImportProject,
  useProjects,
  useUpdateProject,
  type ProjectExportBundle,
  type ProjectImportMode,
} from '@/hooks/queries/use-projects';
import { ApiError } from '@/lib/api';
import type { HttpMethod, Project } from '@/types/api';
import { AgentsGuideModal } from '@/components/AgentsGuideModal';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const deleteMut = useDeleteProject();
  const [tab, setTab] = useState<'all' | 'recent' | 'pinned'>('all');
  const [sort, setSort] = useState<'updated' | 'created' | 'name'>('updated');
  const [search] = useState('');
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [agentsGuideOpen, setAgentsGuideOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = search.trim().toLowerCase();
    let list = projects;
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q),
      );
    }
    if (tab === 'recent') {
      list = [...list]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3);
    } else if (tab === 'pinned') {
      list = list.filter((p) => (p.apiCount ?? 0) > 0).slice(0, 2);
    }
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'created')
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list;
  }, [projects, search, tab, sort]);

  const handleDelete = async (p: Project) => {
    const ok = await confirm({
      title: '删除项目',
      message: (
        <span>
          确定删除 <b>{p.name}</b> 吗？该操作会级联删除其下所有功能组、接口与 Mock
          数据，且不可恢复。
        </span>
      ),
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(p.id);
      toast.success(`项目 "${p.name}" 已删除`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="我的项目"
        description="管理所有 Mock 项目，按业务系统隔离组织"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              导入项目
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              新建项目
            </Button>
          </>
        }
      />

      <button
        type="button"
        onClick={() => setAgentsGuideOpen(true)}
        className="gold-banner group mb-5 flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
      >
        <span aria-hidden className="gold-banner-decor">
          <span className="gold-spark gold-spark-1" />
          <span className="gold-spark gold-spark-2" />
          <span className="gold-spark gold-spark-3" />
          <span className="gold-spark gold-spark-4" />
          <span className="gold-spark gold-spark-5" />
          <span className="gold-spark gold-spark-6" />
          <span className="gold-spark gold-spark-7" />
        </span>
        <span className="gold-icon relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-md animate-gold-breath">
          <Sparkles className="h-4 w-4 animate-gold-twinkle" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="gold-text text-[14px] font-bold tracking-[-0.005em]">
              AGENTS 对接指南
            </span>
            <span className="gold-tag animate-gold-glow">推荐</span>
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-violet-900/80">
            把提示词交给 AI，一键生成可导入的完整 Mock 项目包（含接口 / 回调 / 脚本）
          </span>
        </span>
        <span className="relative flex flex-shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[12px] font-semibold text-violet-900 ring-1 ring-violet-300/60 transition-all group-hover:translate-x-0.5 group-hover:bg-violet-200">
          查看指南
          <ChevronRight className="h-3.5 w-3.5 animate-gold-nudge" />
        </span>
      </button>

      <div className="mb-3 flex items-center justify-between">
        <Tabs<'all' | 'recent' | 'pinned'>
          variant="pill"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: `全部项目 · ${projects?.length ?? 0}` },
            { value: 'recent', label: '最近访问 · 3' },
            { value: 'pinned', label: '已置顶 · 2' },
          ]}
        />
        <div className="flex items-center gap-2">
          <Select
            compact
            className="w-auto min-w-[120px]"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="updated">按修改时间</option>
            <option value="created">按创建时间</option>
            <option value="name">按名称</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <div className="py-12 text-center text-[13px] text-ink-tertiary">加载中...</div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty
            title={search || tab !== 'all' ? '没有匹配的项目' : '还没有项目'}
            description={
              search || tab !== 'all'
                ? '试试调整搜索关键字或切换标签'
                : '创建第一个项目开始你的 Mock 之旅'
            }
            action={
              !search &&
              tab === 'all' && (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <Plus className="h-3.5 w-3.5" /> 新建项目
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => navigate(`/projects/${p.id}`)}
              onEdit={() => setEditing(p)}
              onDelete={() => handleDelete(p)}
              onExport={async () => {
                try {
                  const bundle = await exportProjectBundle(p.id, { includeData: true });
                  downloadJson(`${p.name}-export.json`, bundle);
                  toast.success(`已导出「${p.name}」`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : '导出失败');
                }
              }}
            />
          ))}
          <CreateCard onClick={() => setCreating(true)} />
        </div>
      )}

      {creating && <ProjectEditModal mode="create" onClose={() => setCreating(false)} />}
      {editing && (
        <ProjectEditModal mode="edit" project={editing} onClose={() => setEditing(null)} />
      )}
      {importOpen && <ProjectImportModal onClose={() => setImportOpen(false)} />}
      <AgentsGuideModal open={agentsGuideOpen} onClose={() => setAgentsGuideOpen(false)} />
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onEdit,
  onDelete,
  onExport,
}: {
  project: Project;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer rounded-lg border border-line bg-canvas-elevated p-[18px] transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg"
    >
      <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.015em] text-ink">
        {project.name}
        {(project.apiCount ?? 0) > 0 && <Star className="h-3 w-3 fill-current text-ink-subtle" />}
      </div>
      <p className="mb-3.5 line-clamp-2 min-h-[38px] text-[12.5px] leading-[1.55] text-ink-tertiary">
        {project.description || '暂无描述'}
      </p>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-ink bg-ink px-2 py-0.5 text-[11px] font-medium text-ink-inverse">
          <FolderTree className="h-2.5 w-2.5" />
          {project.featureGroupCount ?? 0} 功能组
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas-subtle px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
          <Zap className="h-2.5 w-2.5" />
          {project.apiCount ?? 0} 接口
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas-subtle px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
          <TrendingUp className="h-2.5 w-2.5" />
          {project.callCount ?? 0} 次
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-line-subtle pt-3">
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle before:block before:h-1 before:w-1 before:rounded-full before:bg-success before:content-['']">
          {formatRelative(project.updatedAt)}更新
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExport();
            }}
            className="grid h-7 w-7 place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
            title="导出 JSON"
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="grid h-7 w-7 place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
            title="编辑"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="grid h-7 w-7 place-items-center rounded text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="grid h-7 w-7 place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
            title="更多"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[222px] flex-col items-center justify-center rounded-lg border-[1.5px] border-dashed border-line-strong bg-transparent p-[18px] text-ink-tertiary transition-all hover:border-ink hover:bg-canvas-elevated hover:text-ink"
    >
      <Plus className="mb-3 h-7 w-7" strokeWidth={1.5} />
      <span className="text-[13px] font-medium">新建项目</span>
    </button>
  );
}

type ModalMode = 'create' | 'edit';

function ProjectEditModal({
  mode,
  project,
  onClose,
}: {
  mode: ModalMode;
  project?: Project;
  onClose: () => void;
}) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const createMut = useCreateProject();
  const updateMut = useUpdateProject();

  const submit = async () => {
    if (!name.trim()) {
      setNameError('项目名不能为空');
      return;
    }
    setNameError(null);
    try {
      if (mode === 'create') {
        await createMut.mutateAsync({ name: name.trim(), description: description.trim() || null });
        toast.success('项目创建成功');
      } else if (project) {
        await updateMut.mutateAsync({
          id: project.id,
          data: { name: name.trim(), description: description.trim() || null },
        });
        toast.success('项目已更新');
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? '新建项目' : '编辑项目'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            loading={createMut.isPending || updateMut.isPending}
            onClick={submit}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="项目名称" required error={nameError ?? undefined}>
          <Input
            placeholder="例如：人脸识别演示"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!nameError}
            maxLength={100}
          />
        </FormField>
        <FormField label="描述" hint="选填，帮助团队成员理解项目用途">
          <Textarea
            placeholder="一段简短描述..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </FormField>
      </div>
    </Modal>
  );
}

const IMPORT_MODES: {
  value: ProjectImportMode;
  label: string;
  desc: string;
  icon: typeof Check;
  danger?: boolean;
}[] = [
  {
    value: 'create',
    label: '创建新项目',
    desc: '名称冲突时失败，最安全',
    icon: Check,
  },
  {
    value: 'skip',
    label: '跳过',
    desc: '已存在同名则不动',
    icon: SkipForward,
  },
  {
    value: 'overwrite',
    label: '覆盖重建',
    desc: '删除同名后重新导入',
    icon: RefreshCw,
    danger: true,
  },
];

type PathConflict = {
  method: string;
  path: string;
  apis: Array<{ name: string; group: string }>;
};

type ImportRouteItem = {
  method: string;
  path: string;
  detail: string;
};

type ImportAlert = {
  title: string;
  description?: string;
  tips?: string[];
  routes?: ImportRouteItem[];
};

/** 包内启用接口的 method+path 完全重复 */
function findInternalPathConflicts(bundle: ProjectExportBundle): PathConflict[] {
  type Item = { method: string; path: string; name: string; group: string };
  const byKey = new Map<string, Item[]>();

  for (const g of bundle.featureGroups ?? []) {
    const group = g as { name?: string; apis?: Array<Record<string, unknown>> };
    const groupName = typeof group.name === 'string' ? group.name : '';
    for (const a of group.apis ?? []) {
      if (a.isEnabled === false) continue;
      const method = typeof a.method === 'string' ? a.method : '';
      const path = typeof a.path === 'string' ? a.path : '';
      if (!method || !path) continue;
      const key = `${method}\0${path}`;
      const list = byKey.get(key) ?? [];
      list.push({
        method,
        path,
        name: typeof a.name === 'string' && a.name ? a.name : path,
        group: groupName,
      });
      byKey.set(key, list);
    }
  }

  return [...byKey.values()]
    .filter((list) => list.length > 1)
    .map((list) => ({
      method: list[0]!.method,
      path: list[0]!.path,
      apis: list.map((a) => ({ name: a.name, group: a.group })),
    }));
}

function internalConflictsToAlert(conflicts: PathConflict[]): ImportAlert {
  return {
    title: `包内路由冲突 · ${conflicts.length} 处`,
    description:
      '同一导出包里，启用接口的 method + path 不能完全相同，否则 Mock 引擎无法区分请求。',
    tips: [
      '修改 JSON 中重复接口的 path，或关闭多余接口的 isEnabled',
      '确认无重复后再重新选择文件导入',
    ],
    routes: conflicts.map((c) => ({
      method: c.method,
      path: c.path,
      detail: c.apis.map((a) => (a.group ? `${a.group} / ${a.name}` : a.name)).join('  ·  '),
    })),
  };
}

function errorToImportAlert(err: unknown): ImportAlert {
  if (err instanceof ApiError) {
    if (err.code === 'ROUTE_CONFLICT') {
      const details = err.details as
        | {
            kind?: 'internal' | 'external';
            conflicts?: Array<Record<string, unknown>>;
          }
        | undefined;

      if (details?.kind === 'internal' && Array.isArray(details.conflicts)) {
        const routes: ImportRouteItem[] = details.conflicts.map((c) => {
          const apis = Array.isArray(c.apis)
            ? (c.apis as Array<{ name?: string; group?: string }>)
                .map((a) => (a.group ? `${a.group} / ${a.name ?? '?'}` : (a.name ?? '?')))
                .join('  ·  ')
            : '';
          return {
            method: String(c.method ?? ''),
            path: String(c.path ?? ''),
            detail: apis || '包内重复',
          };
        });
        return {
          title: `包内路由冲突 · ${routes.length} 处`,
          description: '导出包内存在 method + path 完全相同的启用接口，无法导入。',
          tips: ['修改 JSON 中重复接口的 path，或将多余接口设为 isEnabled: false'],
          routes,
        };
      }

      if (details?.kind === 'external' && Array.isArray(details.conflicts)) {
        const routes: ImportRouteItem[] = details.conflicts.map((c) => ({
          method: String(c.method ?? ''),
          path: String(c.path ?? ''),
          detail: `导入「${String(c.importName ?? '')}」与已有 #${String(c.existingId ?? '')}「${String(c.existingName ?? '')}」冲突`,
        }));
        return {
          title: `与现有路由冲突 · ${routes.length} 处`,
          description: '导入接口的 method + path 与系统中已启用的接口完全相同，会互相抢流量。',
          tips: [
            '修改导入包中的 path，或先禁用/删除已有冲突接口',
            '若是覆盖同名项目，请选择「覆盖重建」策略',
          ],
          routes,
        };
      }

      return {
        title: '路由冲突',
        description: err.message,
        tips: ['请调整 path，或禁用已有冲突接口后再试'],
      };
    }

    if (err.code === 'CONFLICT') {
      return {
        title: '项目名已存在',
        description: err.message,
        tips: ['修改上方「导入后项目名」', '或改用「跳过 / 覆盖重建」策略'],
      };
    }

    if (err.code === 'INVALID_EXPORT') {
      return {
        title: '导出文件无效',
        description: err.message,
        tips: ['请确认文件来自 MockHub 导出，或符合 AGENTS 对接指南格式'],
      };
    }

    return {
      title: '导入失败',
      description: err.message,
    };
  }

  return {
    title: '导入失败',
    description: err instanceof Error ? err.message : '未知错误',
  };
}

function ImportAlertPanel({ alert }: { alert: ImportAlert }) {
  return (
    <div className="overflow-hidden rounded-lg border border-danger-border bg-danger-soft">
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-canvas-elevated/80 text-danger">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-danger">{alert.title}</div>
          {alert.description && (
            <p className="mt-1 text-[12px] leading-relaxed text-danger/90">{alert.description}</p>
          )}
        </div>
      </div>

      {alert.routes && alert.routes.length > 0 && (
        <div className="border-t border-danger-border/60 bg-canvas-elevated/70 px-3 py-2.5">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-danger/70">
            冲突路由
          </div>
          <ul className="max-h-44 space-y-2 overflow-auto scrollbar-modern">
            {alert.routes.map((r, i) => (
              <li
                key={`${r.method}:${r.path}:${i}`}
                className="rounded-md border border-line bg-canvas-elevated px-2.5 py-2 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <MethodBadge method={(r.method as HttpMethod) || 'GET'} />
                  <code className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
                    {r.path}
                  </code>
                </div>
                {r.detail && (
                  <p className="mt-1.5 pl-0.5 text-[11.5px] leading-snug text-ink-tertiary">
                    {r.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {alert.tips && alert.tips.length > 0 && (
        <div className="border-t border-danger-border/60 px-3.5 py-2.5">
          <div className="mb-1 text-[11px] font-medium text-danger/70">建议处理</div>
          <ul className="space-y-0.5 text-[12px] leading-relaxed text-danger/85">
            {alert.tips.map((tip) => (
              <li key={tip} className="flex gap-1.5">
                <span className="shrink-0 text-danger/50">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProjectImportModal({ onClose }: { onClose: () => void }) {
  const importMut = useImportProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<ProjectExportBundle | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [mode, setMode] = useState<ProjectImportMode>('create');
  const [name, setName] = useState('');
  const [alert, setAlert] = useState<ImportAlert | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pathConflicts = useMemo(() => (bundle ? findInternalPathConflicts(bundle) : []), [bundle]);

  const displayAlert = useMemo(() => {
    if (pathConflicts.length > 0) return internalConflictsToAlert(pathConflicts);
    return alert;
  }, [pathConflicts, alert]);

  const clearFile = () => {
    setBundle(null);
    setFileName('');
    setFileSize(0);
    setName('');
    setAlert(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setAlert({
        title: '文件过大',
        description: `当前 ${(file.size / 1024 / 1024).toFixed(1)} MB，最大支持 10 MB`,
        tips: ['请压缩或拆分导出包后再试'],
      });
      setBundle(null);
      setFileName('');
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text) as ProjectExportBundle;
      if ((json.version !== 1 && json.version !== 2) || !json.project?.name) {
        setAlert({
          title: '无效的导出文件',
          description: '需要 version 为 1 或 2，且包含 project.name 字段。',
          tips: [
            '请使用 MockHub「导出 JSON」生成的文件',
            '或按 AGENTS 对接指南让 AI 生成合法项目包',
          ],
        });
        setBundle(null);
        setFileName(file.name);
        setFileSize(file.size);
        return;
      }
      setAlert(null);
      setBundle(json);
      setFileName(file.name);
      setFileSize(file.size);
      setName(json.project.name);
    } catch (e) {
      setAlert({
        title: 'JSON 解析失败',
        description: e instanceof Error ? e.message : '无法读取该文件',
        tips: ['请确认文件是合法的 UTF-8 JSON 文本'],
      });
      setBundle(null);
      setFileName(file.name);
      setFileSize(file.size);
    }
  };

  const submit = async () => {
    if (!bundle) {
      setAlert({
        title: '尚未选择文件',
        description: '请先上传 MockHub 项目导出 JSON。',
      });
      return;
    }
    if (pathConflicts.length > 0) return;
    try {
      setAlert(null);
      const result = await importMut.mutateAsync({
        bundle,
        mode,
        name: name.trim() || undefined,
      });
      toast.success(
        `已导入「${result.projectName}」：${result.groups} 功能组 · ${result.apis} 接口`,
      );
      onClose();
    } catch (err) {
      const next = errorToImportAlert(err);
      setAlert(next);
      toast.error(next.title);
    }
  };

  const groupCount = bundle?.featureGroups?.length ?? 0;
  const apiCount = (bundle?.featureGroups ?? []).reduce<number>((sum, g) => {
    const apis = (g as { apis?: unknown[] })?.apis;
    return sum + (Array.isArray(apis) ? apis.length : 0);
  }, 0);

  return (
    <Modal
      open
      onClose={onClose}
      title="导入项目"
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            loading={importMut.isPending}
            disabled={!bundle || pathConflicts.length > 0}
            onClick={submit}
          >
            导入
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-md border border-line bg-canvas-subtle/40 px-3 py-2.5 text-[12px] leading-relaxed text-ink-tertiary">
          上传 MockHub 导出的项目 JSON（version 1 / 2），或从「AGENTS 对接指南」由 AI
          生成的项目包。导入后可立即调试全部接口。
        </div>

        <div
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void onFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          className={[
            'rounded-lg border-2 border-dashed px-6 py-9 text-center transition-colors',
            isDragging
              ? 'border-ink bg-canvas-subtle'
              : 'border-line bg-canvas-subtle/30 hover:border-ink-tertiary',
          ].join(' ')}
        >
          <UploadCloud className="mx-auto mb-3 h-8 w-8 text-ink-tertiary" />
          {fileName ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border border-line bg-canvas-elevated px-3 py-1.5 text-[12.5px] text-ink">
                <FileText className="h-3.5 w-3.5 shrink-0 text-ink-secondary" />
                <span className="max-w-[240px] truncate">{fileName}</span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="ml-1 text-ink-subtle hover:text-danger"
                  title="清除"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[11.5px] text-ink-subtle">
                {(fileSize / 1024).toFixed(1)} KB ·{' '}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-ink-secondary underline hover:text-ink"
                >
                  重新选择
                </button>
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-ink-secondary">拖拽项目 JSON 到此处，或</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 text-[13px] font-medium text-ink underline-offset-2 hover:underline"
              >
                点击选择文件
              </button>
              <p className="mt-2 text-[11.5px] text-ink-subtle">支持 .json 格式，最大 10 MB</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </div>

        {displayAlert && <ImportAlertPanel alert={displayAlert} />}

        {bundle && (
          <div className="overflow-hidden rounded-lg border border-line bg-canvas-elevated">
            <div className="flex items-start gap-3 border-b border-line-subtle px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-canvas-subtle text-ink">
                <FolderTree className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-ink">
                  {bundle.project.name}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-tertiary">
                  {bundle.project.description || '暂无描述'}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-line bg-canvas-subtle px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                v{bundle.version}
              </span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-line-subtle">
              <div className="px-4 py-2.5 text-center">
                <div className="text-[15px] font-semibold tabular-nums text-ink">{groupCount}</div>
                <div className="text-[11px] text-ink-subtle">功能组</div>
              </div>
              <div className="px-4 py-2.5 text-center">
                <div className="text-[15px] font-semibold tabular-nums text-ink">{apiCount}</div>
                <div className="text-[11px] text-ink-subtle">接口</div>
              </div>
              <div className="px-4 py-2.5 text-center">
                <div className="text-[12px] font-medium text-ink">
                  {bundle.exportedAt ? new Date(bundle.exportedAt).toLocaleDateString() : '—'}
                </div>
                <div className="text-[11px] text-ink-subtle">导出日期</div>
              </div>
            </div>
          </div>
        )}

        <FormField label="导入后项目名" hint="可改名后导入，避免与现有项目冲突">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="可改名后导入"
            maxLength={100}
            disabled={!bundle}
          />
        </FormField>

        <div>
          <div className="form-label mb-2">同名冲突策略</div>
          <div className="grid grid-cols-3 gap-2">
            {IMPORT_MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  disabled={!bundle}
                  onClick={() => setMode(m.value)}
                  className={[
                    'flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    active
                      ? m.danger
                        ? 'border-danger bg-danger-soft/40 ring-1 ring-danger/30'
                        : 'border-ink bg-canvas-subtle ring-1 ring-ink/20'
                      : 'border-line bg-canvas-elevated hover:border-ink-tertiary hover:bg-canvas-subtle/40',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={[
                        'h-3.5 w-3.5',
                        active ? (m.danger ? 'text-danger' : 'text-ink') : 'text-ink-tertiary',
                      ].join(' ')}
                    />
                    <span
                      className={[
                        'text-[12.5px] font-medium',
                        active ? (m.danger ? 'text-danger' : 'text-ink') : 'text-ink-secondary',
                      ].join(' ')}
                    >
                      {m.label}
                    </span>
                  </div>
                  <span className="text-[11px] leading-snug text-ink-subtle">{m.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return d.toLocaleDateString();
}
