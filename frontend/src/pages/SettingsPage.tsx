import { useState } from 'react';
import { Database, HardDrive, Info, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Empty,
  PageHeader,
  StatCard,
  TagPill,
  confirm,
} from '@/components/ui';
import {
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
} from '@/hooks/queries/use-backups';
import { config } from '@/lib/runtime-config';

export function SettingsPage() {
  const { data: backups, isLoading } = useBackups();
  const createMut = useCreateBackup();
  const restoreMut = useRestoreBackup();
  const deleteMut = useDeleteBackup();
  const [tab, setTab] = useState<'backups' | 'runtime' | 'about'>('backups');

  const handleBackup = async () => {
    try {
      const r = await createMut.mutateAsync();
      toast.success(`已创建备份：${r.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '备份失败');
    }
  };

  const handleRestore = async (name: string) => {
    const ok = await confirm({
      title: '恢复数据库',
      message: (
        <span>
          从 <code className="rounded bg-canvas-subtle px-1">{name}</code> 恢复？
          <br />
          当前数据将自动备份一次，但仍建议先手动备份。
        </span>
      ),
      confirmText: '恢复',
      danger: true,
    });
    if (!ok) return;
    try {
      await restoreMut.mutateAsync(name);
      toast.success('恢复成功，正在刷新页面');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '恢复失败');
    }
  };

  const handleDelete = async (name: string) => {
    const ok = await confirm({
      title: '删除备份',
      message: `确定删除备份 "${name}" 吗？`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(name);
      toast.success('已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="设置"
        description="数据库、备份与运行时配置"
      />

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={tab === 'backups' ? 'primary' : 'secondary'}
          onClick={() => setTab('backups')}
          size="sm"
        >
          备份管理
        </Button>
        <Button
          variant={tab === 'runtime' ? 'primary' : 'secondary'}
          onClick={() => setTab('runtime')}
          size="sm"
        >
          运行时
        </Button>
        <Button
          variant={tab === 'about' ? 'primary' : 'secondary'}
          onClick={() => setTab('about')}
          size="sm"
        >
          关于
        </Button>
      </div>

      {tab === 'backups' && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="数据库文件"
              value={<span className="truncate font-mono text-[14px]">{config.dbPath}</span>}
              icon={<Database />}
            />
            <StatCard
              label="备份目录"
              value={<span className="truncate font-mono text-[14px]">{config.backupDir}</span>}
              icon={<HardDrive />}
            />
            <StatCard
              label="现有备份"
              value={backups?.length ?? 0}
              hint={isLoading ? '加载中…' : '按时间倒序'}
              icon={<HardDrive />}
            />
          </div>

          <Card
            title="备份"
            extra={
              <Button variant="primary" loading={createMut.isPending} onClick={handleBackup}>
                <HardDrive className="h-3.5 w-3.5" />
                立即备份
              </Button>
            }
          >
            <p className="text-[12.5px] leading-[1.7] text-ink-secondary">
              备份会复制整个 SQLite 数据库（含项目/接口/数据/调用日志），存于{' '}
              <code className="rounded bg-canvas-subtle px-1 py-0.5 font-mono text-[11.5px] text-ink">data/backups</code>。
              备份使用 SQLite 在线热备 API，过程中 Mock 服务无需停机。
            </p>
          </Card>

          <Card className="mt-4" title="备份列表" noBody>
            {!backups || backups.length === 0 ? (
              <Empty
                icon={<Database className="h-10 w-10 text-ink-subtle" />}
                title="还没有备份"
                description="点击「立即备份」创建你的第一个备份"
              />
            ) : (
              <table className="params-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th style={{ width: 100 }}>大小</th>
                    <th style={{ width: 200 }}>创建时间</th>
                    <th>路径</th>
                    <th style={{ width: 130 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.name} className="hover:bg-canvas">
                      <td>
                        <span className="param-code !text-[12px]">{b.name}</span>
                      </td>
                      <td>
                        <TagPill>{formatSize(b.size)}</TagPill>
                      </td>
                      <td className="text-ink-secondary">{new Date(b.mtime).toLocaleString()}</td>
                      <td>
                        <span className="truncate font-mono text-[11.5px] text-ink-tertiary">{b.path}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={restoreMut.isPending && restoreMut.variables === b.name}
                            onClick={() => handleRestore(b.name)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            恢复
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(b.name)}
                            className="!text-ink-subtle hover:!bg-danger-soft hover:!text-danger"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {tab === 'runtime' && (
        <Card title="运行时配置">
          <div className="space-y-2.5 text-[12.5px]">
            <Row label="数据库路径" value={config.dbPath} />
            <Row label="备份目录" value={config.backupDir} />
            <Row label="API 基础地址" value={config.apiBase} />
            <Row label="前端端口" value={String(config.frontendPort)} />
            <Row label="后端端口" value={String(config.backendPort)} />
          </div>
          <div className="info-tip mt-4">
            <Info />
            <div>
              运行时配置由启动参数 / 环境变量 / 配置文件决定。修改后需重启服务生效，详情参见项目文档。
            </div>
          </div>
        </Card>
      )}

      {tab === 'about' && (
        <Card title="关于 Mock Studio">
          <div className="space-y-3 text-[13px] leading-[1.7] text-ink-secondary">
            <div className="flex items-center gap-3">
              <div className="brand-mark">M</div>
              <div>
                <div className="text-[15px] font-semibold text-ink">Mock Studio</div>
                <div className="text-[12px] text-ink-tertiary">v0.1.0 · P0</div>
              </div>
            </div>
            <p>
              <b className="text-ink">本地优先</b>的通用接口 Mock 平台：项目隔离、可视化配置、回调任务、调用日志、数据联动一应俱全。
            </p>
            <ul className="ml-4 list-disc space-y-1 text-[12.5px]">
              <li>支持 HTTP / WebSocket / SSE / 自定义脚本</li>
              <li>支持参数校验、延迟回调、数据联动</li>
              <li>提供 SQL / 表浏览器，支持业务表自动建表</li>
              <li>本地备份 / 恢复，无需依赖外部服务</li>
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-[120px] text-ink-tertiary">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
