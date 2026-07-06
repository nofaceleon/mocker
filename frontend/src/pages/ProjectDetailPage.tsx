import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  Copy,
  FolderTree,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  FormField,
  Input,
  MethodBadge,
  Modal,
  PageHeader,
  Switch,
  Textarea,
  confirm,
  IconBtn,
  TagPill,
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
} from '@/hooks/queries/use-mock-apis';
import { useProject } from '@/hooks/queries/use-projects';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/cn';
import type { FeatureGroup, MockApi } from '@/types/api';

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const navigate = useNavigate();
  const { data: project } = useProject(pid);
  const { data: groups } = useFeatureGroups(pid);
  const selectedGroupId = useUiStore((s) => s.selectedFeatureGroupId);
  const setSelectedGroup = useUiStore((s) => s.setSelectedFeatureGroup);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [sidebarSearch, setSidebarSearch] = useState('');

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
        expanded={expanded}
        setExpanded={setExpanded}
        onSelect={(id) => setSelectedGroup(id)}
        onCreateGroup={() => setCreatingGroup(true)}
        onEditGroup={(g) => setEditingGroup(g)}
        search={sidebarSearch}
        setSearch={setSidebarSearch}
      />

      <main className="flex-1 overflow-y-auto bg-canvas">
        <div className="border-b border-line bg-white/85 px-6 py-3 backdrop-blur">
          <Breadcrumb
            items={[
              { label: '项目', to: '/projects' },
              { label: project.name, to: `/projects/${project.id}` },
              ...(activeGroup ? [{ label: activeGroup.name, current: true }] : []),
            ]}
          />
        </div>

        {activeGroup ? (
          <ApiListPanel
            projectId={pid}
            projectName={project.name}
            group={activeGroup}
            onCreateApi={() => navigate(`/projects/${pid}/apis/new?gid=${activeGroup.id}`)}
            onEditApi={(api) => navigate(`/projects/${pid}/apis/${api.id}`)}
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
    </div>
  );
}

