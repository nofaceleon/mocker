# AGENT对接指南功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在项目页面添加"AGENT对接指南"按钮，点击后弹出分栏展示的模态框，包含JSON格式说明、API接口文档和完整对接流程。

**Architecture:** 创建新的React组件AgentGuideModal，实现分栏布局和导航功能，然后在ProjectsPage中集成该组件。

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react icons

## Global Constraints

- 使用现有的Modal组件作为模态框基础
- 使用现有的UI组件库（Button, Tabs等）
- 遵循项目的代码风格：单引号、尾逗号、100字符行宽
- 使用TypeScript strict模式

---

### Task 1: 创建AgentGuideModal组件基础结构

**Covers:** [S3, S4]

**Files:**

- Create: `frontend/src/components/AgentGuideModal.tsx`
- Modify: `frontend/src/pages/ProjectsPage.tsx:1-20`

**Interfaces:**

- Consumes: Modal组件 from `@/components/ui`
- Produces: AgentGuideModal组件，接受open和onClose props

- [ ] **Step 1: 创建AgentGuideModal组件文件**

```typescript
// frontend/src/components/AgentGuideModal.tsx
import { useState } from 'react';
import { Modal } from '@/components/ui';

type AgentGuideModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AgentGuideModal({ open, onClose }: AgentGuideModalProps) {
  const [activeSection, setActiveSection] = useState<'json' | 'api' | 'workflow'>('json');

  return (
    <Modal open={open} onClose={onClose} title="AGENT对接指南" width="xl">
      <div className="flex gap-6">
        {/* 左侧导航栏 */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveSection('json')}
              className={`w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                activeSection === 'json'
                  ? 'bg-canvas-subtle text-ink font-medium'
                  : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink'
              }`}
            >
              JSON格式说明
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('api')}
              className={`w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                activeSection === 'api'
                  ? 'bg-canvas-subtle text-ink font-medium'
                  : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink'
              }`}
            >
              API接口文档
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('workflow')}
              className={`w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                activeSection === 'workflow'
                  ? 'bg-canvas-subtle text-ink font-medium'
                  : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink'
              }`}
            >
              完整对接流程
            </button>
          </nav>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 overflow-auto">
          {/* 内容将在这里实现 */}
          <div className="text-[13px] text-ink-secondary">
            内容区域
          </div>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: 在ProjectsPage中导入AgentGuideModal**

```typescript
// frontend/src/pages/ProjectsPage.tsx 第1-20行
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FolderTree,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Upload,
  BookOpen, // 添加这个图标
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Empty,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Tabs,
  Textarea,
  confirm,
} from '@/components/ui';
import { AgentGuideModal } from '@/components/AgentGuideModal'; // 添加这个导入
```

- [ ] **Step 3: 添加模态框状态管理**

```typescript
// frontend/src/pages/ProjectsPage.tsx 第46-57行
export function ProjectsPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const { data: callbackStats } = useCallbackStats();
  const deleteMut = useDeleteProject();
  const [tab, setTab] = useState<'all' | 'recent' | 'pinned'>('all');
  const [sort, setSort] = useState<'updated' | 'created' | 'name'>('updated');
  const [search] = useState('');
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false); // 添加这个状态
```

- [ ] **Step 4: 添加AGENT对接指南按钮**

```typescript
// frontend/src/pages/ProjectsPage.tsx 第112-129行
return (
  <div className="page-container">
    <PageHeader
      title="我的项目"
      description="管理所有 Mock 项目，按业务系统隔离组织"
      actions={
        <>
          <Button variant="secondary" onClick={() => setGuideOpen(true)}>
            <BookOpen className="h-3.5 w-3.5" />
            AGENT对接指南
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            导入项目
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            新建项目
          </Button>
        </>
      }
    />
```

- [ ] **Step 5: 渲染AgentGuideModal组件**

```typescript
// frontend/src/pages/ProjectsPage.tsx 第230-235行
{creating && <ProjectEditModal mode="create" onClose={() => setCreating(false)} />}
{editing && (
  <ProjectEditModal mode="edit" project={editing} onClose={() => setEditing(null)} />
)}
{importOpen && <ProjectImportModal onClose={() => setImportOpen(false)} />}
{guideOpen && <AgentGuideModal onClose={() => setGuideOpen(false)} />}
```

- [ ] **Step 6: 测试基础功能**

运行开发服务器并测试：

1. 访问项目页面
2. 点击"AGENT对接指南"按钮
3. 验证模态框正确打开
4. 验证导航栏显示三个选项
5. 点击关闭按钮验证模态框关闭

- [ ] **Step 7: 提交代码**

```bash
git add frontend/src/components/AgentGuideModal.tsx frontend/src/pages/ProjectsPage.tsx
git commit -m "feat: add AGENT guide modal basic structure"
```

### Task 2: 实现JSON格式说明内容

**Covers:** [S4.1]

**Files:**

- Modify: `frontend/src/components/AgentGuideModal.tsx:50-80`

**Interfaces:**

- Consumes: AgentGuideModal组件的基础结构
- Produces: JSON格式说明的完整内容

- [ ] **Step 1: 添加JSON格式说明内容**

```typescript
// frontend/src/components/AgentGuideModal.tsx 右侧内容区
{activeSection === 'json' && (
  <div className="space-y-6">
    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">ProjectExportBundle 格式要求</h4>
      <div className="rounded-md border border-line bg-canvas-subtle/50 p-4 text-[12.5px] text-ink-secondary">
        <p className="mb-2"><b className="text-ink">version</b>: 必须为 <code className="rounded bg-canvas-subtle px-1">1</code>（固定值）</p>
        <p className="mb-2"><b className="text-ink">exportedAt</b>: ISO时间字符串，如 <code className="rounded bg-canvas-subtle px-1">"2026-07-12T08:00:00.000Z"</code></p>
        <p className="mb-2"><b className="text-ink">project</b>: 包含 <code className="rounded bg-canvas-subtle px-1">name</code>（必填）和 <code className="rounded bg-canvas-subtle px-1">description</code>（可选）</p>
        <p><b className="text-ink">featureGroups</b>: 功能组数组，每个功能组包含接口数组</p>
      </div>
    </div>

    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">字段说明和类型</h4>
      <div className="overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className="px-3 py-2 text-left font-medium text-ink">字段</th>
              <th className="px-3 py-2 text-left font-medium text-ink">类型</th>
              <th className="px-3 py-2 text-left font-medium text-ink">必填</th>
              <th className="px-3 py-2 text-left font-medium text-ink">说明</th>
            </tr>
          </thead>
          <tbody className="text-ink-secondary">
            <tr className="border-b border-line-subtle">
              <td className="px-3 py-2"><code className="rounded bg-canvas-subtle px-1">version</code></td>
              <td className="px-3 py-2">number</td>
              <td className="px-3 py-2">是</td>
              <td className="px-3 py-2">固定为1</td>
            </tr>
            <tr className="border-b border-line-subtle">
              <td className="px-3 py-2"><code className="rounded bg-canvas-subtle px-1">exportedAt</code></td>
              <td className="px-3 py-2">string</td>
              <td className="px-3 py-2">否</td>
              <td className="px-3 py-2">ISO时间字符串</td>
            </tr>
            <tr className="border-b border-line-subtle">
              <td className="px-3 py-2"><code className="rounded bg-canvas-subtle px-1">project.name</code></td>
              <td className="px-3 py-2">string</td>
              <td className="px-3 py-2">是</td>
              <td className="px-3 py-2">项目名称，1-100字符</td>
            </tr>
            <tr className="border-b border-line-subtle">
              <td className="px-3 py-2"><code className="rounded bg-canvas-subtle px-1">project.description</code></td>
              <td className="px-3 py-2">string</td>
              <td className="px-3 py-2">否</td>
              <td className="px-3 py-2">项目描述，最长2000字符</td>
            </tr>
            <tr className="border-b border-line-subtle">
              <td className="px-3 py-2"><code className="rounded bg-canvas-subtle px-1">featureGroups</code></td>
              <td className="px-3 py-2">array</td>
              <td className="px-3 py-2">否</td>
              <td className="px-3 py-2">功能组数组</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">完整示例JSON</h4>
      <pre className="overflow-auto rounded-md border border-line bg-canvas-subtle/50 p-4 text-[11px] leading-[1.6] text-ink-secondary">
{`{
  "version": 1,
  "exportedAt": "2026-07-12T08:00:00.000Z",
  "project": {
    "name": "人脸识别Demo",
    "description": "人脸识别演示项目"
  },
  "featureGroups": [
    {
      "name": "认证模块",
      "description": "用户认证相关接口",
      "sortOrder": 0,
      "apis": [
        {
          "name": "用户登录",
          "description": "登录接口",
          "protocol": "HTTP",
          "method": "POST",
          "path": "/api/auth/login",
          "isEnabled": true,
          "responseStatus": 200,
          "responseContentType": "application/json",
          "responseBody": {
            "code": 0,
            "token": "{{req.body.username}}-token"
          }
        }
      ]
    }
  ]
}`}
      </pre>
    </div>
  </div>
)}
```

- [ ] **Step 2: 测试JSON格式说明内容**

1. 打开AGENT对接指南模态框
2. 点击"JSON格式说明"导航项
3. 验证内容正确显示：
   - 格式要求说明
   - 字段说明表格
   - 完整示例JSON
4. 验证内容可滚动查看

- [ ] **Step 3: 提交代码**

```bash
git add frontend/src/components/AgentGuideModal.tsx
git commit -m "feat: add JSON format guide content"
```

### Task 3: 实现API接口文档内容

**Covers:** [S4.2]

**Files:**

- Modify: `frontend/src/components/AgentGuideModal.tsx:80-120`

**Interfaces:**

- Consumes: AgentGuideModal组件的基础结构
- Produces: API接口文档的完整内容

- [ ] **Step 1: 添加API接口文档内容**

```typescript
// frontend/src/components/AgentGuideModal.tsx 右侧内容区
{activeSection === 'api' && (
  <div className="space-y-6">
    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">项目导入导出API</h4>
      <div className="space-y-3">
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">GET</span>
            <code className="text-[12.5px] text-ink">/api/projects/:id/export</code>
          </div>
          <p className="text-[12px] text-ink-secondary">导出项目配置JSON</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">POST</span>
            <code className="text-[12.5px] text-ink">/api/projects/import</code>
          </div>
          <p className="text-[12px] text-ink-secondary">导入项目配置JSON</p>
        </div>
      </div>
    </div>

    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">功能组管理API</h4>
      <div className="space-y-3">
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">GET</span>
            <code className="text-[12.5px] text-ink">/api/projects/:projectId/feature-groups</code>
          </div>
          <p className="text-[12px] text-ink-secondary">获取功能组列表</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">POST</span>
            <code className="text-[12.5px] text-ink">/api/projects/:projectId/feature-groups</code>
          </div>
          <p className="text-[12px] text-ink-secondary">创建功能组</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning">PUT</span>
            <code className="text-[12.5px] text-ink">/api/feature-groups/:id</code>
          </div>
          <p className="text-[12px] text-ink-secondary">更新功能组</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger">DELETE</span>
            <code className="text-[12.5px] text-ink">/api/feature-groups/:id</code>
          </div>
          <p className="text-[12px] text-ink-secondary">删除功能组</p>
        </div>
      </div>
    </div>

    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">Mock接口管理API</h4>
      <div className="space-y-3">
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">GET</span>
            <code className="text-[12.5px] text-ink">/api/feature-groups/:featureGroupId/mock-apis</code>
          </div>
          <p className="text-[12px] text-ink-secondary">获取接口列表</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">POST</span>
            <code className="text-[12.5px] text-ink">/api/feature-groups/:featureGroupId/mock-apis</code>
          </div>
          <p className="text-[12px] text-ink-secondary">创建接口</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning">PUT</span>
            <code className="text-[12.5px] text-ink">/api/mock-apis/:id</code>
          </div>
          <p className="text-[12px] text-ink-secondary">更新接口</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger">DELETE</span>
            <code className="text-[12.5px] text-ink">/api/mock-apis/:id</code>
          </div>
          <p className="text-[12px] text-ink-secondary">删除接口</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-info-soft px-1.5 py-0.5 text-[11px] font-medium text-info">PATCH</span>
            <code className="text-[12.5px] text-ink">/api/mock-apis/:id/toggle</code>
          </div>
          <p className="text-[12px] text-ink-secondary">启用/禁用接口</p>
        </div>
      </div>
    </div>

    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">数据操作API</h4>
      <div className="space-y-3">
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">GET</span>
            <code className="text-[12.5px] text-ink">/api/mock-apis/:apiId/data</code>
          </div>
          <p className="text-[12px] text-ink-secondary">获取Mock数据</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">POST</span>
            <code className="text-[12.5px] text-ink">/api/mock-apis/:apiId/data</code>
          </div>
          <p className="text-[12px] text-ink-secondary">新增Mock数据</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning">PUT</span>
            <code className="text-[12.5px] text-ink">/api/mock-data/:id</code>
          </div>
          <p className="text-[12px] text-ink-secondary">更新Mock数据</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger">DELETE</span>
            <code className="text-[12.5px] text-ink">/api/mock-data/:id</code>
          </div>
          <p className="text-[12px] text-ink-secondary">删除Mock数据</p>
        </div>
      </div>
    </div>

    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">回调配置API</h4>
      <div className="space-y-3">
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">GET</span>
            <code className="text-[12.5px] text-ink">/api/mock-apis/:apiId/callback</code>
          </div>
          <p className="text-[12px] text-ink-secondary">获取回调配置</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning">PUT</span>
            <code className="text-[12.5px] text-ink">/api/mock-apis/:apiId/callback</code>
          </div>
          <p className="text-[12px] text-ink-secondary">设置回调配置</p>
        </div>
        <div className="rounded-md border border-line bg-canvas-subtle/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger">DELETE</span>
            <code className="text-[12.5px] text-ink">/api/mock-apis/:apiId/callback</code>
          </div>
          <p className="text-[12px] text-ink-secondary">删除回调配置</p>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: 测试API接口文档内容**

1. 打开AGENT对接指南模态框
2. 点击"API接口文档"导航项
3. 验证所有API分组正确显示：
   - 项目导入导出API
   - 功能组管理API
   - Mock接口管理API
   - 数据操作API
   - 回调配置API
4. 验证每个API的方法、路径和描述正确显示

- [ ] **Step 3: 提交代码**

```bash
git add frontend/src/components/AgentGuideModal.tsx
git commit -m "feat: add API documentation content"
```

### Task 4: 实现完整对接流程内容

**Covers:** [S4.3]

**Files:**

- Modify: `frontend/src/components/AgentGuideModal.tsx:120-160`

**Interfaces:**

- Consumes: AgentGuideModal组件的基础结构
- Produces: 完整对接流程的步骤说明

- [ ] **Step 1: 添加完整对接流程内容**

```typescript
// frontend/src/components/AgentGuideModal.tsx 右侧内容区
{activeSection === 'workflow' && (
  <div className="space-y-6">
    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">完整对接流程</h4>
      <p className="mb-4 text-[12.5px] text-ink-secondary">
        以下是AI大模型与MockHub对接的完整流程，包含从获取项目结构到生成JSON再到导入的详细步骤。
      </p>
    </div>

    <div className="space-y-4">
      <div className="rounded-md border border-line bg-canvas-subtle/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[12px] font-medium text-primary-inverse">1</span>
          <h5 className="text-[13px] font-medium text-ink">获取项目结构</h5>
        </div>
        <div className="ml-8 space-y-2 text-[12.5px] text-ink-secondary">
          <p>使用以下API获取现有项目结构：</p>
          <pre className="overflow-auto rounded bg-canvas-subtle p-2 text-[11px]">GET /api/projects</pre>
          <p>获取特定项目详情：</p>
          <pre className="overflow-auto rounded bg-canvas-subtle p-2 text-[11px]">GET /api/projects/:id</pre>
        </div>
      </div>

      <div className="rounded-md border border-line bg-canvas-subtle/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[12px] font-medium text-primary-inverse">2</span>
          <h5 className="text-[13px] font-medium text-ink">生成JSON文件</h5>
        </div>
        <div className="ml-8 space-y-2 text-[12.5px] text-ink-secondary">
          <p>根据ProjectExportBundle格式生成JSON：</p>
          <ul className="list-inside list-disc space-y-1">
            <li>设置 <code className="rounded bg-canvas-subtle px-1">version</code> 为 1</li>
            <li>填写 <code className="rounded bg-canvas-subtle px-1">project</code> 信息</li>
            <li>创建 <code className="rounded bg-canvas-subtle px-1">featureGroups</code> 数组</li>
            <li>为每个功能组添加接口定义</li>
          </ul>
        </div>
      </div>

      <div className="rounded-md border border-line bg-canvas-subtle/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[12px] font-medium text-primary-inverse">3</span>
          <h5 className="text-[13px] font-medium text-ink">导入项目</h5>
        </div>
        <div className="ml-8 space-y-2 text-[12.5px] text-ink-secondary">
          <p>使用导入API创建项目：</p>
          <pre className="overflow-auto rounded bg-canvas-subtle p-2 text-[11px]">POST /api/projects/import</pre>
          <p>请求体示例：</p>
          <pre className="overflow-auto rounded bg-canvas-subtle p-2 text-[11px]">
{`{
  "bundle": {
    "version": 1,
    "project": { "name": "项目名" },
    "featureGroups": [...]
  },
  "mode": "create"
}`}
          </pre>
        </div>
      </div>

      <div className="rounded-md border border-line bg-canvas-subtle/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[12px] font-medium text-primary-inverse">4</span>
          <h5 className="text-[13px] font-medium text-ink">验证和测试</h5>
        </div>
        <div className="ml-8 space-y-2 text-[12.5px] text-ink-secondary">
          <p>验证导入结果：</p>
          <pre className="overflow-auto rounded bg-canvas-subtle p-2 text-[11px]">GET /api/projects/:id</pre>
          <p>测试接口功能：</p>
          <pre className="overflow-auto rounded bg-canvas-subtle p-2 text-[11px]">POST /api/mock-apis/:id/test</pre>
        </div>
      </div>
    </div>

    <div className="rounded-md border border-line bg-canvas-subtle/50 p-4">
      <h5 className="mb-2 text-[13px] font-medium text-ink">注意事项</h5>
      <ul className="list-inside list-disc space-y-1 text-[12.5px] text-ink-secondary">
        <li>项目名称必须唯一，否则导入会失败（除非使用overwrite模式）</li>
        <li>接口路径必须以 <code className="rounded bg-canvas-subtle px-1">/</code> 开头</li>
        <li>响应体支持模板变量：<code className="rounded bg-canvas-subtle px-1">{'{{req.body.x}}'}</code>、<code className="rounded bg-canvas-subtle px-1">{'{{req.query.x}}'}</code>、<code className="rounded bg-canvas-subtle px-1">{'{{req.path.x}}'}</code></li>
        <li>导入后会自动重新加载Mock引擎</li>
      </ul>
    </div>
  </div>
)}
```

- [ ] **Step 2: 测试完整对接流程内容**

1. 打开AGENT对接指南模态框
2. 点击"完整对接流程"导航项
3. 验证四个步骤正确显示：
   - 获取项目结构
   - 生成JSON文件
   - 导入项目
   - 验证和测试
4. 验证每个步骤的API调用和代码示例正确显示
5. 验证注意事项部分正确显示

- [ ] **Step 3: 提交代码**

```bash
git add frontend/src/components/AgentGuideModal.tsx
git commit -m "feat: add workflow guide content"
```

### Task 5: 优化和测试

**Covers:** [S6]

**Files:**

- Modify: `frontend/src/components/AgentGuideModal.tsx`
- Modify: `frontend/src/pages/ProjectsPage.tsx`

**Interfaces:**

- Consumes: 所有前面的任务
- Produces: 完整的AGENT对接指南功能

- [ ] **Step 1: 优化导航高亮逻辑**

```typescript
// frontend/src/components/AgentGuideModal.tsx 导航栏部分
<nav className="space-y-1">
  <button
    type="button"
    onClick={() => setActiveSection('json')}
    className={`w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
      activeSection === 'json'
        ? 'bg-canvas-subtle text-ink font-medium'
        : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink'
    }`}
  >
    JSON格式说明
  </button>
  <button
    type="button"
    onClick={() => setActiveSection('api')}
    className={`w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
      activeSection === 'api'
        ? 'bg-canvas-subtle text-ink font-medium'
        : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink'
    }`}
  >
    API接口文档
  </button>
  <button
    type="button"
    onClick={() => setActiveSection('workflow')}
    className={`w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
      activeSection === 'workflow'
        ? 'bg-canvas-subtle text-ink font-medium'
        : 'text-ink-secondary hover:bg-canvas-subtle hover:text-ink'
    }`}
  >
    完整对接流程
  </button>
</nav>
```

