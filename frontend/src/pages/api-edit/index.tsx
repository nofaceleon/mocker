import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { Button, Modal } from '@/components/ui';
import {
  type MockApiPayload,
  useCreateMockApi,
  useDeleteMockApi,
  useMockApi,
  useTestMockApi,
  useUpdateMockApi,
} from '@/hooks/queries/use-mock-apis';
import { useProject } from '@/hooks/queries/use-projects';
import { useFeatureGroups } from '@/hooks/queries/use-feature-groups';
import type { MockApi } from '@/types/api';
import { ConfigNav, type ConfigTab } from './ConfigNav';
import { BasicPanel, type BasicExtra } from './panels/BasicPanel';
import { ParamsPanel } from './panels/ParamsPanel';
import { ResponsePanel } from './panels/ResponsePanel';
import { ValidatePanel } from './panels/ValidatePanel';
import { CallbackPanel } from './panels/CallbackPanel';
import { DataLinkPanel } from './panels/DataLinkPanel';
import { ScriptPanel } from './panels/ScriptPanel';
import { TestPanel } from './panels/TestPanel';

export function ApiEditPage() {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = params.apiId === 'new' || params.apiId === undefined;
  const apiId = isNew ? undefined : Number(params.apiId);
  const projectId = Number(params.projectId);
  const gid = Number(new URLSearchParams(location.search).get('gid') ?? '0');

  const { data: project } = useProject(projectId);
  const { data: groups } = useFeatureGroups(projectId);
  const { data: api, isLoading } = useMockApi(apiId);
  const updateMut = useUpdateMockApi();
  const deleteMut = useDeleteMockApi();
  const createMut = useCreateMockApi();
  const testMut = useTestMockApi();

  const [draft, setDraft] = useState<MockApiPayload>(() => newDraft());
  const [extra, setExtra] = useState<BasicExtra>({
    protocol: 'HTTP',
    priority: 'high',
    contentType: 'application/json',
    enabled: true,
  });
  const [tab, setTab] = useState<ConfigTab>('basic');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (api && !isNew) {
      setDraft(apiToDraft(api));
      setExtra((prev) => ({
        ...prev,
        protocol: api.protocol ?? 'HTTP',
        contentType: api.responseContentType ?? prev.contentType,
      }));
      setLastSavedAt(api.updatedAt);
    }
  }, [api, isNew]);

  useEffect(() => {
    if (isNew) {
      setDraft(newDraft());
      setLastSavedAt(undefined);
    }
  }, [isNew]);

  const activeGroup = useMemo(() => {
    const resolvedGid = gid || api?.featureGroupId;
    return groups?.find((g) => g.id === resolvedGid) ?? null;
  }, [groups, gid, api?.featureGroupId]);

  const summary: MockApi = useMemo(
    () =>
      api ?? {
        id: 0,
        featureGroupId: gid,
        name: draft.name || '新建接口',
        description: draft.description ?? null,
        protocol: draft.protocol ?? 'HTTP',
        method: draft.method,
        path: draft.path,
        isEnabled: draft.isEnabled ?? true,
        sortOrder: 0,
        responseStatus: draft.responseStatus ?? 200,
        responseDelay: draft.responseDelay ?? 0,
        responseDelayMax: draft.responseDelayMax ?? 0,
        responseContentType: draft.responseContentType ?? 'application/json',
        responseHeaders: draft.responseHeaders ?? null,
        responseBody: draft.responseBody ?? null,
        validationRules: draft.validationRules ?? null,
        dataOp: draft.dataOp ?? 'none',
        dataTable: draft.dataTable ?? null,
        dataWhere: draft.dataWhere ?? null,
        script: draft.script ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mockDataCount: 0,
      },
    [api, draft, gid],
  );

  const saving = updateMut.isPending || createMut.isPending;
  const configSummary = {
    name: summary.name,
    isEnabled: summary.isEnabled,
    groupName: activeGroup?.name ?? (isNew ? '新建接口' : '未分组'),
    calledCount: api?.mockDataCount,
    lastSavedAt,
    lastCalledAt: api?.updatedAt,
  };

  if ((!isNew && isLoading) || (!isNew && !api)) {
    return (
      <div className="page-container">
        <div className="text-[13px] text-ink-tertiary">加载中...</div>
      </div>
    );
  }

  const handleSave = async (data?: Partial<MockApiPayload>) => {
    try {
      // 合并data到draft
      const saveData = data ? { ...draft, ...data } : draft;

      if (isNew) {
        if (!gid) {
          toast.error('缺少功能组 ID');
          setTab('basic');
          return;
        }
        const created = await createMut.mutateAsync({ featureGroupId: gid, body: saveData });
        toast.success('接口已创建');
        navigate(`/projects/${projectId}/apis/${created.id}`);
      } else if (api) {
        const updated = await updateMut.mutateAsync({ id: api.id, data: saveData });
        toast.success('已保存');
        setDraft(apiToDraft(updated));
        setLastSavedAt(updated.updatedAt);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ROUTE_CONFLICT') {
        toast.error('路由冲突：' + err.message);
        setTab('basic');
        return;
      }
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

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 54px)' }}>
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: '264px 1fr' }}>
        <ConfigNav
          current={tab}
          onChange={setTab}
          method={summary.method}
          path={summary.path}
          breadcrumb={[
            { label: '项目', to: '/projects' },
            { label: project?.name ?? '...', to: `/projects/${projectId}` },
            ...(activeGroup ? [{ label: activeGroup.name, to: `/projects/${projectId}` }] : []),
          ]}
          onLogClick={() => navigate(`/logs?projectId=${projectId}${apiId ? `&apiId=${apiId}` : ''}`)}
          summary={configSummary}
        />

        <div className="overflow-y-auto bg-canvas">
          {tab === 'basic' && (
            <BasicPanel
              draft={draft}
              onChange={setDraft}
              groupName={activeGroup?.name}
              onSave={handleSave}
              saving={saving}
              extra={extra}
              onExtraChange={setExtra}
            />
          )}
          {tab === 'params' && <ParamsPanel draft={draft} onChange={setDraft} onSave={handleSave} saving={saving} />}
          {tab === 'response' && <ResponsePanel draft={draft} onChange={setDraft} onSave={handleSave} saving={saving} />}
          {tab === 'validate' && <ValidatePanel draft={draft} onChange={setDraft} onSave={handleSave} saving={saving} />}
          {tab === 'callback' && api && (
            <CallbackPanel apiId={api.id} onSave={handleSave} saving={saving} />
          )}
          {tab === 'datalink' && <DataLinkPanel draft={draft} onChange={setDraft} onSave={handleSave} saving={saving} />}
          {tab === 'script' && <ScriptPanel draft={draft} onChange={setDraft} onSave={handleSave} saving={saving} />}
          {tab === 'test' && (
            <TestPanel api={summary} onRun={async (input) => testMut.mutateAsync({ id: summary.id, input })} />
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
          确定删除 <b>{summary.name}</b>（{summary.method} {summary.path}）吗？该操作不可恢复。
        </p>
      </Modal>
    </div>
  );
}

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
    protocol: api.protocol,
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

function formatApiError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : '操作失败';
}