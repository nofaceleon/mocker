import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { Button, Input, MethodBadge, Modal, Select } from '@/components/ui';
import type { ID, HttpMethod } from '@/types/api';
import type {
  SwaggerImportDecision,
  SwaggerImportDecisionAction,
  SwaggerImportItem,
  SwaggerImportParseResponse,
} from '@/types/api';
import { useCommitSwagger, useParseSwagger } from '@/hooks/queries/use-swagger-import';

type Phase = 'upload' | 'preview' | 'submitting';

type Props = {
  open: boolean;
  featureGroupId: ID;
  onClose: () => void;
  onCompleted?: () => void;
};

const METHOD_FILTERS: Array<HttpMethod | 'all'> = ['all', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

export function SwaggerImportModal({ open, featureGroupId, onClose, onCompleted }: Props) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<SwaggerImportParseResponse | null>(null);
  const [decisions, setDecisions] = useState<Record<number, SwaggerImportDecisionAction>>({});
  const [nameOverrides, setNameOverrides] = useState<Record<number, string>>({});
  const [methodFilter, setMethodFilter] = useState<HttpMethod | 'all'>('all');
  const [conflictOnly, setConflictOnly] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseMut = useParseSwagger();
  const commitMut = useCommitSwagger();

  const reset = useCallback(() => {
    setPhase('upload');
    setFileName('');
    setContent('');
    setError(null);
    setParseResult(null);
    setDecisions({});
    setNameOverrides({});
    setMethodFilter('all');
    setConflictOnly(false);
  }, []);

  const handleClose = () => {
    if (phase === 'submitting') return;
    reset();
    onClose();
  };

  const readFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError(`文件过大（${(file.size / 1024 / 1024).toFixed(2)} MB），最大支持 5MB`);
      return;
    }
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = typeof e.target?.result === 'string' ? e.target.result : '';
      setContent(text);
    };
    reader.onerror = () => {
      setError('文件读取失败');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const handleParse = async () => {
    if (!content.trim()) {
      setError('请先选择文件或粘贴文本');
      return;
    }
    setError(null);
    try {
      const result = await parseMut.mutateAsync({
        featureGroupId,
        fileName: fileName || 'swagger.json',
        content,
      });
      setParseResult(result);
      // 默认决策：无冲突→create，有冲突→skip
      const initial: Record<number, SwaggerImportDecisionAction> = {};
      for (const item of result.items) {
        if (!item.isSupported) {
          initial[item.index] = 'skip';
        } else if (item.conflict) {
          initial[item.index] = 'skip';
        } else {
          initial[item.index] = 'create';
        }
      }
      setDecisions(initial);
      setNameOverrides({});
      setPhase('preview');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message}${err.details ? '：' + JSON.stringify(err.details) : ''}`
          : err instanceof Error
            ? err.message
            : '解析失败';
      setError(msg);
    }
  };

  const visibleItems = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.items.filter((item) => {
      if (methodFilter !== 'all' && item.method !== methodFilter) return false;
      if (conflictOnly && !item.conflict) return false;
      return true;
    });
  }, [parseResult, methodFilter, conflictOnly]);

  const stats = useMemo(() => {
    if (!parseResult) return { create: 0, overwrite: 0, skip: 0 };
    let create = 0;
    let overwrite = 0;
    let skip = 0;
    for (const item of parseResult.items) {
      const action = decisions[item.index] ?? 'skip';
      if (action === 'create') create += 1;
      else if (action === 'overwrite') overwrite += 1;
      else skip += 1;
    }
    return { create, overwrite, skip };
  }, [parseResult, decisions]);

  const setAllVisible = (action: SwaggerImportDecisionAction) => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const item of visibleItems) {
        if (!item.isSupported && action !== 'skip') continue;
        next[item.index] = action;
      }
      return next;
    });
  };

  const handleCommit = async () => {
    if (!parseResult) return;
    const decisionList: SwaggerImportDecision[] = parseResult.items.map((item) => {
      const action = decisions[item.index] ?? 'skip';
      const override = nameOverrides[item.index];
      const decision: SwaggerImportDecision = { index: item.index, action };
      if (override && override.trim() && override.trim() !== item.name) {
        decision.name = override.trim();
      }
      return decision;
    });
    const hasAny =
      decisionList.some((d) => d.action !== 'skip') || parseResult.items.length === 0;
    if (!hasAny) {
      toast.error('没有需要导入的接口');
      return;
    }
    setPhase('submitting');
    try {
      const result = await commitMut.mutateAsync({
        featureGroupId,
        decisions: decisionList,
        items: parseResult.items,
      });
      const parts: string[] = [];
      if (result.created > 0) parts.push(`新建 ${result.created}`);
      if (result.overwritten > 0) parts.push(`覆盖 ${result.overwritten}`);
      if (result.skipped > 0) parts.push(`跳过 ${result.skipped}`);
      if (result.errors.length > 0) {
        parts.push(`失败 ${result.errors.length}`);
      }
      toast.success(`导入完成：${parts.join('，')}`);
      onCompleted?.();
      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导入失败';
      toast.error(msg);
      setPhase('preview');
    }
  };

  const editingNameFor = (idx: number, original: string) => {
    return nameOverrides[idx] !== undefined ? nameOverrides[idx] : original;
  };

  const setNameOverride = (idx: number, value: string) => {
    setNameOverrides((prev) => ({ ...prev, [idx]: value }));
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="从 Swagger / OpenAPI 导入"
      width="xl"
      footer={
        phase === 'upload' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleParse}
              loading={parseMut.isPending}
              disabled={!content.trim()}
            >
              {parseMut.isPending ? '解析中...' : '解析预览'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setPhase('upload')}>
              返回上一步
            </Button>
            <Button
              variant="primary"
              onClick={handleCommit}
              loading={commitMut.isPending}
              disabled={stats.create + stats.overwrite === 0}
            >
              确认导入（{stats.create + stats.overwrite}）
            </Button>
          </>
        )
      }
    >
      {phase === 'upload' && (
        <UploadPhase
          fileName={fileName}
          content={content}
          error={error}
          isDragging={isDragging}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onPasteText={setContent}
          onClearFile={() => {
            setFileName('');
            setContent('');
            setError(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      )}
      {phase === 'preview' && parseResult && (
        <PreviewPhase
          specTitle={parseResult.specInfo.title}
          specVersion={parseResult.specInfo.version}
          openApiVersion={parseResult.specInfo.openApiVersion}
          totalCount={parseResult.summary.total}
          conflictCount={parseResult.summary.conflicts}
          supportedCount={parseResult.summary.supported}
          visibleItems={visibleItems}
          decisions={decisions}
          methodFilter={methodFilter}
          onMethodFilterChange={setMethodFilter}
          conflictOnly={conflictOnly}
          onConflictOnlyChange={setConflictOnly}
          editingNameFor={editingNameFor}
          setNameOverride={setNameOverride}
          setAllVisible={setAllVisible}
          setDecision={(idx, action) =>
            setDecisions((prev) => ({ ...prev, [idx]: action }))
          }
          stats={stats}
        />
      )}
      {phase === 'submitting' && (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-ink-secondary" />
          <p className="text-[13px] text-ink-secondary">正在提交导入...</p>
        </div>
      )}
    </Modal>
  );
}

// ============== UploadPhase ==============

type UploadPhaseProps = {
  fileName: string;
  content: string;
  error: string | null;
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onPasteText: (text: string) => void;
  onClearFile: () => void;
};

function UploadPhase({
  fileName,
  content,
  error,
  isDragging,
  fileInputRef,
  onFileChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onPasteText,
  onClearFile,
}: UploadPhaseProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-line bg-canvas-subtle/40 p-3 text-[12px] text-ink-tertiary">
        <p>
          支持 <code className="text-ink-secondary">swagger 2.0</code> 和{' '}
          <code className="text-ink-secondary">openapi 3.0.x</code> 格式的 JSON / YAML 文件。
          将解析出所有 HTTP 接口供预览与勾选。
        </p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          'rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          isDragging
            ? 'border-ink bg-canvas-subtle'
            : 'border-line bg-canvas-subtle/30 hover:border-ink-tertiary',
        ].join(' ')}
      >
        <UploadCloud className="mx-auto mb-3 h-8 w-8 text-ink-tertiary" />
        {fileName ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink">
              <FileText className="h-3.5 w-3.5 text-ink-secondary" />
              <span>{fileName}</span>
              <button
                type="button"
                onClick={onClearFile}
                className="ml-1 text-ink-subtle hover:text-danger"
                title="清除"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[11.5px] text-ink-subtle">
              已读取 {(content.length / 1024).toFixed(1)} KB ·{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-ink-secondary underline hover:text-ink"
              >
                重新选择
              </button>
            </p>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-ink-secondary">拖拽文件到此处，或</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-[13px] font-medium text-ink underline-offset-2 hover:underline"
            >
              点击选择文件
            </button>
            <p className="mt-2 text-[11.5px] text-ink-subtle">
              支持 .json / .yaml / .yml 格式，最大 5 MB
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.yaml,.yml,application/json,application/x-yaml,text/yaml"
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      <div>
        <label className="form-label">或直接粘贴文本</label>
        <textarea
          value={content}
          onChange={(e) => onPasteText(e.target.value)}
          placeholder='{"openapi": "3.0.0", ...}'
          className="form-textarea mt-1 h-32 font-mono text-[12px]"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ============== PreviewPhase ==============

type PreviewPhaseProps = {
  specTitle: string;
  specVersion: string;
  openApiVersion: string;
  totalCount: number;
  conflictCount: number;
  supportedCount: number;
  visibleItems: SwaggerImportItem[];
  decisions: Record<number, SwaggerImportDecisionAction>;
  methodFilter: HttpMethod | 'all';
  onMethodFilterChange: (v: HttpMethod | 'all') => void;
  conflictOnly: boolean;
  onConflictOnlyChange: (v: boolean) => void;
  editingNameFor: (idx: number, original: string) => string;
  setNameOverride: (idx: number, v: string) => void;
  setAllVisible: (action: SwaggerImportDecisionAction) => void;
  setDecision: (idx: number, action: SwaggerImportDecisionAction) => void;
  stats: { create: number; overwrite: number; skip: number };
};

function PreviewPhase({
  specTitle,
  specVersion,
  openApiVersion,
  totalCount,
  conflictCount,
  supportedCount,
  visibleItems,
  decisions,
  methodFilter,
  onMethodFilterChange,
  conflictOnly,
  onConflictOnlyChange,
  editingNameFor,
  setNameOverride,
  setAllVisible,
  setDecision,
  stats,
}: PreviewPhaseProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border border-line bg-canvas-subtle/40 px-3 py-2">
        <div className="flex items-center gap-3 text-[12.5px]">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span className="font-medium text-ink">{specTitle}</span>
            {specVersion && (
              <span className="text-ink-subtle">v{specVersion}</span>
            )}
          </div>
          <span className="tag tag-blue text-[10.5px]">{openApiVersion}</span>
          <span className="text-ink-subtle">
            共 {totalCount} 个接口 · {supportedCount} 可导入 · {conflictCount} 冲突
          </span>
        </div>
        <div className="flex items-center gap-3 text-[12.5px] text-ink-tertiary">
          <span>
            <span className="text-green-600">{stats.create}</span> 新建 ·{' '}
            <span className="text-orange-600">{stats.overwrite}</span> 覆盖 ·{' '}
            <span className="text-ink-subtle">{stats.skip}</span> 跳过
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={methodFilter}
          onChange={(e) => onMethodFilterChange(e.target.value as HttpMethod | 'all')}
          className="h-8 text-[12px]"
        >
          {METHOD_FILTERS.map((m) => (
            <option key={m} value={m}>
              {m === 'all' ? '全部方法' : m}
            </option>
          ))}
        </Select>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-secondary">
          <input
            type="checkbox"
            checked={conflictOnly}
            onChange={(e) => onConflictOnlyChange(e.target.checked)}
            className="h-3 w-3 accent-ink"
          />
          仅看冲突项
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setAllVisible('create')}>
            全部新建
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAllVisible('overwrite')}>
            全部覆盖
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAllVisible('skip')}>
            全部跳过
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-line">
        <div className="max-h-[420px] overflow-y-auto scrollbar-modern">
          <table className="params-table w-full">
            <thead className="sticky top-0 bg-canvas-subtle">
              <tr>
                <th style={{ width: 32 }}></th>
                <th style={{ width: 60 }}>方法</th>
                <th>路径 / 名称</th>
                <th style={{ width: 200 }}>操作</th>
                <th style={{ width: 110 }}>状态码</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[12.5px] text-ink-subtle">
                    没有匹配的接口
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => {
                  const action = decisions[item.index] ?? 'skip';
                  const disabled = !item.isSupported;
                  return (
                    <PreviewRow
                      key={item.index}
                      item={item}
                      action={action}
                      disabled={disabled}
                      onChangeAction={(a) => setDecision(item.index, a)}
                      nameValue={editingNameFor(item.index, item.name)}
                      onChangeName={(v) => setNameOverride(item.index, v)}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  item,
  action,
  disabled,
  onChangeAction,
  nameValue,
  onChangeName,
}: {
  item: SwaggerImportItem;
  action: SwaggerImportDecisionAction;
  disabled: boolean;
  onChangeAction: (a: SwaggerImportDecisionAction) => void;
  nameValue: string;
  onChangeName: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <tr className={disabled ? 'opacity-50' : undefined}>
      <td>
        {item.conflict ? (
          <AlertTriangle
            className={`h-3.5 w-3.5 ${item.conflict.kind === 'route' ? 'text-orange-500' : 'text-blue-500'}`}
            aria-label={
              item.conflict.kind === 'route'
                ? `路由冲突：与 #${item.conflict.existingId} ${item.conflict.existingMethod} ${item.conflict.existingPath} 重复`
                : `名称重复：与 #${item.conflict.existingId} ${item.conflict.existingName} 同名`
            }
          />
        ) : item.isSupported ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <X className="h-3.5 w-3.5 text-ink-subtle" />
        )}
      </td>
      <td>
        <MethodBadge method={item.method} />
      </td>
      <td>
        <div className="flex flex-col gap-1">
          <code className="param-code text-[11.5px]" title={item.path}>
            {item.path}
          </code>
          {editing && !disabled ? (
            <Input
              autoFocus
              value={nameValue}
              onChange={(e) => onChangeName(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setEditing(false);
              }}
              className="h-7 text-[12px]"
              maxLength={100}
            />
          ) : (
            <button
              type="button"
              onClick={() => !disabled && setEditing(true)}
              className={`text-left text-[12px] ${
                disabled
                  ? 'cursor-default text-ink-subtle'
                  : 'cursor-text text-ink hover:text-ink-inverse'
              }`}
              title={disabled ? '不支持的协议' : '点击编辑名称'}
            >
              {nameValue}
            </button>
          )}
          {item.description && (
            <span className="line-clamp-1 text-[10.5px] text-ink-subtle">
              {item.description}
            </span>
          )}
          {item.conflict && (
            <ConflictHint item={item} />
          )}
          {disabled && item.unsupportedReason && (
            <span className="text-[10.5px] text-ink-subtle">{item.unsupportedReason}</span>
          )}
        </div>
      </td>
      <td>
        <ActionPicker
          action={action}
          disabled={disabled}
          hasConflict={!!item.conflict}
          onChange={onChangeAction}
        />
      </td>
      <td>
        <span className="tag-pill">{item.responseStatus}</span>
      </td>
    </tr>
  );
}

