# AGENT对接指南功能设计文档

## [S1] 问题描述

用户希望在项目页面添加一个"AGENT对接指南"按钮，点击后弹出模态框显示详细的指南内容，指导AI大模型如何生成符合项目要求的JSON格式进行项目导入，并提供项目暴露的操作接口文档。

## [S2] 解决方案概述

在项目页面顶部操作栏添加"AGENT对接指南"按钮，点击后弹出分栏展示的模态框，包含三个主要部分：JSON格式说明、API接口文档、完整对接流程。

## [S3] 界面设计

### 3.1 按钮位置

- 位置：项目页面顶部操作栏
- 与现有"导入项目"和"新建项目"按钮并列
- 使用"BookOpen"图标（来自lucide-react）

### 3.2 模态框布局

- 宽度：xl（最大宽度）
- 左侧：固定宽度导航栏（约200px），包含三个部分链接
- 右侧：可滚动内容区
- 顶部：标题"AGENT对接指南"
- 底部：关闭按钮

### 3.3 导航栏设计

- 三个导航项，点击后平滑滚动到对应内容部分
- 当前选中项高亮显示
- 使用现有的UI组件样式

## [S4] 内容结构

### 4.1 JSON格式说明

- **ProjectExportBundle 格式要求**
  - version字段固定为1
  - exportedAt为ISO时间字符串
  - project对象包含name和description
  - featureGroups数组包含功能组和接口

- **字段说明和类型**
  - 详细说明每个字段的数据类型和约束
  - 必填字段和可选字段说明

- **完整示例JSON**
  - 提供一个完整的项目导入JSON示例
  - 包含多个功能组和接口的示例

### 4.2 API接口文档

- **项目导入导出API**
  - GET /api/projects/:id/export - 导出项目配置
  - POST /api/projects/import - 导入项目配置

- **功能组管理API**
  - GET /api/projects/:projectId/feature-groups - 获取功能组列表
  - POST /api/projects/:projectId/feature-groups - 创建功能组
  - PUT /api/feature-groups/:id - 更新功能组
  - DELETE /api/feature-groups/:id - 删除功能组

- **Mock接口管理API**
  - GET /api/feature-groups/:featureGroupId/mock-apis - 获取接口列表
  - POST /api/feature-groups/:featureGroupId/mock-apis - 创建接口
  - PUT /api/mock-apis/:id - 更新接口
  - DELETE /api/mock-apis/:id - 删除接口
  - PATCH /api/mock-apis/:id/toggle - 启用/禁用接口

- **数据操作API**
  - GET /api/mock-apis/:apiId/data - 获取Mock数据
  - POST /api/mock-apis/:apiId/data - 新增Mock数据
  - PUT /api/mock-data/:id - 更新Mock数据
  - DELETE /api/mock-data/:id - 删除Mock数据

- **回调配置API**
  - GET /api/mock-apis/:apiId/callback - 获取回调配置
  - PUT /api/mock-apis/:apiId/callback - 设置回调配置
  - DELETE /api/mock-apis/:apiId/callback - 删除回调配置

### 4.3 完整对接流程

- **步骤1：获取项目结构**
  - 使用GET /api/projects获取项目列表
  - 使用GET /api/projects/:id获取项目详情

- **步骤2：生成JSON文件**
  - 根据ProjectExportBundle格式生成JSON
  - 填写必要的字段信息

- **步骤3：导入项目**
  - 使用POST /api/projects/import导入JSON
  - 选择合适的导入模式（create/skip/overwrite）

- **步骤4：验证和测试**
  - 使用GET /api/projects/:id验证导入结果
  - 使用POST /api/mock-apis/:id/test测试接口

## [S5] 实现计划

### 5.1 创建AgentGuideModal组件

- 创建新的React组件AgentGuideModal
- 实现分栏布局：左侧导航栏 + 右侧内容区
- 实现导航功能：点击导航项滚动到对应内容
- 实现内容展示：三个主要部分的内容

### 5.2 修改ProjectsPage组件

- 在ProjectsPage顶部操作栏添加"AGENT对接指南"按钮
- 导入AgentGuideModal组件
- 添加状态管理控制模态框显示/隐藏

### 5.3 测试功能

- 测试按钮点击是否正确打开模态框
- 测试导航栏点击是否正确滚动到对应内容
- 测试模态框关闭功能
- 测试内容显示是否正确

## [S6] 验收标准

1. 按钮功能：点击"AGENT对接指南"按钮正确打开模态框
2. 导航功能：左侧导航栏点击正确滚动到对应内容部分
3. 内容显示：三个部分内容完整且格式正确
4. 响应式设计：模态框在不同屏幕尺寸下正常显示
5. 用户体验：导航流畅，内容易于阅读

## [S7] 风险评估

1. 内容过时风险：静态内容可能随项目更新而过时
   - 缓解措施：定期检查并更新指南内容

2. 性能风险：大量内容可能影响模态框加载性能
   - 缓解措施：使用懒加载和虚拟滚动优化

3. 兼容性风险：新组件可能与现有UI组件库不兼容
   - 缓解措施：使用现有的Modal组件和样式系统
