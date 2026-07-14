#!/usr/bin/env node
/**
 * postbuild: 把 frontend/src/assets 下所有文件原样复制到 backend/dist/assets，
 * 否则 prod 运行时 fs.readFileSync 会找不到（tsc 不会带非 .ts 文件走）。
 * dev 模式不依赖此脚本（后端直接从 frontend/src/assets 读取）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const srcDir = path.join(repoRoot, 'frontend', 'src', 'assets');
const distDir = path.join(backendRoot, 'dist', 'assets');

if (!fs.existsSync(srcDir)) {
  console.log('[copy-assets] no frontend/src/assets, skip');
  process.exit(0);
}

fs.mkdirSync(distDir, { recursive: true });
for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const from = path.join(srcDir, entry.name);
  const to = path.join(distDir, entry.name);
  fs.copyFileSync(from, to);
  console.log(`[copy-assets] ${entry.name}`);
}