function ConflictHint({ item }: { item: SwaggerImportItem }) {
  const [expanded, setExpanded] = useState(false);
  if (!item.conflict) return null;
  const c = item.conflict;
  if (c.kind === 'route') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="flex items-center gap-0.5 text-left text-[10.5px] text-orange-600 hover:underline"
      >
        {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        <span>路由冲突 #{c.existingId}</span>
        {expanded && (
          <span className="ml-1 text-ink-subtle">
            {c.existingMethod} {c.existingPath} ({c.existingName})
          </span>
        )}
      </button>
    );
  }
  return (
    <span className="text-[10.5px] text-blue-600">同名 #{c.existingId} {c.existingName}</span>
  );
}

function ActionPicker({
  action,
  disabled,
  hasConflict,
  onChange,
}: {
  action: SwaggerImportDecisionAction;
  disabled: boolean;
  hasConflict: boolean;
  onChange: (a: SwaggerImportDecisionAction) => void;
}) {
  if (disabled) {
    return <span className="text-[11px] text-ink-subtle">不支持</span>;
  }
  const options: Array<{ value: SwaggerImportDecisionAction; label: string; color: string }> = [
    { value: 'create', label: '新建', color: 'text-green-700' },
    { value: 'overwrite', label: '覆盖', color: 'text-orange-700' },
    { value: 'skip', label: '跳过', color: 'text-ink-subtle' },
  ];
  return (
    <div className="inline-flex rounded-md border border-line bg-white p-0.5 text-[11px]">
      {options.map((opt) => {
        const selected = action === opt.value;
        // 仅当存在路由冲突时才允许"覆盖"，否则覆盖灰态
        const isOverwrite = opt.value === 'overwrite';
        const disabledOpt = isOverwrite && !hasConflict;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !disabledOpt && onChange(opt.value)}
            disabled={disabledOpt}
            className={[
              'rounded px-2 py-0.5 transition-colors',
              selected
                ? 'bg-ink text-white'
                : `${opt.color} hover:bg-canvas-subtle`,
              disabledOpt ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
            ].join(' ')}
            title={disabledOpt ? '没有可覆盖的目标' : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}