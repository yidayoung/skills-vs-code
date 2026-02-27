# 远端 SKILL.md 获取功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现从远程仓库获取 SKILL.md 文件并缓存到本地，用于 Marketplace 浏览和详情查看

**Architecture:**
- Git 工具函数负责克隆仓库到临时目录（浅克隆）
- Skills 工具函数负责在克隆目录中查找 SKILL.md
- SkillCache 负责管理缓存（读写、清理过期缓存）
- APIClient 暴露主入口，协调整个流程

**Tech Stack:** TypeScript, Node.js fs/promises, simple-git, VSCode API

---

## 前置准备

### Task 0: 安装依赖

**Files:**
- Modify: `package.json`

**Step 1: 添加 simple-git 依赖**

```bash
npm install simple-git
```

**Step 2: 验证安装**

Run: `grep simple-git package.json`
Expected: 看到 `"simple-git": "^版本号"`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add simple-git for repository cloning"
```

---

## Phase 1: Git 工具函数

### Task 1: 实现 cloneRepo 函数

**Files:**
- Create: `src/utils/git.ts`

**Step 1: 写测试**

创建 `src/test/git.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { cloneRepo, cleanupTempDir } from '../utils/git';

describe('git utils', () => {
  it('should clone a public repository', async () => {
    const tempDir = await cloneRepo('https://github.com/skills/library');
    expect(tempDir).toBeDefined();
    expect(tempDir).toContain('skills-');

    // Verify it's a valid directory
    const fs = await import('fs/promises');
    const stats = await fs.stat(tempDir);
    expect(stats.isDirectory()).toBe(true);

    await cleanupTempDir(tempDir);
  });

  it('should fail on invalid repository', async () => {
    await expect(cloneRepo('https://github.com/invalid/repo-that-does-not-exist-12345'))
      .rejects.toThrow();
  });
});
```

**Step 2: 运行测试验证失败**

Run: `npm test -- src/test/git.test.ts`
Expected: FAIL - "Cannot find module '../utils/git'"

**Step 3: 实现最小代码**

创建 `src/utils/git.ts`:

```typescript
import simpleGit from 'simple-git';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

const CLONE_TIMEOUT_MS = 60000; // 60 seconds

export class GitCloneError extends Error {
  readonly url: string;
  readonly isTimeout: boolean;
  readonly isAuthError: boolean;

  constructor(message: string, url: string, isTimeout = false, isAuthError = false) {
    super(message);
    this.name = 'GitCloneError';
    this.url = url;
    this.isTimeout = isTimeout;
    this.isAuthError = isAuthError;
  }
}

export async function cloneRepo(url: string, ref?: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'skills-'));
  const git = simpleGit({
    timeout: { block: CLONE_TIMEOUT_MS },
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  const cloneOptions = ref ? ['--depth', '1', '--branch', ref] : ['--depth', '1'];

  try {
    await git.clone(url, tempDir, cloneOptions);
    return tempDir;
  } catch (error) {
    // Clean up temp dir on failure
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes('block timeout') || errorMessage.includes('timed out');
    const isAuthError =
      errorMessage.includes('Authentication failed') ||
      errorMessage.includes('could not read Username') ||
      errorMessage.includes('Permission denied') ||
      errorMessage.includes('Repository not found');

    if (isTimeout) {
      throw new GitCloneError(
        `Clone timed out after 60s`,
        url,
        true,
        false
      );
    }

    if (isAuthError) {
      throw new GitCloneError(
        `Authentication failed for ${url}`,
        url,
        false,
        true
      );
    }

    throw new GitCloneError(`Failed to clone ${url}: ${errorMessage}`, url, false, false);
  }
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
```

**Step 4: 运行测试验证通过**

Run: `npm test -- src/test/git.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/git.ts src/test/git.test.ts
git commit -m "feat: implement cloneRepo and cleanupTempDir utilities"
```

---

## Phase 2: Skills 查找工具

### Task 2: 实现 discoverSkillsInPath 函数

**Files:**
- Create: `src/utils/skills.ts` (扩展)

**Step 1: 写测试**

创建 `src/test/skills.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { discoverSkillsInPath } from '../utils/skills';
import { cloneRepo, cleanupTempDir } from '../utils/git';

describe('skills utils', () => {
  it('should find SKILL.md in repository root', async () => {
    const tempDir = await cloneRepo('https://github.com/skills/library');
    const results = await discoverSkillsInPath(tempDir);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toContain('SKILL.md');
    expect(results[0].name).toBeDefined();

    await cleanupTempDir(tempDir);
  });

  it('should return empty array for directory without SKILL.md', async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const emptyDir = path.join(os.tmpdir(), `empty-test-${Date.now()}`);
    await fs.mkdir(emptyDir, { recursive: true });

    const results = await discoverSkillsInPath(emptyDir);
    expect(results).toEqual([]);

    await fs.rm(emptyDir, { recursive: true });
  });
});
```

**Step 2: 运行测试验证失败**

Run: `npm test -- src/test/skills.test.ts`
Expected: FAIL - "Cannot find module '../utils/skills'" or function not found

**Step 3: 实现代码**

在 `src/utils/skills.ts` 中添加（如果文件不存在则创建）:

```typescript
import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';

export interface SkillMdLocation {
  path: string;        // SKILL.md 文件的绝对路径
  name: string;        // 从 frontmatter 解析的 name
  skillDir: string;    // SKILL.md 所在目录
}

const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '__pycache__'];

