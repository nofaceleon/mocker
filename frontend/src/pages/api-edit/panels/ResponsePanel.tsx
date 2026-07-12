import { useState, useRef } from 'react';
import { Check, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Card, FormField, Input, Button } from '@/components/ui';
import type { MockApiPayload } from '@/hooks/queries/use-mock-apis';
import type { MockApiResponse } from '@/types/api';
import { PanelHeader } from '../PanelHeader';
import { PanelActions } from '../PanelActions';
import { ResponseItemCard } from './ResponseItemCard';

type SSEEvent = {
  id?: string;
  event?: string;
  data: unknown;
  retry?: number;
};

type SSEConfig = {
  events: SSEEvent[];
  interval?: number;
  loop?: boolean;
  comment?: string;
};

type ResponsePanelProps = {
  formData: MockApiPayload;
  onChange: (next: MockApiPayload) => void;
  onSave: (data?: Partial<MockApiPayload>) => void;
  saving?: boolean;
};

export function ResponsePanel({ formData, onChange, onSave, saving }: ResponsePanelProps) {
  const isSSE = formData.protocol === 'SSE';
  const isWebSocket = formData.protocol === 'WebSocket';

  // SSE配置状态
  const [sseConfig, setSSEConfig] = useState<SSEConfig>(() => {
    if (!isSSE) return { events: [], interval: 500, loop: false };
    const body = formData.responseBody as Record<string, unknown> | null;
    if (body && Array.isArray(body.events)) {
      return {
        events: body.events as SSEEvent[],
        interval: (body.interval as number) ?? 500,
        loop: body.loop === true,
        comment: body.comment as string | undefined,
      };
    }
    return { events: [], interval: 500, loop: false };
  });

  const handleSSESave = () => {
    const sseData: Partial<MockApiPayload> = {
      responseBody: sseConfig,
      responseContentType: 'text/event-stream',
    };
    onChange({ ...formData, ...sseData });
    onSave(sseData);
  };

  // ---- 多响应操作（HTTP） ----

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragElRef = useRef<HTMLElement | null>(null);

  const addResponse = () => {
    const newResponse: MockApiResponse = {
      id: crypto.randomUUID(),
      name: `响应 ${(formData.responses?.length ?? 0) + 1}`,
      conditions: [],
      isDefault: false,
      responseStatus: 200,
      responseDelay: 0,
      responseDelayMax: 0,
      responseContentType: formData.responseContentType ?? 'application/json',
      responseHeaders: null,
      responseBody: null,
    };
    onChange({ ...formData, responses: [...(formData.responses ?? []), newResponse] });
  };

  const updateResponse = (index: number, next: MockApiResponse) => {
    const updated = [...(formData.responses ?? [])];
    updated[index] = next;
    onChange({ ...formData, responses: updated });
  };

  const removeResponse = (index: number) => {
    const next = (formData.responses ?? []).filter((_, i) => i !== index);
    onChange({ ...formData, responses: next.length > 0 ? next : null });
  };

  const moveResponse = (from: number, to: number) => {
    const list = [...(formData.responses ?? [])];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    onChange({ ...formData, responses: list });
  };

  const handleMultiResponseSave = () => {
    onSave({ responses: formData.responses });
  };

  // ---- SSE 事件 ----

  const addSSEEvent = () => {
    setSSEConfig({
      ...sseConfig,
      events: [...sseConfig.events, { event: 'message', data: { text: '' } }],
    });
  };

  const updateSSEEvent = (index: number, event: SSEEvent) => {
    const newEvents = [...sseConfig.events];
    newEvents[index] = event;
    setSSEConfig({ ...sseConfig, events: newEvents });
  };

  const removeSSEEvent = (index: number) => {
    setSSEConfig({
      ...sseConfig,
      events: sseConfig.events.filter((_, i) => i !== index),
    });
  };

  const handleSSEDataChange = (index: number, dataText: string) => {
    try {
      const data = JSON.parse(dataText);
      updateSSEEvent(index, { ...sseConfig.events[index], data });
    } catch {
      // 保持原始文本，让用户继续编辑
    }
  };

  return (
    <div className="mx-auto max-w-[880px] px-8 pb-12 pt-7">
      <PanelHeader
        icon={Check}
        title="响应配置"
        description={
          isSSE
            ? '配置 SSE（Server-Sent Events）事件流：事件类型、数据内容、发送间隔。'
            : isWebSocket
              ? '配置 WebSocket：welcome 欢迎消息、echo、pushInterval 推送、disconnectAfterMs 模拟断开。消息处理可用「自定义脚本」。'
              : '配置多个响应，通过条件自动匹配或手动选择。匹配按列表顺序从上到下，第一个满足条件的响应被选中。'
        }
      />

      {/* HTTP 多响应列表 */}
      {!isSSE && !isWebSocket && (
        <div className="space-y-3">
          {(formData.responses ?? []).map((resp, index) => (
            <ResponseItemCard
              key={resp.id}
              item={resp}
              isSSE={isSSE}
              onChange={(next) => updateResponse(index, next)}
              onRemove={() => removeResponse(index)}
              isDragOver={dragOverIndex === index}
              dragHandleProps={{
                draggable: true,
                onDragStart: (e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                  const el = (e.currentTarget as HTMLElement).closest('.rounded-lg') as HTMLElement | null;
                  if (el) {
                    el.style.opacity = '0.4';
                    dragElRef.current = el;
                  }
                },
                onDragOver: (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverIndex(index);
                },
                onDrop: (e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData('text/plain'));
                  if (from !== index) {
                    moveResponse(from, index);
                  }
                  setDragOverIndex(null);
                },
                onDragEnd: () => {
                  if (dragElRef.current) {
                    dragElRef.current.style.opacity = '';
                    dragElRef.current = null;
                  }
                  setDragOverIndex(null);
                },
              }}
            />
          ))}

          <Button variant="secondary" onClick={addResponse} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            添加响应
          </Button>

          <PanelActions
            hint="下次请求生效"
            onSave={handleMultiResponseSave}
            saving={saving}
          />
        </div>
      )}

      {/* SSE / WebSocket 配置 */}
      {(isSSE || isWebSocket) && (
        <>
          <Card title="响应基本信息">
            <div className="form-row three-col">
              {isSSE && (
                <FormField label="事件间隔" hint="毫秒">
                  <Input
                    type="number"
                    min={100}
                    max={60000}
                    value={sseConfig.interval ?? 500}
                    onChange={(e) => setSSEConfig({ ...sseConfig, interval: Number(e.target.value) || 500 })}
                  />
                </FormField>
              )}
            </div>

            {isSSE && (
              <div className="form-row">
                <FormField label="循环发送">
                  <div className="flex items-center gap-2 pt-1.5">
                    <input
                      type="checkbox"
                      checked={sseConfig.loop ?? false}
                      onChange={(e) => setSSEConfig({ ...sseConfig, loop: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-[12.5px] text-ink-secondary">事件发送完毕后循环发送</span>
                  </div>
                </FormField>
                <FormField label="初始注释" hint="可选">
                  <Input
                    value={sseConfig.comment ?? ''}
                    onChange={(e) => setSSEConfig({ ...sseConfig, comment: e.target.value || undefined })}
                    placeholder="连接建立时的注释内容"
                  />
                </FormField>
              </div>
            )}
          </Card>

          {isSSE ? (
            <Card title="SSE 事件配置">
              <div className="info-tip mb-4">
                <AlertCircle />
                <div>
                  配置 SSE 事件流。每个事件包含 <code>event</code>（事件类型）、<code>data</code>（数据内容）。
                  支持变量插值：<code>{'{{req.body.xxx}}'}</code>
                </div>
              </div>

              <div className="space-y-4">
                {sseConfig.events.map((event, index) => (
                  <div key={index} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[13px] font-medium">事件 {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSSEEvent(index)}
                        className="text-danger hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="form-row three-col">
                      <FormField label="事件类型">
                        <Input
                          value={event.event ?? ''}
                          onChange={(e) => updateSSEEvent(index, { ...event, event: e.target.value || undefined })}
                          placeholder="message"
                        />
                      </FormField>
                      <FormField label="事件 ID">
                        <Input
                          value={event.id ?? ''}
                          onChange={(e) => updateSSEEvent(index, { ...event, id: e.target.value || undefined })}
                          placeholder="可选"
                        />
                      </FormField>
                      <FormField label="重试间隔">
                        <Input
                          type="number"
                          min={0}
                          value={event.retry ?? ''}
                          onChange={(e) => updateSSEEvent(index, { ...event, retry: Number(e.target.value) || undefined })}
                          placeholder="可选"
                        />
                      </FormField>
                    </div>

                    <FormField label="事件数据">
                      <textarea
                        value={safeStringify(event.data)}
                        onChange={(e) => handleSSEDataChange(index, e.target.value)}
                        rows={4}
                        className="form-textarea mono mono-dark !text-[12.5px]"
                        placeholder='{"text": "Hello, World!"}'
                      />
                    </FormField>
                  </div>
                ))}

                <Button variant="secondary" onClick={addSSEEvent} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  添加事件
                </Button>
              </div>
            </Card>
          ) : (
            <Card title="WebSocket 配置">
              <div className="info-tip">
                <AlertCircle />
                <div>
                  WebSocket 配置示例：
                  <code>{`{ "welcome": { "type": "welcome" }, "echo": true, "pushInterval": 0, "disconnectAfterMs": 0 }`}</code>
                  。客户端消息默认 echo；启用脚本后由 <code>handle(req, db, log)</code> 返回回包。
                </div>
              </div>
            </Card>
          )}

          <PanelActions
            hint="下次请求生效"
            onSave={handleSSESave}
            saving={saving}
          />
        </>
      )}
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
