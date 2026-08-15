import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Code2, Link2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  type MockApiPayload,
  useCreateMockApi,
  useDeleteMockApi,
  useMockApi,
  useTestMockApi,
  useUpdateMockApi,
} from '@/hooks/queries/use-mock-apis';
import { useCallbackConfig } from '@/hooks/queries/use-callback-config';
import { useProject } from '@/hooks/queries/use-projects';
import { useFeatureGroups } from '@/hooks/queries/use-feature-groups';
import type { MockApi } from '@/types/api';
import { genId } from '@/lib/id';
import {
  type FeatureVisibility,
  loadApiEditPrefs,
  loadFeatureVisibility,
  saveApiEditPrefs,
  saveFeatureVisibility,
} from '@/lib/api-edit-prefs';
import { ConfigNav, type ConfigTab } from './ConfigNav';
import { ApiSwitcherPanel } from './ApiSwitcherPanel';
import { SaveStatusBar, type SaveStatusState } from './SaveStatusBar';
import { BasicPanel, type BasicExtra } from './panels/BasicPanel';
import { ParamsPanel } from './panels/ParamsPanel';
import { ResponsePanel } from './panels/ResponsePanel';
import { CallbackPanel } from './panels/CallbackPanel';
import { DataLinkPanel } from './panels/DataLinkPanel';
import { ScriptPanel } from './panels/ScriptPanel';
import { TestPanel } from './panels/TestPanel';