- [ ] **Step 2: 添加响应式设计**

```typescript
// frontend/src/components/AgentGuideModal.tsx 模态框内容区
<div className="flex flex-col gap-6 md:flex-row">
  {/* 左侧导航栏 */}
  <div className="w-full flex-shrink-0 md:w-48">
    <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-x-visible">
      {/* 导航按钮 */}
    </nav>
  </div>

  {/* 右侧内容区 */}
  <div className="flex-1 overflow-auto">
    {/* 内容 */}
  </div>
</div>
```

- [ ] **Step 3: 测试完整功能**

1. 测试按钮功能：点击"AGENT对接指南"按钮正确打开模态框
2. 测试导航功能：左侧导航栏点击正确切换内容
3. 测试内容显示：三个部分内容完整且格式正确
4. 测试响应式设计：在不同屏幕尺寸下正常显示
5. 测试用户体验：导航流畅，内容易于阅读

- [ ] **Step 4: 运行类型检查**

```bash
pnpm typecheck
```

- [ ] **Step 5: 运行代码检查**

```bash
pnpm lint
```

- [ ] **Step 6: 提交最终代码**

```bash
git add frontend/src/components/AgentGuideModal.tsx frontend/src/pages/ProjectsPage.tsx
git commit -m "feat: complete AGENT integration guide feature"
```
