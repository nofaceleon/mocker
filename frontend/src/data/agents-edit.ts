/**
 * MockHub「AI 对话编辑」提示词。
 * 在项目详情页注入 PROJECT_ID / BASE_URL 后复制给 Cursor 等本地 Agent。
 */

import AGENTS_EDIT_MANUAL from '../assets/agents-edit.md?raw';
import { config } from '@/lib/runtime-config';

export { AGENTS_EDIT_MANUAL };

export const AGENTS_EDIT_URLS = {
  manual: '/agents-edit.md',
} as const;

export type AgentsEditContext = {
  projectId: number;
  projectName: string;
  /** 外部 Agent 应使用的管理 API 根（默认 http://host:3000） */
  baseUrl?: string;
};

/** 解析给外部 Agent 用的 BASE_URL（直连后端端口，不走 Vite 5173） */
export function resolveAgentBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  const port = config.backendPort || 3000;
  const host = window.location.hostname || 'localhost';
  return `http://${host}:${port}`;
}

/** 组装可直接粘贴给 AI 的完整提示词（含项目上下文 + 操作手册） */
export function buildAgentsEditPrompt(ctx: AgentsEditContext): string {
  const baseUrl = ctx.baseUrl ?? resolveAgentBaseUrl();
  return `# MockHub 对话编辑任务

你是 MockHub 的接口运维助手。请严格按下方「操作手册」通过 HTTP 调用本机管理 API，
完成用户后续用自然语言提出的接口增删改查与自测。不要只给建议而不调用 API。

## 本机上下文（已注入，勿修改）

\`\`\`
BASE_URL=${baseUrl}
PROJECT_ID=${ctx.projectId}
PROJECT_NAME=${ctx.projectName}
\`\`\`

- 管理 API：\`${baseUrl}/api/...\`
- 先执行：\`GET ${baseUrl}/api/projects/${ctx.projectId}/agent-tree\` 摸清项目结构
- 只操作 PROJECT_ID=${ctx.projectId} 下的资源

---

${AGENTS_EDIT_MANUAL}
`;
}
