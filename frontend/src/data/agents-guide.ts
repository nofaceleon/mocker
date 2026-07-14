/**
 * MockHub 的「AGENTS 对接指南」内容。
 * 复制 AGENTS_GUIDE_PROMPT 给任意 AI，AI 即可按规格输出可导入的 ProjectExportBundle；
 * 用户在首页「导入项目」上传 AI 给的 JSON 即可一键生成项目。
 *
 * 内容来源（单一来源，避免双写）：
 *  - frontend/src/assets/agents-guide.md           → /agents-guide.md，浏览器直开
 *  - frontend/src/assets/agents-guide.example.json → /agents-guide.example.json，浏览器直开
 *
 * 文件落在前端 src/ 下：弹窗展示用 Vite ?raw 在构建期内联；
 * 浏览器直开 URL 由 Vite dev proxy / 产线后端代理提供，后端会显式带 charset=utf-8，
 * 解决部分浏览器对 .md / .json 按本地默认编码（GBK / Latin-1）解析导致中文乱码的问题。
 *
 * 内容维护原则：
 *  - 跟 backend/src/db/schema.ts / mock-engine/* 同步；
 *  - 字段名/枚举值严格按源码，不要写未实现的特性。
 */

import AGENTS_GUIDE_PROMPT from '../assets/agents-guide.md?raw';
import AGENTS_GUIDE_EXAMPLE_BUNDLE from '../assets/agents-guide.example.json?raw';

export { AGENTS_GUIDE_PROMPT, AGENTS_GUIDE_EXAMPLE_BUNDLE };

/** 对外暴露的静态资源 URL（绝对地址，给「复制 URL」按钮用） */
export const AGENTS_GUIDE_URLS = {
  prompt: '/agents-guide.md',
  example: '/agents-guide.example.json',
} as const;
