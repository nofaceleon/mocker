import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  FolderOpen,
  Layers,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Search,
  SquareCheck,
  Trash2,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Dropdown,
  Empty,
  FormField,
  Input,
  MethodBadge,
  Modal,
  Select,
  Switch,
  Textarea,
  confirm,
  IconBtn,
  TagPill,
  type DropdownItem,
} from '@/components/ui';
import {
  useCreateFeatureGroup,
  useDeleteFeatureGroup,
  useFeatureGroups,
  useUpdateFeatureGroup,
} from '@/hooks/queries/use-feature-groups';
import {
  useDeleteMockApi,
  useMockApis,
  useToggleMockApi,
  useTestMockApi,
  type TestApiOutput,
} from '@/hooks/queries/use-mock-apis';
import { useProject } from '@/hooks/queries/use-projects';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/cn';
import type { FeatureGroup, MockApi } from '@/types/api';
import { SwaggerImportModal } from '@/components/SwaggerImportModal';
import { AgentsEditModal } from '@/components/AgentsEditModal';
import { buildMockRequestSample } from '@/lib/mock-request-sample';
import { copyToClipboard } from '@/lib/clipboard';

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const navigate = useNavigate();
  const { data: project } = useProject(pid);
  const { data: groups } = useFeatureGroups(pid);
  const selectedGroupId = useUiStore((s) => s.selectedFeatureGroupId);
  const setSelectedGroup = useUiStore((s) => s.setSelectedFeatureGroup);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [agentsEditOpen, setAgentsEditOpen] = useState(false);

  // 首次进入或组列表变化时，默认选中第一个
  useEffect(() => {
    if (!groups || groups.length === 0) {
      if (selectedGroupId !== null) setSelectedGroup(null);
      return;
    }
    const stillExists = groups.some((g) => g.id === selectedGroupId);
    if (!stillExists) setSelectedGroup(groups[0].id);
  }, [groups, selectedGroupId, setSelectedGroup]);

  const activeGroup = useMemo(
    () => groups?.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const [editingGroup, setEditingGroup] = useState<FeatureGroup | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);

  if (!project) {
    return (
      <div className="page-container">
        <Card>
          <Empty
            title="项目不存在"
            description="可能已被删除或链接错误"
            action={
              <Button variant="primary" onClick={() => navigate('/projects')}>
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                返回项目列表
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex" style={{ height: 'calc(100vh - 54px)' }}>
      <Sidebar
        project={project}
        groups={groups ?? []}
        selectedId={selectedGroupId}
        onSelect={(id) => setSelectedGroup(id)}
        onCreateGroup={() => setCreatingGroup(true)}
        onEditGroup={(g) => setEditingGroup(g)}
        search={sidebarSearch}
        setSearch={setSidebarSearch}
      />

      <main className="flex-1 overflow-y-auto bg-canvas">
        {activeGroup ? (
          <ApiListPanel
            projectId={pid}
            group={activeGroup}
            onCreateApi={() => navigate(`/projects/${pid}/apis/new?gid=${activeGroup.id}`)}
            onEditApi={(api) => navigate(`/projects/${pid}/apis/${api.id}`)}
            onOpenAgentsEdit={() => setAgentsEditOpen(true)}
          />
        ) : (
          <EmptyView
            title="未选择功能组"
            description="在左侧选择一个功能组以查看其下的 Mock 接口"
            onCreateGroup={() => setCreatingGroup(true)}
          />
        )}
      </main>

      {creatingGroup && (
        <FeatureGroupModal mode="create" projectId={pid} onClose={() => setCreatingGroup(false)} />
      )}
      {editingGroup && (
        <FeatureGroupModal
          mode="edit"
          projectId={pid}
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
        />
      )}
      <AgentsEditModal
        open={agentsEditOpen}
        onClose={() => setAgentsEditOpen(false)}
        projectId={pid}
        projectName={project.name}
      />
    </div>
  );
}

function Sidebar({
  project,
  groups,
  selectedId,
  onSelect,
  onCreateGroup,
  onEditGroup,
  search,
  setSearch,
}: {
  project: { id: number; name: string };
  groups: FeatureGroup[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreateGroup: () => void;
  onEditGroup: (g: FeatureGroup) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) || (g.description?.toLowerCase().includes(q) ?? false),
    );
  }, [groups, search]);

  const totalApis = useMemo(() => groups.reduce((sum, g) => sum + (g.apiCount ?? 0), 0), [groups]);

  return (
    <aside
      className="flex w-[240px] flex-shrink-0 flex-col border-r border-line bg-canvas-elevated"
      style={{ height: 'calc(100vh - 54px)' }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div className="min-w-0 truncate text-[13px] font-medium text-ink" title={project.name}>
          {project.name}
        </div>
        <IconBtn title="新建功能组" onClick={onCreateGroup}>
          <Plus className="h-3.5 w-3.5" />
        </IconBtn>
      </div>

      <div className="border-b border-line px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索功能组…"
            className="h-7 w-full rounded-md border border-line-subtle bg-canvas-subtle px-2.5 pl-8 text-[12px] placeholder:text-ink-subtle transition-colors hover:border-line focus:border-ink-subtle focus:bg-canvas-elevated focus:outline-none"
          />
        </div>
      </div>

      <nav className="scrollbar-modern flex-1 overflow-y-auto px-1.5 py-1.5">
        <div className="flex h-6 items-center justify-between px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          <span>功能组</span>
          <span className="tabular-nums text-ink-subtle">
            {groups.length} 组 · {totalApis} 接口
          </span>
        </div>
        {groups.length === 0 ? (
          <div className="flex flex-col items-center px-3 py-8 text-center">
            <FolderOpen className="mb-2 h-4 w-4 text-ink-subtle" />
            <p className="text-[12px] text-ink-secondary">还没有功能组</p>
            <button
              type="button"
              onClick={onCreateGroup}
              className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-ink hover:underline"
            >
              <Plus className="h-3 w-3" />
              新建功能组
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-ink-subtle">无匹配的功能组</div>
        ) : (
          filtered.map((g) => (
            <GroupNode
              key={g.id}
              group={g}
              selected={selectedId === g.id}
              onSelect={() => onSelect(g.id)}
              onEdit={() => onEditGroup(g)}
            />
          ))
        )}
      </nav>
    </aside>
  );
}

