import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Modal, PageHeader, Drawer } from '@/components/ui';
import {
  buildRequestLogExportUrl,
  useClearRequestLogs,
  useRequestLog,
  useRequestLogFilters,
  useRequestLogStats,
  useRequestLogs,
  type RequestLogHttpMethod,
  type RequestLogQuery,
  type RequestLogRange,
  type RequestLogStatusClass,
} from '@/hooks/queries/use-request-logs';
import { LogsAnalyticsBar } from '@/components/logs/LogsAnalyticsBar';
import { LogsFilterBar } from '@/components/logs/LogsFilterBar';
import { LogsStatusStrip } from '@/components/logs/LogsStatusStrip';
import { LogsTable } from '@/components/logs/LogsTable';
import { LogsDetailPanel } from '@/components/logs/LogsDetailPanel';
import { formatNumber } from '@/components/logs/log-shared';
import { useIsMobile } from '@/lib/use-is-mobile';

const PAGE_SIZE = 20;

export function LogsPage() {
  const [searchParams] = useSearchParams();
  const initialProject = searchParams.get('projectId') ?? 'all';
  const initialApi = searchParams.get('apiId') ?? 'all';

  // ----- 过滤器状态 -----
  const [range, setRange] = useState<RequestLogRange>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>(initialProject);
  const [apiFilter, setApiFilter] = useState<string>(initialApi);
  const [methodFilter, setMethodFilter] = useState<RequestLogHttpMethod | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RequestLogStatusClass | 'all'>('all');
  const [page, setPage] = useState(1);

  // ----- 选中 / 批量 -----
  const [selected, setSelected] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);

  // ----- 确认弹框 -----
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmClearSelected, setConfirmClearSelected] = useState(false);

  // ----- 自动刷新控制 -----
  const [progress, setProgress] = useState(0);
  const [autoRefreshPaused, setAutoRefreshPaused] = useState(false);

  // ----- 移动端详情 Drawer -----
  const isMobile = useIsMobile(1280);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  // 项目切换时清空接口筛选
  useEffect(() => {
    setApiFilter('all');
    setPage(1);
  }, [projectFilter]);

  // 搜索 / 过滤变化时重置页码
  useEffect(() => {
    setPage(1);
  }, [search, methodFilter, statusFilter, range, customStart, customEnd]);

  // ----- 数据获取 -----
  const filtersQuery = useMemo(
    () => ({ projectId: projectFilter === 'all' ? undefined : Number(projectFilter) }),
    [projectFilter],
  );
  const filters = useRequestLogFilters(filtersQuery);
  const projectOptions = useMemo(() => filters.data?.projects ?? [], [filters.data]);
  const apiOptions = useMemo(() => {
    const all = filters.data?.apis ?? [];
    if (projectFilter === 'all') return all;
    return all.filter((a) => String(a.projectId ?? '') === projectFilter);
  }, [filters.data, projectFilter]);

  const listQuery = useMemo<RequestLogQuery>(
    () => ({
      projectId: projectFilter === 'all' ? undefined : Number(projectFilter),
      apiId: apiFilter === 'all' ? undefined : Number(apiFilter),
      method: methodFilter === 'all' ? undefined : methodFilter,
      statusClass: statusFilter === 'all' ? undefined : statusFilter,
      keyword: search.trim() || undefined,
      range,
      start: range === 'custom' && customStart ? new Date(customStart).getTime() : undefined,
      end:
        range === 'custom' && customEnd ? new Date(customEnd + 'T23:59:59').getTime() : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [
      projectFilter,
      apiFilter,
      methodFilter,
      statusFilter,
      search,
      range,
      customStart,
      customEnd,
      page,
    ],
  );

  const stats = useRequestLogStats(range);
  const logs = useRequestLogs(listQuery);
  const detail = useRequestLog(selected ?? undefined);
  const clearMut = useClearRequestLogs();

  const total = logs.data?.total ?? 0;
  const items = logs.data?.items ?? [];

  // ----- 自动刷新进度条 -----
  useEffect(() => {
    if (autoRefreshPaused) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          logs.refetch();
          stats.refetch();
          return 0;
        }
        return prev + 1; // 50ms × 100 步 = 5s
      });
    }, 50);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshPaused, range, projectFilter, apiFilter, methodFilter, statusFilter, search]);

  // ----- 派生 -----
  const allChecked = items.length > 0 && items.every((it) => checkedIds.includes(it.id));

  // ----- 事件处理 -----
  function toggleCheckAll() {
    if (allChecked) {
      setCheckedIds((prev) => prev.filter((id) => !items.some((it) => it.id === id)));
    } else {
      setCheckedIds((prev) => Array.from(new Set([...prev, ...items.map((it) => it.id)])));
    }
  }
  function toggleCheckOne(id: number) {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function handleReset() {
    setSearch('');
    setProjectFilter('all');
    setApiFilter('all');
    setMethodFilter('all');
    setStatusFilter('all');
    setRange('all');
    setCustomStart('');
    setCustomEnd('');
    setPage(1);
    setCheckedIds([]);
  }
  async function handleClearAll() {
    try {
      const res = await clearMut.mutateAsync({ all: true });
      toast.success(`已清除 ${res.deleted} 条日志`);
      setConfirmClearAll(false);
      setCheckedIds([]);
      setSelected(null);
    } catch (e) {
      toast.error(`清除失败: ${(e as Error).message}`);
    }
  }
  async function handleClearSelected() {
    try {
      const res = await clearMut.mutateAsync({ ids: checkedIds });
      toast.success(`已删除 ${res.deleted} 条日志`);
      setConfirmClearSelected(false);
      setCheckedIds([]);
    } catch (e) {
      toast.error(`删除失败: ${(e as Error).message}`);
    }
  }
  function handleExport() {
    window.open(buildRequestLogExportUrl(listQuery), '_blank');
  }

  return (
    <div className="page-container">
      <PageHeader
        title="调用日志"
        description="所有 Mock 接口的请求记录，便于调试和回溯问题"
        actions={
          <>
            <Button variant="secondary" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              导出日志
            </Button>
            <Button variant="danger" onClick={() => setConfirmClearAll(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              清除全部
            </Button>
          </>
        }
      />

      <div className="mb-4 space-y-3">
        <LogsAnalyticsBar stats={stats.data} isLoading={stats.isLoading} />

        <LogsFilterBar
          search={search}
          onSearchChange={setSearch}
          projects={projectOptions}
          projectFilter={projectFilter}
          onProjectChange={setProjectFilter}
          apis={apiOptions}
          apiFilter={apiFilter}
          onApiChange={setApiFilter}
          methodFilter={methodFilter}
          onMethodChange={setMethodFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          range={range}
          onRangeChange={setRange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
          onReset={handleReset}
        />

        <LogsStatusStrip
          lastUpdatedAt={logs.dataUpdatedAt}
          refreshProgress={progress}
          paused={autoRefreshPaused}
          onTogglePause={() => setAutoRefreshPaused((v) => !v)}
          onRefreshNow={() => {
            logs.refetch();
            stats.refetch();
          }}
        />

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_480px]">
          <LogsTable
            items={items}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            selectedId={selected}
            onSelect={(id) => {
              setSelected(id);
              if (isMobile && id !== null) setDetailDrawerOpen(true);
            }}
            onPageChange={setPage}
            checkedIds={checkedIds}
            onToggleCheck={toggleCheckOne}
            onToggleCheckAll={toggleCheckAll}
            onClearSelection={() => setCheckedIds([])}
            onBatchDelete={() => setConfirmClearSelected(true)}
            isLoading={logs.isLoading}
          />

          {/* 桌面端：右侧固定详情面板 */}
          {!isMobile && (
            <div className="hidden min-h-[400px] xl:block">
              <LogsDetailPanel log={detail.data ?? null} isLoading={detail.isLoading} />
            </div>
          )}
        </div>

        {/* 移动端：详情 Drawer */}
        {isMobile && (
          <Drawer
            open={detailDrawerOpen}
            onClose={() => setDetailDrawerOpen(false)}
            title="日志详情"
            width="sm"
          >
            <LogsDetailPanel log={detail.data ?? null} isLoading={detail.isLoading} />
          </Drawer>
        )}
      </div>

      {/* 二次确认：清除全部 */}
      <Modal
        open={confirmClearAll}
        onClose={() => setConfirmClearAll(false)}
        title="清除全部调用日志？"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClearAll(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleClearAll} disabled={clearMut.isPending}>
              {clearMut.isPending ? '清除中…' : '确认清除'}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-secondary">
          此操作不可恢复，将删除所有 Mock 接口的请求记录。当前共{' '}
          <strong className="text-ink">{formatNumber(total)}</strong> 条。
        </p>
      </Modal>

      {/* 二次确认：批量删除 */}
      <Modal
        open={confirmClearSelected}
        onClose={() => setConfirmClearSelected(false)}
        title={`删除选中的 ${checkedIds.length} 条日志？`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClearSelected(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleClearSelected} disabled={clearMut.isPending}>
              {clearMut.isPending ? '删除中…' : '确认删除'}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-secondary">删除后无法恢复。</p>
      </Modal>
    </div>
  );
}