const HIDDEN_TAB_BY_FEATURE: Record<keyof FeatureVisibility, ConfigTab> = {
  callback: 'callback',
  datalink: 'datalink',
  script: 'script',
};

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
  const { data: callbackConfigs } = useCallbackConfig(isNew ? undefined : apiId);

  const [formData, setFormData] = useState<MockApiPayload>(() => newFormData());
  const [extra, setExtra] = useState<BasicExtra>({
    protocol: 'HTTP',
    priority: 'high',
    contentType: 'application/json',
    enabled: true,
  });
  const [tab, setTab] = useState<ConfigTab>(() => loadApiEditPrefs().tab);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [showSwitcher, setShowSwitcher] = useState(() => loadApiEditPrefs().showSwitcher);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [featureVisibility, setFeatureVisibility] = useState<FeatureVisibility>(() =>
    loadFeatureVisibility(),
  );
  const pristineRef = useRef<MockApiPayload | null>(null);

  useEffect(() => {
    saveApiEditPrefs({ tab });
  }, [tab]);

  useEffect(() => {
    saveApiEditPrefs({ showSwitcher });
  }, [showSwitcher]);

  useEffect(() => {
    saveFeatureVisibility(featureVisibility);
  }, [featureVisibility]);

  // 当前 tab 被隐藏时回到 basic
  useEffect(() => {
    const hiddenTabs = new Set(
      (Object.entries(featureVisibility) as Array<[keyof FeatureVisibility, boolean]>)
        .filter(([, v]) => !v)
        .map(([k]) => HIDDEN_TAB_BY_FEATURE[k]),
    );
    if (hiddenTabs.has(tab)) setTab('basic');
  }, [featureVisibility, tab]);

  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(false), 2400);
    return () => window.clearTimeout(t);
  }, [justSaved]);

  const prevApiIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (api && !isNew) {
      // 仅在 api id 变化时（初次加载 / 切换接口）重置 formData，避免 refetch 时覆盖未保存的修改
      if (prevApiIdRef.current === undefined || prevApiIdRef.current !== api.id) {
        const initial = apiToFormData(api);
        setFormData(initial);
        pristineRef.current = initial;
        prevApiIdRef.current = api.id;
        setSaveError(null);
        setJustSaved(false);
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

  const isDirty = useMemo(() => {
    if (isNew) return !!(formData.name.trim() || formData.path.trim() !== '/');
    if (!pristineRef.current) return false;
    return JSON.stringify(formData) !== JSON.stringify(pristineRef.current);
  }, [formData, isNew]);

  // 用户编辑后清除先前的错误状态
  useEffect(() => {
    if (saveError) setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(formData)]);

  const canSave = tab !== 'test';
  const saveStatusState: SaveStatusState = useMemo(() => {
    if (saveError) return 'error';
    if (saving) return 'saving';
    if (justSaved) return 'saved';
    if (isDirty) return 'dirty';
    return 'pristine';
  }, [saveError, saving, justSaved, isDirty]);

  const featureState = useMemo(
    () => ({
      hasCallback: !!callbackConfigs && callbackConfigs.length > 0,
      callbackCount: callbackConfigs?.length ?? 0,
      hasDataLink: (formData.dataOp ?? 'none') !== 'none',
      dataOp: formData.dataOp ?? 'none',
      dataTable: formData.dataTable ?? null,
      hasScript: !!(formData.script && formData.script.trim()),
      scriptLines: formData.script ? formData.script.split('\n').length : 0,
    }),
    [callbackConfigs, formData.dataOp, formData.dataTable, formData.script],
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
    setSaveError(null);
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
        const fresh = apiToFormData(updated);
        setFormData(fresh);
        pristineRef.current = fresh;
        setLastSavedAt(updated.updatedAt);
        setJustSaved(true);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ROUTE_CONFLICT') {
        toast.error('路由冲突：' + err.message);
        setTab('basic');
        return;
      }
      const msg = formatApiError(err);
      setSaveError(msg);
      toast.error(msg);
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
    <div className="relative flex flex-col" style={{ height: 'calc(100vh - 54px)' }}>
      <div
        className={cn(
          'grid min-h-0 flex-1',
          showSwitcher && activeGroup && !isNew
            ? 'xl:grid-cols-[264px_1fr_240px] lg:grid-cols-[264px_1fr]'
            : 'lg:grid-cols-[264px_1fr] grid-cols-[1fr]',
        )}
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
          hiddenTabs={
            new Set(
              (Object.entries(featureVisibility) as Array<[keyof FeatureVisibility, boolean]>)
                .filter(([, v]) => !v)
                .map(([k]) => HIDDEN_TAB_BY_FEATURE[k]),
            )
          }
          showSwitcher={showSwitcher}
          onToggleSwitcher={() => setShowSwitcher(!showSwitcher)}
        />

        {/* 主内容区 */}
        <div className="overflow-y-auto bg-canvas">
          <SaveStatusBar
            state={saveStatusState}
            lastSavedAt={lastSavedAt}
            errorMessage={saveError ?? undefined}
            canSave={canSave}
            onSave={() => handleSave()}
            saving={saving}
          />
          {tab === 'basic' && (
            <BasicPanel
              formData={formData}
              onChange={setFormData}
              groupName={activeGroup?.name}
              onSave={handleSave}
              saving={saving}
              extra={extra}
              onExtraChange={setExtra}
              onTabChange={setTab}
              featureRows={[
                {
                  id: 'callback',
                  label: '延迟回调',
                  tab: 'callback',
                  icon: Send,
                  status: {
                    configured: featureState.hasCallback,
                    summary:
                      featureState.callbackCount > 0
                        ? `已配置 ${featureState.callbackCount} 条`
                        : '',
                  },
                  hidden: !featureVisibility.callback,
                },
                {
                  id: 'datalink',
                  label: '数据联动',
                  tab: 'datalink',
                  icon: Link2,
                  status: {
                    configured: featureState.hasDataLink,
                    summary:
                      featureState.hasDataLink && featureState.dataTable
                        ? `${featureState.dataOp} → ${featureState.dataTable}`
                        : '',
                  },
                  hidden: !featureVisibility.datalink,
                },
                {
                  id: 'script',
                  label: '自定义脚本',
                  tab: 'script',
                  icon: Code2,
                  status: {
                    configured: featureState.hasScript,
                    summary:
                      featureState.hasScript && featureState.scriptLines > 0
                        ? `${featureState.scriptLines} 行`
                        : '',
                  },
                  hidden: !featureVisibility.script,
                },
              ]}
              onToggleFeatureHidden={(id, hidden) =>
                setFeatureVisibility((prev) => ({ ...prev, [id]: !hidden }))
              }
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

        {/* 右侧 ApiSwitcherPanel */}
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