async function hasSkillMd(dir: string): Promise<boolean> {
  try {
    const skillPath = join(dir, 'SKILL.md');
    const stats = await stat(skillPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function parseSkillName(skillMdPath: string): Promise<string | null> {
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(skillMdPath, 'utf-8');

    // Simple frontmatter parser for name
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    if (nameMatch) {
      return nameMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    return basename(skillMdPath, '.md');
  } catch {
    return null;
  }
}

async function findSkillDirs(dir: string, depth = 0, maxDepth = 5): Promise<string[]> {
  if (depth > maxDepth) return [];

  try {
    const [hasSkill, entries] = await Promise.all([
      hasSkillMd(dir),
      readdir(dir, { withFileTypes: true }).catch(() => []),
    ]);

    const currentDir = hasSkill ? [dir] : [];

    // Search subdirectories
    const subDirResults = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !SKIP_DIRS.includes(entry.name))
        .map((entry) => findSkillDirs(join(dir, entry.name), depth + 1, maxDepth))
    );

    return [...currentDir, ...subDirResults.flat()];
  } catch {
    return [];
  }
}

export async function discoverSkillsInPath(
  basePath: string,
  subpath?: string
): Promise<SkillMdLocation[]> {
  const results: SkillMdLocation[] = [];
  const searchPath = subpath ? join(basePath, subpath) : basePath;

  // Priority search directories (same as reference project)
  const prioritySearchDirs = [
    searchPath,
    join(searchPath, 'skills'),
    join(searchPath, 'skills/.curated'),
    join(searchPath, 'skills/.experimental'),
    join(searchPath, 'skills/.system'),
    join(searchPath, '.agent/skills'),
    join(searchPath, '.agents/skills'),
    join(searchPath, '.claude/skills'),
    join(searchPath, '.cline/skills'),
    join(searchPath, '.codebuddy/skills'),
    join(searchPath, '.codex/skills'),
    join(searchPath, '.commandcode/skills'),
    join(searchPath, '.continue/skills'),
    join(searchPath, '.github/skills'),
    join(searchPath, '.goose/skills'),
    join(searchPath, '.iflow/skills'),
    join(searchPath, '.junie/skills'),
    join(searchPath, '.kilocode/skills'),
    join(searchPath, '.kiro/skills'),
    join(searchPath, '.mux/skills'),
    join(searchPath, '.neovate/skills'),
    join(searchPath, '.opencode/skills'),
    join(searchPath, '.openhands/skills'),
    join(searchPath, '.pi/skills'),
    join(searchPath, '.qoder/skills'),
    join(searchPath, '.roo/skills'),
    join(searchPath, '.trae/skills'),
    join(searchPath, '.windsurf/skills'),
    join(searchPath, '.zencoder/skills'),
  ];

  // Search priority directories first
  for (const dir of prioritySearchDirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = join(dir, entry.name);
          if (await hasSkillMd(skillDir)) {
            const skillMdPath = join(skillDir, 'SKILL.md');
            const name = await parseSkillName(skillMdPath);
            if (name) {
              results.push({ path: skillMdPath, name, skillDir });
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  // Fallback to recursive search if nothing found
  if (results.length === 0) {
    const allSkillDirs = await findSkillDirs(searchPath);

    for (const skillDir of allSkillDirs) {
      const skillMdPath = join(skillDir, 'SKILL.md');
      const name = await parseSkillName(skillMdPath);
      if (name) {
        results.push({ path: skillMdPath, name, skillDir });
      }
    }
  }

  return results;
}
```

**Step 4: 运行测试验证通过**

Run: `npm test -- src/test/skills.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/skills.ts src/test/skills.test.ts
git commit -m "feat: implement discoverSkillsInPath for finding SKILL.md files"
```

---

## Phase 3: 缓存类型定义

### Task 3: 添加缓存相关类型

**Files:**
- Create: `src/types/cache.ts`

**Step 1: 创建类型定义文件**

```typescript
export interface CacheEntry {
  cachedAt: string;    // ISO 8601 timestamp
  repositoryUrl: string;
}

export interface CacheIndex {
  skills: Record<string, CacheEntry>;
}

export interface CacheConfig {
  ttl: number;           // Time to live in milliseconds (default: 24 hours)
  maxCount: number;      // Maximum number of cached skills (default: 100)
}
```

**Step 2: 导出类型**

修改 `src/types/index.ts`:

```typescript
// Add at the end
export * from './cache';
```

**Step 3: Commit**

```bash
git add src/types/cache.ts src/types/index.ts
git commit -m "feat: add cache-related type definitions"
```

---

## Phase 4: SkillCache 缓存管理

### Task 4: 实现 SkillCache 缓存读写

**Files:**
- Modify: `src/managers/SkillCache.ts`

**Step 1: 写测试**

创建 `src/test/skill-cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import * as vscode from 'vscode';
import { SkillCache } from '../managers/SkillCache';

describe('SkillCache', () => {
  let cache: SkillCache;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      globalStorageUri: vscode.Uri.file('/tmp/test-cache'),
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    cache = new SkillCache(mockContext);
  });

  it('should get null for non-existent cache', () => {
    const result = cache.getCachedSkillMd('non-existent');
    expect(result).toBeNull();
  });

  it('should cache skill.md content', async () => {
    const content = '# Test Skill\n\nThis is a test.';
    const path = await cache.cacheSkillMd('test-skill', content, 'https://github.com/test/repo');

    expect(path).toBeDefined();
    expect(path).toContain('test-skill.md');
  });
});
```

**Step 2: 运行测试验证失败**

Run: `npm test -- src/test/skill-cache.test.ts`
Expected: FAIL - methods not found

**Step 3: 实现 SkillCache 方法**

在 `src/managers/SkillCache.ts` 中添加方法：

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CacheIndex, CacheEntry, CacheConfig } from '../types/cache';

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  maxCount: 100,
};

export class SkillCache {
  private cacheDir: string;
  private indexPath: string;
  private config: CacheConfig;

  constructor(
    private context: vscode.ExtensionContext,
    config?: Partial<CacheConfig>
  ) {
    this.cacheDir = path.join(this.context.globalStorageUri.fsPath, 'skill-cache');
    this.indexPath = path.join(this.cacheDir, 'index.json');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取缓存的 skill.md 路径，如果存在且未过期
   */
  async getCachedSkillMd(skillId: string): Promise<string | null> {
    try {
      const index = await this.readIndex();
      const entry = index.skills[skillId];

      if (!entry) {
        return null;
      }

      // Check if expired
      const cachedAt = new Date(entry.cachedAt).getTime();
      const now = Date.now();
      if (now - cachedAt > this.config.ttl) {
        // Expired, remove from index
        delete index.skills[skillId];
        await this.writeIndex(index);
        return null;
      }

      // Check if file still exists
      const skillPath = path.join(this.cacheDir, `${skillId}.md`);
      try {
        await fs.access(skillPath);
        return skillPath;
      } catch {
        // File doesn't exist, remove from index
        delete index.skills[skillId];
        await this.writeIndex(index);
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * 缓存 skill.md 内容
   */
  async cacheSkillMd(
    skillId: string,
    content: string,
    repositoryUrl: string
  ): Promise<string> {
    // Ensure cache directory exists
    await fs.mkdir(this.cacheDir, { recursive: true });

    // Write skill.md content
    const skillPath = path.join(this.cacheDir, `${skillId}.md`);
    await fs.writeFile(skillPath, content, 'utf-8');

    // Update index
    const index = await this.readIndex();
    index.skills[skillId] = {
      cachedAt: new Date().toISOString(),
      repositoryUrl,
    };
    await this.writeIndex(index);

    // Cleanup if needed
    await this.cleanupCache();

    return skillPath;
  }

  /**
   * 清理过期和过多的缓存
   */
  async cleanupCache(): Promise<void> {
    const index = await this.readIndex();
    const now = Date.now();
    const skillIds = Object.keys(index.skills);

    // Remove expired entries
    for (const skillId of skillIds) {
      const entry = index.skills[skillId];
      const cachedAt = new Date(entry.cachedAt).getTime();
      if (now - cachedAt > this.config.ttl) {
        delete index.skills[skillId];
        // Also remove the file
        const skillPath = path.join(this.cacheDir, `${skillId}.md`);
        await fs.rm(skillPath, { force: true }).catch(() => {});
      }
    }

    // If still too many, remove oldest (LRU)
    const remaining = Object.entries(index.skills);
    if (remaining.length > this.config.maxCount) {
      // Sort by cachedAt, oldest first
      remaining.sort((a, b) => {
        const aTime = new Date(a[1].cachedAt).getTime();
        const bTime = new Date(b[1].cachedAt).getTime();
        return aTime - bTime;
      });

      // Remove oldest entries
      const toRemove = remaining.slice(0, remaining.length - this.config.maxCount);
      for (const [skillId] of toRemove) {
        delete index.skills[skillId];
        const skillPath = path.join(this.cacheDir, `${skillId}.md`);
        await fs.rm(skillPath, { force: true }).catch(() => {});
      }
    }

    await this.writeIndex(index);
  }

  private async readIndex(): Promise<CacheIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Index doesn't exist or is invalid
      return { skills: {} };
    }
  }

  private async writeIndex(index: CacheIndex): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }
}
```

**Step 4: 运行测试验证通过**

Run: `npm test -- src/test/skill-cache.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/managers/SkillCache.ts src/test/skill-cache.test.ts
git commit -m "feat: implement SkillCache caching methods"
```

---

## Phase 5: APIClient 集成

### Task 5: 实现 fetchRemoteSkillMd 主入口

**Files:**
- Modify: `src/managers/APIClient.ts`

**Step 1: 写测试**

创建 `src/test/api-client-fetch.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import * as vscode from 'vscode';
import { APIClient } from '../managers/APIClient';
import { SkillCache } from '../managers/SkillCache';

describe('APIClient.fetchRemoteSkillMd', () => {
  let apiClient: APIClient;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    mockContext = {
      globalStorageUri: vscode.Uri.file('/tmp/test-api-cache'),
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    apiClient = new APIClient(mockContext);
  });

  it('should fetch and cache skill.md from repository', async () => {
    const result = await apiClient.fetchRemoteSkillMd(
      'https://github.com/skills/library',
      'test-skill'
    );

    expect(result).toBeDefined();
    expect(result).toContain('test-skill.md');
  });

  it('should return cached skill.md on second call', async () => {
    const first = await apiClient.fetchRemoteSkillMd(
      'https://github.com/skills/library',
      'test-skill-2'
    );
    const second = await apiClient.fetchRemoteSkillMd(
      'https://github.com/skills/library',
      'test-skill-2'
    );

    expect(first).toBe(second);
  });
});
```

**Step 2: 运行测试验证失败**

Run: `npm test -- src/test/api-client-fetch.test.ts`
Expected: FAIL - method not found

**Step 3: 实现主入口方法**

在 `src/managers/APIClient.ts` 中添加：

```typescript
import { SkillCache } from './SkillCache';
import { cloneRepo, cleanupTempDir } from '../utils/git';
import { discoverSkillsInPath } from '../utils/skills';
import * as fs from 'fs/promises';

export class APIClient {
  private skillCache: SkillCache;
  private memoryCache = new Map<string, Promise<string>>(); // Prevent concurrent requests

  constructor(
    private context: vscode.ExtensionContext,
    private marketplaceUrl: string = 'https://marketplace.skills.claude.com'
  ) {
    this.skillCache = new SkillCache(context);
    // ... existing constructor code ...
  }

  /**
   * 从远程仓库获取 skill.md 并缓存
   * @param repositoryUrl - Git 仓库 URL
   * @param skillId - 技能唯一标识
   * @returns 返回缓存文件的绝对路径
   */
  async fetchRemoteSkillMd(
    repositoryUrl: string,
    skillId: string
  ): Promise<string> {
    // Check cache first
    const cached = await this.skillCache.getCachedSkillMd(skillId);
    if (cached) {
      console.log(`[APIClient] Cache hit for ${skillId}: ${cached}`);
      return cached;
    }

    console.log(`[APIClient] Cache miss for ${skillId}, fetching from ${repositoryUrl}`);

    // Check if there's already an in-flight request
    const existing = this.memoryCache.get(skillId);
    if (existing) {
      console.log(`[APIClient] Using in-flight request for ${skillId}`);
      return existing;
    }

    // Create new request
    const promise = this.fetchWithClone(repositoryUrl, skillId);
    this.memoryCache.set(skillId, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up memory cache after completion
      this.memoryCache.delete(skillId);
    }
  }

  private async fetchWithClone(
    repositoryUrl: string,
    skillId: string
  ): Promise<string> {
    let tempDir: string | null = null;

    try {
      console.log(`[APIClient] Cloning ${repositoryUrl}`);
      tempDir = await cloneRepo(repositoryUrl);

      console.log(`[APIClient] Looking for SKILL.md in ${tempDir}`);
      const skills = await discoverSkillsInPath(tempDir);

      if (skills.length === 0) {
        throw new Error(`No SKILL.md found in repository ${repositoryUrl}`);
      }

      // Use the first skill found
      const skill = skills[0];
      console.log(`[APIClient] Found SKILL.md at ${skill.path}`);

      // Read the content
      const content = await fs.readFile(skill.path, 'utf-8');

      // Cache it
      const cachedPath = await this.skillCache.cacheSkillMd(
        skillId,
        content,
        repositoryUrl
      );

      console.log(`[APIClient] Cached to ${cachedPath}`);
      return cachedPath;

    } finally {
      if (tempDir) {
        console.log(`[APIClient] Cleaning up temp directory ${tempDir}`);
        await cleanupTempDir(tempDir);
      }
    }
  }

  // ... existing methods ...
}
```

**Step 4: 运行测试验证通过**

Run: `npm test -- src/test/api-client-fetch.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/managers/APIClient.ts src/test/api-client-fetch.test.ts
git commit -m "feat: implement fetchRemoteSkillMd for remote skill.md fetching"
```

---

## Phase 6: Webview 集成

### Task 6: 在 Webview 中展示远端 SKILL.md

**Files:**
- Modify: `webview/src/components/SkillCard.tsx`
- Modify: `webview/src/components/MarketplaceTab.tsx`

**Step 1: 添加查看详情按钮**

在 `SkillCard.tsx` 中添加按钮：

```typescript
// Add to the component
<button onClick={() => onViewDetails(skill)}>
  View Details
</button>
```

**Step 2: 在 MarketplaceTab 中添加处理函数**

```typescript
const handleViewDetails = async (skill: MarketplaceSkill) => {
  try {
    const filePath = await vscode.postMessage({
      type: 'fetchRemoteSkillMd',
      data: {
        repositoryUrl: skill.source.repositoryUrl,
        skillId: skill.id,
      },
    });

    // Open the file in a new editor tab
    vscode.postMessage({
      type: 'openSkillMd',
      data: { filePath },
    });
  } catch (error) {
    console.error('Failed to fetch skill.md:', error);
  }
};
```

**Step 3: 添加消息处理器**

在 `src/webview/messages/handlers.ts` 中添加：

```typescript
case 'fetchRemoteSkillMd':
  const { repositoryUrl, skillId } = message.data as {
    repositoryUrl: string;
    skillId: string;
  };

  const apiClient = new APIClient(context);
  const filePath = await apiClient.fetchRemoteSkillMd(repositoryUrl, skillId);

  webview.postMessage({
    type: 'skillMdFetched',
    data: { filePath },
  });
  break;

case 'openSkillMd':
  const { filePath } = message.data as { filePath: string };
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);
  break;
```

**Step 4: Commit**

```bash
git add webview/src/components/SkillCard.tsx \
        webview/src/components/MarketplaceTab.tsx \
        src/webview/messages/handlers.ts
git commit -m "feat: add view details button for remote skill.md"
```

---

## Phase 7: 错误处理和日志

### Task 7: 完善错误处理

**Files:**
- Modify: `src/managers/APIClient.ts`

**Step 1: 添加友好的错误提示**

修改 `fetchWithClone` 方法以处理各种错误：

```typescript
private async fetchWithClone(
  repositoryUrl: string,
  skillId: string
): Promise<string> {
  let tempDir: string | null = null;

  try {
    console.log(`[APIClient] Cloning ${repositoryUrl}`);
    tempDir = await cloneRepo(repositoryUrl);

    console.log(`[APIClient] Looking for SKILL.md in ${tempDir}`);
    const skills = await discoverSkillsInPath(tempDir);

    if (skills.length === 0) {
      // Provide helpful error message
      throw new Error(
        `No SKILL.md found in repository.\n\n` +
        `Checked locations:\n` +
        `- Repository root\n` +
        `- skills/\n` +
        `- .agents/skills/\n` +
        `- .claude/skills/\n\n` +
        `Please ensure the repository contains a valid SKILL.md file.`
      );
    }

    // Use the first skill found
    const skill = skills[0];
    console.log(`[APIClient] Found SKILL.md at ${skill.path}`);

    // Read the content
    const content = await fs.readFile(skill.path, 'utf-8');

    // Cache it
    const cachedPath = await this.skillCache.cacheSkillMd(
      skillId,
      content,
      repositoryUrl
    );

    console.log(`[APIClient] Cached to ${cachedPath}`);
    return cachedPath;

  } catch (error) {
    // Handle GitCloneError specifically
    if (error instanceof Error && error.name === 'GitCloneError') {
      const gitError = error as any;
      if (gitError.isTimeout) {
        throw new Error(
          `Repository clone timed out after 60 seconds.\n\n` +
          `This may happen with:\n` +
          `- Large repositories\n` +
          `- Slow network connections\n` +
          `- Private repositories requiring authentication\n\n` +
          `Repository: ${repositoryUrl}`
        );
      }
      if (gitError.isAuthError) {
        throw new Error(
          `Authentication failed for repository.\n\n` +
          `This repository may be private or require authentication.\n` +
          `Repository: ${repositoryUrl}\n\n` +
          `Please ensure you have access to this repository.`
        );
      }
    }

    // Re-throw with original message
    throw error;
  } finally {
    if (tempDir) {
      console.log(`[APIClient] Cleaning up temp directory ${tempDir}`);
      await cleanupTempDir(tempDir);
    }
  }
}
```

**Step 2: 在 Webview 中显示错误**

修改消息处理器：

```typescript
case 'fetchRemoteSkillMd':
  try {
    const { repositoryUrl, skillId } = message.data as {
      repositoryUrl: string;
      skillId: string;
    };

    const apiClient = new APIClient(context);
    const filePath = await apiClient.fetchRemoteSkillMd(repositoryUrl, skillId);

    webview.postMessage({
      type: 'skillMdFetched',
      data: { filePath },
    });
  } catch (error) {
    webview.postMessage({
      type: 'skillMdError',
      data: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
  break;
```

**Step 3: Commit**

```bash
git add src/managers/APIClient.ts src/webview/messages/handlers.ts
git commit -m "feat: improve error handling for remote skill.md fetching"
```

---

## Phase 8: 清理和优化

### Task 8: 添加缓存清理触发器

**Files:**
- Modify: `src/extension.ts`

**Step 1: 在扩展激活时清理过期缓存**

```typescript
export async function activate(context: vscode.ExtensionContext) {
  // ... existing code ...

  // Cleanup expired cache on activation
  const skillCache = new SkillCache(context);
  await skillCache.cleanupCache().catch((err) => {
    console.error('Failed to cleanup cache:', err);
  });

  // ... rest of activation code ...
}
```

**Step 2: Commit**

```bash
git add src/extension.ts
git commit -m "feat: cleanup expired cache on extension activation"
```

---

## 完成检查清单

- [ ] 所有测试通过
- [ ] 代码已格式化（Prettier）
- [ ] 没有 TypeScript 错误
- [ ] 手动测试：
  - [ ] 从真实 GitHub 仓库获取 skill.md
  - [ ] 验证缓存正常工作
  - [ ] 验证过期缓存被清理
  - [ ] 测试错误场景（无效仓库、网络错误等）
- [ ] 更新文档（如有必要）

---

## 测试命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- src/test/git.test.ts
npm test -- src/test/skills.test.ts
npm test -- src/test/skill-cache.test.ts
npm test -- src/test/api-client-fetch.test.ts

# 运行并监视
npm test -- --watch

# 查看覆盖率
npm test -- --coverage
```

---

## 参考资料

- 设计文档: `docs/plans/2026-02-27-remote-skill-md-fetch-design.md`
- 参考项目 Git 工具: `/Users/wangyida/GitRepo/skills/src/git.ts`
- 参考项目 Skills 查找: `/Users/wangyida/GitRepo/skills/src/skills.ts`