function GroupNode({
  group,
  selected,
  onSelect,
  onEdit,
}: {
  group: FeatureGroup;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const apiCount = group.apiCount ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors',
        selected
          ? 'bg-canvas-subtle font-medium text-ink'
          : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink',
      )}
    >
      <Layers
        className={cn(
          'h-3.5 w-3.5 flex-shrink-0',
          selected ? 'text-ink-secondary' : 'text-ink-tertiary',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{group.name}</span>
      <span
        className={cn(
          'flex-shrink-0 tabular-nums text-[11px]',
          selected ? 'text-ink-tertiary' : 'text-ink-subtle',
        )}
      >
        {apiCount}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="grid h-5 w-5 flex-shrink-0 place-items-center rounded text-ink-subtle opacity-0 transition-all hover:bg-canvas-deep/5 hover:text-ink group-hover:opacity-100"
        title="编辑功能组"
      >
        <MoreVertical className="h-3 w-3" />
      </button>
    </div>
  );
}

function ApiListPanel({
  projectId,
  group,
  onCreateApi,
  onEditApi,
  onOpenAgentsEdit,
}: {
  projectId: number;
  group: FeatureGroup;
  onCreateApi: () => void;
  onEditApi: (api: MockApi) => void;
  onOpenAgentsEdit: () => void;
}) {
  const navigate = useNavigate();
  const { data: apis, isLoading } = useMockApis(group.id);
  const toggleMut = useToggleMockApi();
  const deleteMut = useDeleteMockApi();
  const testMut = useTestMockApi();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [testResults, setTestResults] = useState<TestApiOutput[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [swaggerOpen, setSwaggerOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!apis) return [];
    const q = search.trim().toLowerCase();
    return apis.filter((a) => {
      if (methodFilter !== 'all' && a.method !== methodFilter) return false;
      if (statusFilter === 'enabled' && !a.isEnabled) return false;
      if (statusFilter === 'disabled' && a.isEnabled) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.path.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [apis, search, methodFilter, statusFilter]);

  const handleDelete = async (api: MockApi) => {
    const ok = await confirm({
      title: '删除接口',
      message: `确定删除 "${api.name}" (${api.method} ${api.path}) 吗？`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(api.id);
      toast.success('接口已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleToggle = async (api: MockApi) => {
    try {
      await toggleMut.mutateAsync({ id: api.id, isEnabled: !api.isEnabled });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleTest = useCallback(
    (api: MockApi) => {
      navigate(`/projects/${projectId}/apis/${api.id}?tab=test`);
    },
    [navigate, projectId],
  );

  const buildCurlCommand = useCallback((api: MockApi): string => {
    const url = api.fullUrl || `${window.location.origin}${api.path}`;
    const parts = [`curl -X ${api.method}`];

    if (api.responseContentType) {
      parts.push(`-H "Content-Type: ${api.responseContentType}"`);
    }

    if (api.responseHeaders) {
      Object.entries(api.responseHeaders).forEach(([key, value]) => {
        parts.push(`-H "${key}: ${value}"`);
      });
    }

    if (api.method !== 'GET' && api.method !== 'DELETE' && api.responseBody) {
      const body =
        typeof api.responseBody === 'string' ? api.responseBody : JSON.stringify(api.responseBody);
      parts.push(`-d '${body}'`);
    }

    parts.push(`"${url}"`);
    return parts.join(' \\\n  ');
  }, []);

  const handleCopy = useCallback(
    async (api: MockApi) => {
      const curl = buildCurlCommand(api);
      await copyToClipboard(curl);
      toast.success('已复制 curl 命令到剪贴板');
    },
    [buildCurlCommand],
  );

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!filtered) return;
    setSelectedIds((prev) => {
      if (prev.size === filtered.length) {
        return new Set();
      }
      return new Set(filtered.map((a) => a.id));
    });
  }, [filtered]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: '批量删除接口',
      message: `确定删除选中的 ${selectedIds.size} 个接口吗？`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteMut.mutateAsync(id)));
      toast.success(`已删除 ${selectedIds.size} 个接口`);
      setSelectedIds(new Set());
      setBatchMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '批量删除失败');
    }
  }, [selectedIds, deleteMut]);

  const handleBatchToggle = useCallback(
    async (isEnabled: boolean) => {
      if (selectedIds.size === 0) return;
      try {
        await Promise.all(
          Array.from(selectedIds).map((id) => toggleMut.mutateAsync({ id, isEnabled })),
        );
        toast.success(`已${isEnabled ? '启用' : '禁用'} ${selectedIds.size} 个接口`);
        setSelectedIds(new Set());
        setBatchMode(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '批量操作失败');
      }
    },
    [selectedIds, toggleMut],
  );

  const handleRunAllTests = useCallback(async () => {
    if (!apis || apis.length === 0) return;
    const enabledApis = apis.filter((a) => a.isEnabled);
    if (enabledApis.length === 0) {
      toast.warning('没有已启用的接口');
      return;
    }
    // 仅 HTTP 接口可走批量"运行测试"：SSE 是流式响应无单一结果，
    // WS 后端未注册路由调用必然 404，两者都跳过避免误报失败。
    const httpApis = enabledApis.filter((a) => a.protocol === 'HTTP');
    const skippedApis = enabledApis.filter((a) => a.protocol !== 'HTTP');
    if (httpApis.length === 0) {
      toast.warning('没有可批量测试的 HTTP 接口');
      return;
    }
    setTesting(true);
    setTestResults(null);
    try {
      const results = await Promise.all(
        httpApis.map((api) => {
          // 按接口的 validationRules 生成示例请求参数，避免必填字段缺失导致校验失败
          const sample = buildMockRequestSample(api);
          // 注意：path 必须保持干净（不能拼 query），否则 mock-engine 的 matcher
          // 会因 `?xxx` 而无法匹配到路由 → 404。query 必须作为独立字段传，
          // 后端 mock-apis.ts 的 fakeReq 会把 input.query 放到 req.query。
          const body = api.method === 'GET' ? undefined : sample.body;
          // insert 接口若 body 规则为空会自动得到 {}，后端会因
          // "insert requires non-empty body" 抛 500。这里兜底塞一个最小占位，
          // 让批量测试能正常跑通（具体字段以实际 schema 为准）。
          const finalBody =
            api.dataOp === 'insert' &&
            body &&
            typeof body === 'object' &&
            Object.keys(body as Record<string, unknown>).length === 0
              ? { _demo: '1' }
              : body;
          const input = {
            path: sample.path,
            query: sample.query,
            body: finalBody,
            headers: sample.headers,
          };
          // 调试日志：批量测试时方便定位哪个接口的 input 有问题
          // eslint-disable-next-line no-console
          console.debug('[runAllTests]', api.id, api.method, api.path, '→', input);
          return testMut.mutateAsync({ id: api.id, input }).then((r) => {
            // eslint-disable-next-line no-console
            if (r.responseStatus >= 400) {
              console.warn(
                '[runAllTests] failed',
                api.id,
                api.method,
                api.path,
                'status=',
                r.responseStatus,
                'body=',
                r.responseBody,
              );
            }
            return r;
          });
        }),
      );
      setTestResults(results);
      const passed = results.filter(
        (r) => r.responseStatus >= 200 && r.responseStatus < 300,
      ).length;
      const skippedNote =
        skippedApis.length > 0 ? `，跳过 ${skippedApis.length} 个非 HTTP 接口` : '';
      toast.success(`测试完成：${passed}/${results.length} 通过${skippedNote}`);
      if (skippedApis.length > 0) {
        const names = skippedApis.map((a) => a.name).join('、');
        toast.info(`已跳过非 HTTP 接口：${names}`, { duration: 4000 });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '测试失败');
    } finally {
      setTesting(false);
    }
  }, [apis, testMut]);

  const enabledCount = useMemo(() => (apis ?? []).filter((a) => a.isEnabled).length, [apis]);
  const disabledCount = (apis?.length ?? 0) - enabledCount;

  const moreItems: DropdownItem[] = [
    {
      label: testing ? '测试中...' : '运行测试',
      icon: testing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      ),
      onClick: () => void handleRunAllTests(),
      disabled: testing,
    },
    { divider: true },
    {
      label: '导入 Swagger',
      icon: <Upload className="h-3.5 w-3.5" />,
      onClick: () => setSwaggerOpen(true),
    },
  ];

  return (
    <div className="page-container !pt-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {group.name}
          </h1>
          {group.description && (
            <p className="mt-1.5 max-w-[680px] text-[13px] leading-relaxed text-ink-tertiary">
              {group.description}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-[11.5px] text-ink-tertiary">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-canvas-subtle px-1.5 py-0.5">
              <Layers className="h-3 w-3 text-ink-subtle" />
              <strong className="font-medium text-ink-secondary tabular-nums">
                {apis?.length ?? 0}
              </strong>{' '}
              接口
            </span>
            <Sep />
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <strong className="font-medium text-ink-secondary tabular-nums">{enabledCount}</strong>{' '}
              已启用
            </span>
            <Sep />
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              <strong className="font-medium text-ink-secondary tabular-nums">{disabledCount}</strong>{' '}
              已禁用
            </span>
            <Sep />
            <span>创建于 {formatDate(group.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {batchMode ? (
            <>
              {selectedIds.size > 0 && (
                <>
                  <Button variant="secondary" onClick={() => handleBatchToggle(true)}>
                    批量启用
                  </Button>
                  <Button variant="secondary" onClick={() => handleBatchToggle(false)}>
                    批量禁用
                  </Button>
                  <Button variant="danger" onClick={handleBatchDelete}>
                    <Trash2 className="h-3.5 w-3.5" />
                    批量删除 ({selectedIds.size})
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setBatchMode(false);
                  setSelectedIds(new Set());
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
                退出批量
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setBatchMode(true)}>
              <SquareCheck className="h-3.5 w-3.5" />
              批量管理
            </Button>
          )}
          <Button variant="primary" onClick={onCreateApi}>
            <Plus className="h-3.5 w-3.5" />
            新建接口
          </Button>
          <Dropdown
            trigger={
              <Button variant="ghost" aria-label="更多操作">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            }
            items={moreItems}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenAgentsEdit}
        className="purple-recommend-card group mb-3 flex w-full items-center gap-3 rounded-lg border border-violet-200 px-3.5 py-2.5 text-left transition-all hover:border-violet-300 dark:border-violet-800/60 dark:hover:border-violet-700"
      >
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-violet-100 text-violet-700 ring-1 ring-violet-200/80 transition-colors group-hover:bg-violet-200/70">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-violet-900">AI 对话编辑</span>
            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10.5px] font-medium text-violet-700">
              推荐
            </span>
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-violet-700/75">
            用自然语言描述需求，复制提示词给 Cursor / 本地 Agent，直接改本项目接口
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-1 text-[12px] font-medium text-violet-700 opacity-80 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
          开始
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </button>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px] max-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="按接口名 / 路径搜索…"
            className="form-input h-8 w-full pl-8"
          />
        </div>
        <Select
          compact
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="w-auto min-w-[100px]"
        >
          <option value="all">全部方法</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </Select>
        <Select
          compact
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto min-w-[100px]"
        >
          <option value="all">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已停用</option>
        </Select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-ink-tertiary">加载中...</div>
        ) : !apis || apis.length === 0 ? (
          <Empty
            title="还没有接口"
            description="在该功能组下创建第一个 Mock 接口"
            action={
              <Button variant="primary" onClick={onCreateApi}>
                <Plus className="h-3.5 w-3.5" /> 新建接口
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="params-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input
                        type="checkbox"
                        checked={
                          batchMode && filtered.length > 0 && selectedIds.size === filtered.length
                        }
                        onChange={() => batchMode && toggleSelectAll()}
                        disabled={!batchMode}
                        className={cn(
                          'h-3.5 w-3.5 rounded accent-ink',
                          batchMode ? 'cursor-pointer' : 'cursor-default opacity-0',
                        )}
                      />
                    </th>
                    <th>接口名称 / 描述</th>
                    <th style={{ width: 200 }}>方法 / 路径</th>
                    <th style={{ width: 200 }}>特性</th>
                    <th style={{ width: 70 }}>状态码</th>
                    <th style={{ width: 70 }}>延迟</th>
                    <th style={{ width: 70 }}>调用</th>
                    <th style={{ width: 80 }}>启用</th>
                    <th style={{ width: 90 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((api) => (
                    <ApiTableRow
                      key={api.id}
                      api={api}
                      batchMode={batchMode}
                      selected={selectedIds.has(api.id)}
                      onToggleSelect={() => batchMode && toggleSelect(api.id)}
                      onEdit={() => onEditApi(api)}
                      onTest={() => handleTest(api)}
                      onCopy={() => handleCopy(api)}
                      onDelete={() => handleDelete(api)}
                      onToggle={() => handleToggle(api)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-2.5 text-[12px] text-ink-tertiary">
              <span>共 {filtered.length} 条</span>
              <div className="flex items-center gap-0.5">
                <button className="page-btn">‹</button>
                <button className="page-btn active">1</button>
                <button className="page-btn">›</button>
              </div>
            </div>
          </>
        )}
      </div>

      {testResults && (
        <TestResultsModal
          results={testResults}
          projectId={projectId}
          onClose={() => setTestResults(null)}
        />
      )}

      {swaggerOpen && (
        <SwaggerImportModal
          open={swaggerOpen}
          featureGroupId={group.id}
          onClose={() => setSwaggerOpen(false)}
        />
      )}
    </div>
  );
}

function ApiTableRow({
  api,
  batchMode,
  selected,
  onToggleSelect,
  onEdit,
  onTest,
  onCopy,
  onDelete,
  onToggle,
}: {
  api: MockApi;
  batchMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onTest: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <tr
      onClick={() => (batchMode ? onToggleSelect() : onEdit())}
      className={cn(
        'cursor-pointer transition-colors hover:bg-canvas',
        batchMode && selected && 'bg-blue-50',
      )}
    >
      <td onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={batchMode ? selected : false}
          onChange={onToggleSelect}
          disabled={!batchMode}
          className={cn(
            'h-3.5 w-3.5 rounded accent-ink',
            batchMode ? 'cursor-pointer' : 'cursor-default opacity-0',
          )}
        />
      </td>
      <td>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13.5px] font-medium text-ink">{api.name}</span>
          <span className="text-[11.5px] text-ink-subtle">{api.description ?? '—'}</span>
        </div>
      </td>
      <td>
        <MethodBadge method={api.method} />
        <div className="mt-1">
          <span className="param-code" title={api.fullPath || api.path}>
            {api.fullPath || api.path}
          </span>
        </div>
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {api.hasCallback && <span className="tag tag-orange">延迟回调</span>}
          {api.dataOp !== 'none' && api.dataTable && <span className="tag tag-pink">数据联动</span>}
          {api.validationRules && Object.keys(api.validationRules).length > 0 && (
            <span className="tag tag-blue">参数校验</span>
          )}
          {!api.isEnabled && <span className="tag tag-red">已禁用</span>}
        </div>
      </td>
      <td>
        <TagPill>{api.responseStatus}</TagPill>
      </td>
      <td className="text-[12px] text-ink-tertiary">{api.responseDelay || 0} ms</td>
      <td>
        <strong className="text-[13px] text-ink">0</strong>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <Switch checked={api.isEnabled} onChange={onToggle} />
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onEdit}
            className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
            title="编辑"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onTest}
            className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
            title="测试"
          >
            <Play className="h-3 w-3" />
          </button>
          <button
            onClick={onCopy}
            className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
            title="复制 curl"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EmptyView({
  title,
  description,
  onCreateGroup,
}: {
  title: string;
  description: string;
  onCreateGroup: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <Empty
        title={title}
        description={description}
        action={
          <Button variant="primary" onClick={onCreateGroup}>
            <Plus className="h-3.5 w-3.5" /> 新建功能组
          </Button>
        }
      />
    </div>
  );
}

function FeatureGroupModal({
  mode,
  projectId,
  group,
  onClose,
}: {
  mode: 'create' | 'edit';
  projectId: number;
  group?: FeatureGroup;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const createMut = useCreateFeatureGroup();
  const updateMut = useUpdateFeatureGroup();
  const deleteMut = useDeleteFeatureGroup();

  const submit = async () => {
    if (!name.trim()) {
      setError('功能组名不能为空');
      return;
    }
    setError(null);
    try {
      if (mode === 'create') {
        await createMut.mutateAsync({
          projectId,
          body: { name: name.trim(), description: description.trim() || null },
        });
        toast.success('功能组已创建');
      } else if (group) {
        await updateMut.mutateAsync({
          id: group.id,
          data: { name: name.trim(), description: description.trim() || null },
        });
        toast.success('功能组已更新');
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleDelete = async () => {
    if (!group) return;
    const ok = await confirm({
      title: '删除功能组',
      message: `确定删除功能组 "${group.name}" 吗？将级联删除其下所有 Mock 接口。`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(group.id);
      toast.success('功能组已删除');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? '新建功能组' : '编辑功能组'}
      width="sm"
      footer={
        <>
          {mode === 'edit' && (
            <Button variant="danger" onClick={handleDelete} className="mr-auto">
              删除
            </Button>
          )}
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
        <FormField label="功能组名称" required error={error ?? undefined}>
          <Input
            placeholder="例如：人脸管理"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!error}
            maxLength={100}
          />
        </FormField>
        <FormField label="描述">
          <Textarea
            placeholder="选填"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </FormField>
      </div>
    </Modal>
  );
}

function TestResultsModal({
  results,
  projectId,
  onClose,
}: {
  results: TestApiOutput[];
  projectId: number;
  onClose: () => void;
}) {
  const passed = results.filter((r) => r.responseStatus >= 200 && r.responseStatus < 300).length;
  const failed = results.length - passed;
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  };

  return (
    <Modal open onClose={onClose} title="测试结果" width="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-4 text-[14px]">
          <span className="flex items-center gap-1.5 text-green-600">
            <CheckCircle className="h-4 w-4" />
            通过: {passed}
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-1.5 text-red-600">
              <XCircle className="h-4 w-4" />
              失败: {failed}
            </span>
          )}
          <span className="text-ink-tertiary">总计: {results.length}</span>
        </div>

        <div className="max-h-[500px] overflow-auto rounded border border-line">
          <table className="params-table w-full">
            <thead>
              <tr>
                <th style={{ width: 50 }}>状态</th>
                <th style={{ width: 70 }}>方法</th>
                <th>路径</th>
                <th style={{ width: 90 }}>状态码</th>
                <th>响应摘要</th>
                <th style={{ width: 140 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => {
                const ok = result.responseStatus >= 200 && result.responseStatus < 300;
                const isExpanded = expandedIdx === idx;
                const bodyText =
                  typeof result.responseBody === 'string'
                    ? result.responseBody
                    : JSON.stringify(result.responseBody);
                const bodySummary = bodyText.length > 80 ? bodyText.slice(0, 80) + '…' : bodyText;
                return (
                  <Fragment key={idx}>
                    <tr>
                      <td>
                        {ok ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </td>
                      <td>
                        <MethodBadge method={result.method} />
                      </td>
                      <td>
                        <span className="param-code">{result.path}</span>
                      </td>
                      <td>
                        <TagPill
                          className={ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}
                        >
                          {result.responseStatus}
                        </TagPill>
                      </td>
                      <td>
                        <span className="block max-w-[360px] truncate text-[12px] text-ink-secondary">
                          {bodySummary}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleExpand(idx)}
                            className="grid h-7 w-7 place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
                            title={isExpanded ? '收起详情' : '展开详情'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              window.open(
                                `/projects/${projectId}/apis/${result.apiId}?tab=test`,
                                '_blank',
                              );
                            }}
                            className="grid h-7 w-7 place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
                            title="在新标签页打开测试面板"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-canvas-subtle/50">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
                              <strong className="text-ink">完整响应</strong>
                              <span className="text-ink-subtle">
                                ({prettyBytes(byteSize(result.responseBody))})
                              </span>
                            </div>
                            <pre className="max-h-[280px] overflow-auto rounded border border-line bg-canvas-elevated p-2 font-mono text-[12px] leading-[1.6] text-ink">
                              {typeof result.responseBody === 'string'
                                ? result.responseBody
                                : JSON.stringify(result.responseBody, null, 2)}
                            </pre>
                            {!ok && (
                              <FailureHints
                                responseBody={result.responseBody}
                                status={result.responseStatus}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * 针对常见失败原因给出可读的提示（不做实际修复，仅给用户方向）。
 */
function FailureHints({ responseBody, status }: { responseBody: unknown; status: number }) {
  const hints: string[] = [];
  const fieldErrors: Array<{ location: string; field: string; message: string; rule?: string }> =
    [];

  if (status === 404) {
    hints.push('404：mock-engine matcher 未匹配到路由。');
    hints.push(
      '常见原因：① 接口已被禁用；② 接口 path 是字面量但 mock 引擎路由表里只有不同 method 的同名 path；③ 后端 /mock-apis/:id/test 路由接收的 path 不正确（看下方的完整响应）。',
    );
  }
  if (status === 500) {
    hints.push('500：mock-engine 内部异常。');
    hints.push('常见原因：dataOp=insert 但 body 缺字段、script 脚本抛错、dataTable 是保留名等。');
  }
  if (status === 400) {
    hints.push('400：参数校验失败。详见下方字段级错误。');
  }

  if (responseBody && typeof responseBody === 'object') {
    const body = responseBody as Record<string, unknown>;
    if (body.code === 'VALIDATION_ERROR' && Array.isArray(body.errors)) {
      const errs = body.errors as Array<{
        location: string;
        field: string;
        message: string;
        rule?: string;
      }>;
      errs.forEach((e) => fieldErrors.push(e));
    }
    if (typeof body.message === 'string' && body.message && status !== 400) {
      hints.push(`后端消息：${body.message}`);
    }
  }

  return (
    <div className="space-y-2">
      {hints.length > 0 && (
        <div className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[12px] text-danger">
          <ul className="list-disc space-y-0.5 pl-4">
            {hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}
      {fieldErrors.length > 0 && (
        <div className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[12px] text-danger">
          <div className="mb-1 font-semibold">字段级错误（共 {fieldErrors.length} 项）：</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {fieldErrors.map((e, i) => (
              <li key={i}>
                <span className="font-mono">
                  [{e.location}] {e.field}
                  {e.rule ? <span className="text-ink-subtle">（{e.rule}）</span> : null}
                </span>
                ：{e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function byteSize(v: unknown): number {
  try {
    return new Blob([JSON.stringify(v)]).size;
  } catch {
    return 0;
  }
}

function Sep() {
  return <span aria-hidden className="text-ink-disabled">·</span>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