function Sidebar({
  project,
  groups,
  selectedId,
  expanded,
  setExpanded,
  onSelect,
  onCreateGroup,
  onEditGroup,
  search,
  setSearch,
}: {
  project: { id: number; name: string };
  groups: FeatureGroup[];
  selectedId: number | null;
  expanded: Record<number, boolean>;
  setExpanded: (v: Record<number, boolean>) => void;
  onSelect: (id: number) => void;
  onCreateGroup: () => void;
  onEditGroup: (g: FeatureGroup) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <aside
      className="flex w-[270px] flex-shrink-0 flex-col border-r border-line bg-white"
      style={{ height: 'calc(100vh - 54px)' }}
    >
      <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          项目导航
        </span>
        <div className="flex items-center gap-0.5">
          <IconBtn title="新建" onClick={onCreateGroup}>
            <Plus className="h-3 w-3" />
          </IconBtn>
          <IconBtn
            title="折叠全部"
            onClick={() => setExpanded({ [project.id]: false })}
          >
            <ChevronRight className="h-3 w-3 -rotate-90" />
          </IconBtn>
        </div>
      </div>
      <div className="relative border-b border-line px-3 py-2.5">
        <Search className="pointer-events-none absolute left-7 top-[18px] h-3 w-3 text-ink-subtle" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索接口、路径…"
          className="h-7 w-full rounded-md border border-line bg-canvas px-2.5 pl-7 text-[12px] transition-all focus:border-ink focus:bg-white focus:outline-none"
        />
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2">
        <div
          className="mb-1 flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-subtle"
          onClick={() => setExpanded({ [project.id]: !expanded[project.id] })}
        >
          <span
            className={cn(
              'grid h-4 w-4 place-items-center text-ink-subtle transition-transform',
              expanded[project.id] && 'rotate-90',
            )}
          >
            <ChevronRight className="h-2.5 w-2.5" />
          </span>
          <FolderTree className="h-3.5 w-3.5 text-ink-secondary" />
          <span className="flex-1 truncate">{project.name}</span>
          <span className="rounded-full bg-canvas-subtle px-1.5 py-px text-[10px] font-medium text-ink-tertiary">
            {groups.length}
          </span>
        </div>

        {expanded[project.id] !== false && (
          <div className="ml-3.5 border-l border-dashed border-line pl-1.5">
            {groups.length === 0 && (
              <div className="px-2 py-3 text-[12px] text-ink-subtle">暂无功能组</div>
            )}
            {groups.map((g) => (
              <GroupNode
                key={g.id}
                group={g}
                selected={selectedId === g.id}
                onSelect={() => onSelect(g.id)}
                onEdit={() => onEditGroup(g)}
              />
            ))}
          </div>
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
  return (
    <div
      onClick={onSelect}
      className={cn(
        'mb-0.5 flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
        selected
          ? 'bg-canvas-deep font-medium text-ink-inverse'
          : 'text-ink-secondary hover:bg-canvas-subtle',
      )}
    >
      <FolderTree
        className={cn(
          'h-3.5 w-3.5',
          selected ? 'text-ink-inverse' : 'text-ink-tertiary',
        )}
      />
      <span className="flex-1 truncate">{group.name}</span>
      <span
        className={cn(
          'rounded-full px-1.5 py-px text-[10px] font-medium',
          selected ? 'bg-white/15 text-ink-inverse' : 'bg-canvas-subtle text-ink-tertiary',
        )}
      >
        0
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className={cn(
          'grid h-5 w-5 place-items-center rounded transition-colors',
          selected
            ? 'text-ink-inverse hover:bg-white/15'
            : 'text-ink-subtle opacity-0 hover:bg-canvas-subtle group-hover:opacity-100',
        )}
        title="编辑"
      >
        <MoreVertical className="h-3 w-3" />
      </button>
    </div>
  );
}

function ApiListPanel({
  projectName,
  group,
  onCreateApi,
  onEditApi,
}: {
  projectId?: number;
  projectName: string;
  group: FeatureGroup;
  onCreateApi: () => void;
  onEditApi: (api: MockApi) => void;
}) {
  const { data: apis, isLoading } = useMockApis(group.id);
  const toggleMut = useToggleMockApi();
  const deleteMut = useDeleteMockApi();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  return (
    <div className="page-container !pt-6">
      <PageHeader
        title={
          <>
            {group.name}
            <span className="text-[14px] font-normal text-ink-subtle">· {apis?.length ?? 0} 接口</span>
          </>
        }
        description={group.description ?? `管理「${projectName} / ${group.name}」下的所有 Mock 接口`}
        actions={
          <>
            <Button variant="secondary">
              <Play className="h-3.5 w-3.5" />
              运行测试
            </Button>
            <Button variant="secondary">
              <Trash2 className="h-3.5 w-3.5" />
              批量管理
            </Button>
            <Button variant="primary" onClick={onCreateApi}>
              <Plus className="h-3.5 w-3.5" />
              新建接口
            </Button>
          </>
        }
      />

      <div className="mb-3.5 flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="按接口名 / 路径搜索…"
            className="form-input h-8 w-[240px] pl-8"
          />
        </div>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="form-select h-8 w-auto min-w-[110px] text-[12px]"
        >
          <option value="all">全部方法</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="form-select h-8 w-auto min-w-[110px] text-[12px]"
        >
          <option value="all">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已停用</option>
        </select>
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
            <table className="params-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input type="checkbox" />
                  </th>
                  <th>接口名称 / 描述</th>
                  <th style={{ width: 160 }}>方法 / 路径</th>
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
                  <tr
                    key={api.id}
                    onClick={() => onEditApi(api)}
                    className="cursor-pointer transition-colors hover:bg-canvas"
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer rounded accent-ink" />
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13.5px] font-medium text-ink">{api.name}</span>
                        <span className="text-[11.5px] text-ink-subtle">
                          {api.description ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <MethodBadge method={api.method} />
                      <div className="mt-1">
                        <span className="param-code">{api.path}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {api.responseDelay > 0 && (
                          <span className="tag tag-orange">延迟回调</span>
                        )}
                        {api.dataOp !== 'none' && api.dataTable && (
                          <span className="tag tag-pink">数据联动</span>
                        )}
                        {api.validationRules && Object.keys(api.validationRules).length > 0 && (
                          <span className="tag tag-blue">参数校验</span>
                        )}
                        {!api.isEnabled && (
                          <span className="tag tag-red">已禁用</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <TagPill>{api.responseStatus}</TagPill>
                    </td>
                    <td className="text-[12px] text-ink-tertiary">
                      {api.responseDelay || 0} ms
                    </td>
                    <td>
                      <strong className="text-[13px] text-ink">0</strong>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={api.isEnabled}
                        onChange={() => handleToggle(api)}
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => onEditApi(api)}
                          className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
                          title="编辑"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
                          title="测试"
                        >
                          <Play className="h-3 w-3" />
                        </button>
                        <button
                          className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-canvas-subtle hover:text-ink"
                          title="复制"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(api)}
                          className="grid h-[26px] w-[26px] place-items-center rounded text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                          title="删除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
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
