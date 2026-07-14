import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FolderTree,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Empty,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
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
import { useCallbackStats } from '@/hooks/queries/use-callback-tasks';
import type { Project } from '@/types/api';
import { AgentsGuideModal } from '@/components/AgentsGuideModal';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const { data: callbackStats } = useCallbackStats();
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

  const stats = useMemo(() => {
    if (!projects) return { projects: 0, apis: 0, calls: 0, pending: 0 };
    return {
      projects: projects.length,
      apis: projects.reduce((sum, p) => sum + (p.apiCount ?? 0), 0),
      calls: projects.reduce((sum, p) => sum + (p.callCount ?? 0), 0),
      pending: callbackStats?.pending ?? 0,
    };
  }, [projects, callbackStats]);

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
            <Button variant="secondary" onClick={() => setAgentsGuideOpen(true)}>
              <Sparkles className="h-3.5 w-3.5" />
              AGENTS 对接指南
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              导入项目
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              新建项目
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="项目总数"
          value={stats.projects}
          hint={`+1 本月`}
          trend="up"
          icon={<LayoutGrid />}
        />
        <StatCard label="Mock 接口" value={stats.apis} hint="+12 本周" trend="up" icon={<Zap />} />
        <StatCard label="今日调用" value={stats.calls} hint="" icon={<Activity />} />
        <StatCard label="待发回调" value={stats.pending} hint="— 无变化" icon={<Clock />} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <Tabs<'all' | 'recent' | 'pinned'>
          variant="pill"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: `全部项目 · ${stats.projects}` },
            { value: 'recent', label: '最近访问 · 3' },
            { value: 'pinned', label: '已置顶 · 2' },
          ]}
        />
        <div className="flex items-center gap-2">
          <select
            className="form-select w-auto min-w-[120px] text-[12px]"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="updated">按修改时间</option>
            <option value="created">按创建时间</option>
            <option value="name">按名称</option>
          </select>
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
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      className="group relative cursor-pointer rounded-lg border border-line bg-white p-[18px] transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg"
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
      className="flex min-h-[222px] flex-col items-center justify-center rounded-lg border-[1.5px] border-dashed border-line-strong bg-transparent p-[18px] text-ink-tertiary transition-all hover:border-ink hover:bg-white hover:text-ink"
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

function ProjectImportModal({ onClose }: { onClose: () => void }) {
  const importMut = useImportProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<ProjectExportBundle | null>(null);
  const [mode, setMode] = useState<ProjectImportMode>('create');
  const [name, setName] = useState('');
  const [parseErr, setParseErr] = useState<string | null>(null);

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as ProjectExportBundle;
      if (json.version !== 1 || !json.project?.name) {
        setParseErr('无效的导出文件：需要 version=1 且包含 project.name');
        setBundle(null);
        return;
      }
      setParseErr(null);
      setBundle(json);
      setName(json.project.name);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : 'JSON 解析失败');
      setBundle(null);
    }
  };

  const submit = async () => {
    if (!bundle) {
      setParseErr('请先选择导出文件');
      return;
    }
    try {
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
      toast.error(err instanceof Error ? err.message : '导入失败');
    }
  };

  const groupCount = bundle?.featureGroups?.length ?? 0;

  return (
    <Modal
      open
      onClose={onClose}
      title="导入项目"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            loading={importMut.isPending}
            disabled={!bundle}
            onClick={submit}
          >
            导入
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          label="导出文件"
          hint="MockHub 项目 JSON（version=1）"
          error={parseErr ?? undefined}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="block w-full text-[12.5px] text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-canvas-subtle file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-ink"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </FormField>
        {bundle && (
          <div className="rounded-md border border-line bg-canvas-subtle/50 px-3 py-2 text-[12px] text-ink-secondary">
            <div>
              原项目：<b className="text-ink">{bundle.project.name}</b>
            </div>
            <div>
              功能组 {groupCount} · 导出时间{' '}
              {bundle.exportedAt ? new Date(bundle.exportedAt).toLocaleString() : '—'}
            </div>
          </div>
        )}
        <FormField label="导入后项目名">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="可改名后导入"
            maxLength={100}
          />
        </FormField>
        <FormField label="同名冲突策略" hint="create=报错 · skip=跳过 · overwrite=覆盖重建">
          <Select value={mode} onChange={(e) => setMode(e.target.value as ProjectImportMode)}>
            <option value="create">创建（名称冲突则失败）</option>
            <option value="skip">跳过（已存在则不动）</option>
            <option value="overwrite">覆盖（删除同名后重建）</option>
          </Select>
        </FormField>
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
