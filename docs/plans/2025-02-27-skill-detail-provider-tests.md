# SkillDetailProvider 测试实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 SkillDetailProvider 编写集成测试，验证本地和远端技能的展示逻辑

**Architecture:** 使用 VSCode 测试框架 + Mocha，通过真实的 SkillCache、APIClient 和 VSCode API 进行集成测试

**Tech Stack:** Mocha, @vscode/test-electron, TypeScript

---

## 前置准备

### Task 1: 创建测试文件基础结构

**Files:**
- Create: `src/test/suite/skill-detail-provider.test.ts`

**Step 1: 创建测试文件框架**

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { SkillDetailProvider } from '../../editors/SkillDetailProvider';
import { SkillCache } from '../../managers/SkillCache';
import { APIClient } from '../../managers/APIClient';

suite('SkillDetailProvider Tests Suite', () => {
  let context: vscode.ExtensionContext;
  let skillCache: SkillCache;
  let apiClient: APIClient;
  let tempDir: string;

  suiteSetup(async () => {
    // 获取测试用的 context
    const extension = vscode.extensions.getExtension('your-publisher-name.skills-vscode');
    await extension?.activate();
    context = (global as any).testExtensionContext;

    // 初始化 managers
    skillCache = new SkillCache(context);
    apiClient = new APIClient([]);

    // 创建临时目录用于本地测试
    tempDir = path.join(os.tmpdir(), `skill-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  suiteTeardown(async () => {
    // 清理临时文件
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await skillCache.clear();
  });

  // 测试用例将在这里添加
});
```

**Step 2: 编译测试文件**

```bash
npm run compile
```

**Step 3: 验证测试框架正常工作**

```bash
npm test
```

**Expected:** 测试运行，但没有测试用例执行

---

## 本地技能测试

### Task 2: 测试本地技能展示

**Files:**
- Modify: `src/test/suite/skill-detail-provider.test.ts`

**Step 1: 编写测试 - 本地技能文件打开**

在 suite 内部添加：

```typescript
test('should open local skill file', async () => {
  // 准备测试数据
  const skillName = 'test-local-skill';
  const skillContent = `# ${skillName}\n\nThis is a test skill.\n\n## Usage\n\nTest usage here.`;
  const skillMdPath = path.join(tempDir, 'SKILL.md');

  // 创建本地 SKILL.md 文件
  await fs.writeFile(skillMdPath, skillContent);

  // 构造本地 skill 对象
  const localSkill = {
    id: skillName,
    name: skillName,
    description: 'A local test skill',
    source: {
      type: 'local',
      skillMdPath: skillMdPath
    }
  };

  // 调用 SkillDetailProvider.show
  await SkillDetailProvider.show(localSkill, { skillCache, apiClient });

  // 验证：检查当前活动的文本编辑器
  const activeEditor = vscode.window.activeTextEditor;
  assert.ok(activeEditor, '应该打开一个文本编辑器');
  assert.strictEqual(
    activeEditor.document.uri.fsPath,
    skillMdPath,
    '应该打开正确的本地文件'
  );

  // 验证内容
  const documentContent = activeEditor.document.getText();
  assert.strictEqual(documentContent, skillContent, '内容应该匹配');
});
```

**Step 2: 编译并运行测试**

```bash
npm run compile && npm test -- --grep "should open local skill file"
```

**Expected:** PASS - 测试通过

**Step 3: 关闭打开的编辑器（为后续测试准备）**

在测试末尾添加清理：

```typescript
test('should open local skill file', async () => {
  // ... 测试代码 ...

  // 清理：关闭所有编辑器
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
});
```

**Step 4: 重新运行测试验证清理逻辑**

```bash
npm run compile && npm test -- --grep "should open local skill file"
```

**Expected:** PASS

---

## 远端技能测试

### Task 3: 测试远端技能展示 - 缓存未命中

**Files:**
- Modify: `src/test/suite/skill-detail-provider.test.ts`

**Step 1: 编写测试 - 首次访问远端技能**

```typescript
test('should fetch remote skill when cache misses', async function() {
  this.timeout(10000); // 网络请求可能需要更长时间

  // 使用真实的公开技能仓库
  const remoteSkill = {
    id: 'anthropic-ai-skills',
    name: 'Anthropic AI Skills',
    description: 'Official Anthropic skills repository',
    repository: 'https://github.com/anthropics/anthropic-ai-skills',
    skillMdUrl: 'https://raw.githubusercontent.com/anthropics/anthropic-ai-skills/HEAD/SKILL.md'
  };

  // 确保缓存为空
  await skillCache.invalidateCache(remoteSkill.skillMdUrl);

  // 调用 SkillDetailProvider.show
  await SkillDetailProvider.show(remoteSkill, { skillCache, apiClient });

  // 验证：文档被打开
  const activeEditor = vscode.window.activeTextEditor;
  assert.ok(activeEditor, '应该打开一个文本编辑器');

  // 验证：内容不为空
  const content = activeEditor.document.getText();
  assert.ok(content.length > 0, '应该有内容');
  assert.ok(content.includes('#'), '应该是 Markdown 格式');

  // 验证：内容被缓存
  const cachedContent = await skillCache.getCachedSkill(remoteSkill.skillMdUrl);
  assert.ok(cachedContent, '应该被缓存');
  assert.strictEqual(cachedContent, content, '缓存内容应该匹配');

  // 清理
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
});
```

**Step 2: 编译并运行测试**

```bash
npm run compile && npm test -- --grep "should fetch remote skill when cache misses"
```

**Expected:** PASS - 从网络拉取内容并缓存

**Step 3: 清理缓存以避免影响后续测试**

在 suiteTeardown 中已有清理逻辑

---

### Task 4: 测试远端技能展示 - 缓存命中

**Files:**
- Modify: `src/test/suite/skill-detail-provider.test.ts`

**Step 1: 编写测试 - 从缓存读取**

```typescript
test('should use cached remote skill', async function() {
  // 准备：预先填充缓存
  const testUrl = 'https://example.com/test-cached-skill.md';
  const testContent = `# Cached Skill\n\nThis content is from cache.`;

  await skillCache.setCachedSkill(testUrl, testContent);

  // 验证缓存已设置
  const beforeCache = await skillCache.getCachedSkill(testUrl);
  assert.strictEqual(beforeCache, testContent, '缓存应该被正确设置');

  // 构造 skill 对象
  const cachedSkill = {
    id: 'cached-skill',
    name: 'Cached Skill',
    description: 'A skill from cache',
    skillMdUrl: testUrl
  };

  // 调用 SkillDetailProvider.show
  await SkillDetailProvider.show(cachedSkill, { skillCache, apiClient });

  // 验证：文档被打开
  const activeEditor = vscode.window.activeTextEditor;
  assert.ok(activeEditor, '应该打开一个文本编辑器');

  // 验证：内容来自缓存
  const content = activeEditor.document.getText();
  assert.strictEqual(content, testContent, '应该使用缓存内容');

  // 清理
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await skillCache.invalidateCache(testUrl);
});
```

**Step 2: 编译并运行测试**

```bash
npm run compile && npm test -- --grep "should use cached remote skill"
```

**Expected:** PASS - 直接从缓存读取，不触发网络请求

---

### Task 5: 测试远端技能展示 - 缓存过期

**Files:**
- Modify: `src/test/suite/skill-detail-provider.test.ts`

**Step 1: 创建辅助方法 - 设置过期缓存**

在 suite 内部添加辅助方法：

```typescript
suite('SkillDetailProvider Tests Suite', () => {
  // ... 现有代码 ...

  // 辅助方法：创建一个过期的缓存条目
  async function setExpiredCache(url: string, content: string): Promise<void> {
    const cacheKey = `skill_cache_1_${Buffer.from(url).toString('base64').replace(/[/+=]/g, '')}`;
    const expiredTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8天前

    await context.globalState.update(cacheKey, {
      url,
      content,
      timestamp: expiredTimestamp,
      size: content.length
    });
  }
});
```

**Step 2: 编写测试 - 过期缓存触发重新拉取**

```typescript
test('should refetch when cache is expired', async function() {
  this.timeout(10000);

  // 使用真实的公开技能仓库
  const testUrl = 'https://raw.githubusercontent.com/anthropics/anthropic-ai-skills/HEAD/SKILL.md';
  const expiredContent = '# Expired Content\n\nThis is old.';

  // 设置过期缓存
  await setExpiredCache(testUrl, expiredContent);

  // 验证过期缓存存在但已过期
  const cachedBefore = await skillCache.getCachedSkill(testUrl);
  assert.strictEqual(cachedBefore, null, '过期缓存应该返回 null');

  // 构造 skill 对象
  const remoteSkill = {
    id: 'anthropic-ai-skills-expired',
    name: 'Anthropic AI Skills',
    description: 'Test expired cache',
    skillMdUrl: testUrl
  };

  // 调用 SkillDetailProvider.show
  await SkillDetailProvider.show(remoteSkill, { skillCache, apiClient });

  // 验证：新内容被拉取
  const activeEditor = vscode.window.activeTextEditor;
  assert.ok(activeEditor, '应该打开一个文本编辑器');

  const content = activeEditor.document.getText();
  assert.notStrictEqual(content, expiredContent, '不应该使用过期内容');

  // 清理
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await skillCache.invalidateCache(testUrl);
});
```

**Step 3: 编译并运行测试**

```bash
npm run compile && npm test -- --grep "should refetch when cache is expired"
```

**Expected:** PASS - 过期缓存被忽略，重新拉取

---

## 完整测试运行

### Task 6: 运行所有测试

**Step 1: 运行完整的 SkillDetailProvider 测试套件**

```bash
npm run compile && npm test -- --grep "SkillDetailProvider Tests"
```

**Expected:** 所有 4 个测试通过

**Step 2: 运行所有测试确保没有破坏现有功能**

```bash
npm test
```

**Expected:** 所有测试通过（包括现有的 managers.test.ts, api-client.test.ts 等）

---

## 最终提交

### Task 7: 提交测试代码

**Step 1: 添加文件到 Git**

```bash
git add src/test/suite/skill-detail-provider.test.ts
git add docs/plans/2025-02-27-skill-detail-provider-tests.md
git add docs/plans/2025-02-27-skill-detail-provider-tests-design.md
```

**Step 2: 创建提交**

```bash
git commit -m "$(cat <<'EOF'
test: add SkillDetailProvider integration tests

Add comprehensive integration tests for SkillDetailProvider.show():
- Local skill file opening
- Remote skill fetching (cache miss)
- Remote skill from cache (cache hit)
- Cache expiry handling

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

**Step 3: 验证提交**

```bash
git log -1 --stat
```

**Expected:** 提交包含测试文件和文档

---

## 测试覆盖总结

测试完成后，SkillDetailProvider 的以下功能将得到验证：

| 场景 | 测试用例 | 验证内容 |
|------|---------|---------|
| 本地技能 | should open local skill file | 文件路径、内容正确性 |
| 远端技能（首次） | should fetch remote skill when cache misses | 网络拉取、缓存存储 |
| 远端技能（缓存） | should use cached remote skill | 缓存命中、无网络请求 |
| 远端技能（过期） | should refetch when cache is expired | 过期处理、重新拉取 |
