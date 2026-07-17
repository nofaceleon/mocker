import { useEffect, useMemo, useRef, useState } from 'react';
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
import { genId } from '@/lib/id';
import { ConfigNav, type ConfigTab } from './ConfigNav';
import { ApiSwitcherPanel } from './ApiSwitcherPanel';
import { BasicPanel, type BasicExtra } from './panels/BasicPanel';
import { ParamsPanel } from './panels/ParamsPanel';
import { ResponsePanel } from './panels/ResponsePanel';
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

  const [formData, setFormData] = useState<MockApiPayload>(() => newFormData());
  const [extra, setExtra] = useState<BasicExtra>({
    protocol: 'HTTP',
    priority: 'high',
    contentType: 'application/json',
    enabled: true,
  });
  const [tab, setTab] = useState<ConfigTab>('basic');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [showSwitcher, setShowSwitcher] = useState(true);

  const prevApiIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (api && !isNew) {
      // 仅在 api id 变化时（初次加载 / 切换接口）重置 formData，避免 refetch 时覆盖未保存的修改
      if (prevApiIdRef.current === undefined || prevApiIdRef.current !== api.id) {
        setFormData(apiToFormData(api));
        prevApiIdRef.current = api.id;
      }
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
      setFormData(newFormData());
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
        name: formData.name || '新建接口',
        description: formData.description ?? null,
        protocol: formData.protocol ?? 'HTTP',
        method: formData.method,
        path: formData.path,
        isEnabled: formData.isEnabled ?? true,
        sortOrder: 0,
        responseStatus: formData.responseStatus ?? 200,
        responseDelay: formData.responseDelay ?? 0,
        responseDelayMax: formData.responseDelayMax ?? 0,
        responseContentType: formData.responseContentType ?? 'application/json',
        responseHeaders: formData.responseHeaders ?? null,
        responseBody: formData.responseBody ?? null,
        validationRules: formData.validationRules ?? null,
        dataOp: formData.dataOp ?? 'none',
        dataTable: formData.dataTable ?? null,
        dataWhere: formData.dataWhere ?? null,
        dataPayload: formData.dataPayload ?? null,
        script: formData.script ?? null,
        responses: formData.responses ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mockDataCount: 0,
      },
    [api, formData, gid],
  );

  const saving = updateMut.isPending || createMut.isPending;
  const featureState = useMemo(
    () => ({
      hasCallback: summary.hasCallback,
      hasDataLink: (formData.dataOp ?? 'none') !== 'none',
      hasScript: !!(formData.script && formData.script.trim()),
    }),
    [summary.hasCallback, formData.dataOp, formData.script],
  );
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
      // 合并data到formData
      const saveData = data ? { ...formData, ...data } : formData;

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
        setFormData(apiToFormData(updated));
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
      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns:
            showSwitcher && activeGroup && !isNew ? '264px 1fr 240px' : '264px 1fr',
        }}
      >
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
          onLogClick={() =>
            navigate(`/logs?projectId=${projectId}${apiId ? `&apiId=${apiId}` : ''}`)
          }
          summary={configSummary}
          featureState={featureState}
          showSwitcher={showSwitcher}
          onToggleSwitcher={() => setShowSwitcher(!showSwitcher)}
        />

        <div className="overflow-y-auto bg-canvas">
          {tab === 'basic' && (
            <BasicPanel
              formData={formData}
              onChange={setFormData}
              groupName={activeGroup?.name}
              onSave={handleSave}
              saving={saving}
              extra={extra}
              onExtraChange={setExtra}
            />
          )}
          {tab === 'params' && (
            <ParamsPanel
              formData={formData}
              onChange={setFormData}
              onSave={handleSave}
              saving={saving}
            />
          )}
          {tab === 'response' && (
            <ResponsePanel
              formData={formData}
              onChange={setFormData}
              onSave={handleSave}
              saving={saving}
            />
          )}
          {tab === 'callback' && api && (
            <CallbackPanel
              apiId={api.id}
              onSave={() => setLastSavedAt(new Date().toISOString())}
              saving={saving}
            />
          )}
          {tab === 'datalink' && (
            <DataLinkPanel
              formData={formData}
              onChange={setFormData}
              onSave={handleSave}
              saving={saving}
            />
          )}
          {tab === 'script' && (
            <ScriptPanel
              formData={formData}
              onChange={setFormData}
              onSave={handleSave}
              saving={saving}
            />
          )}
          {tab === 'test' && (
            <TestPanel
              api={summary}
              onRun={async (input) => testMut.mutateAsync({ id: summary.id, input })}
            />
          )}
        </div>

        {showSwitcher && activeGroup && !isNew && (
          <ApiSwitcherPanel
            projectId={projectId}
            featureGroupId={activeGroup.id}
            currentApiId={apiId}
            onSwitch={(api) => navigate(`/projects/${projectId}/apis/${api.id}`)}
            onClose={() => setShowSwitcher(false)}
          />
        )}
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

function newFormData(): MockApiPayload {
  const defaultResponse: import('@/types/api').MockApiResponse = {
    id: genId(),
    name: '默认响应',
    conditions: [],
    isDefault: true,
    responseStatus: 200,
    responseDelay: 0,
    responseDelayMax: 0,
    responseContentType: 'application/json',
    responseHeaders: { 'Content-Type': 'application/json' },
    responseBody: { code: 0, message: 'success', data: {} },
  };
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
    dataPayload: null,
    script: null,
    responses: [defaultResponse],
  };
}

function apiToFormData(api: MockApi): MockApiPayload {
  // 旧接口没有 responses 数据时，从扁平字段生成默认响应
  let responses = api.responses;
  if (!responses || responses.length === 0) {
    responses = [
      {
        id: genId(),
        name: '默认响应',
        conditions: [],
        isDefault: true,
        responseStatus: api.responseStatus ?? 200,
        responseDelay: api.responseDelay ?? 0,
        responseDelayMax: api.responseDelayMax ?? 0,
        responseContentType: api.responseContentType ?? 'application/json',
        responseHeaders: api.responseHeaders ?? null,
        responseBody: api.responseBody ?? null,
      },
    ];
  }

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
    dataPayload: api.dataPayload ?? null,
    script: api.script,
    responses,
  };
}

function formatApiError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : '操作失败';
}
