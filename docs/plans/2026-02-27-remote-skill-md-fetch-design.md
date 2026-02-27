# 远端 SKILL.md 获取功能设计

**日期:** 2026-02-27
**作者:** Claude
**状态:** 已批准

## 1. 概述

### 目标
实现从远程仓库获取 SKILL.md 文件的功能，用于在 Marketplace 中浏览技能和查看详情。

### 使用场景
- 市场浏览：显示技能列表时需要获取技能的 name、description 等元数据
- 详情查看：用户点击技能查看完整 SKILL.md 内容

### 核心需求
- 需要完整的 SKILL.md 文件内容（不仅是元数据）
- 需要缓存优化（避免重复下载）
- 将远端 SKILL.md 缓存到 globalStorage，webview 直接读取文件展示

## 2. 整体架构

### 组件划分

```
src/
├── utils/
│   ├── git.ts              # 新增：cloneRepo, cleanupTempDir
│   └── skills.ts           # 扩展：discoverSkillsInPath
├── managers/
│   ├── SkillCache.ts       # 扩展：缓存管理方法
│   └── APIClient.ts        # 扩展：fetchRemoteSkillMd
└── types/
    └── cache.ts            # 新增：缓存相关类型定义
```

### 职责分离
- **git.ts**: Git 仓库克隆和临时目录管理（复用参考项目逻辑）
- **skills.ts**: 在克隆的目录中查找 SKILL.md（复用参考项目的多位置查找）
- **SkillCache**: 缓存管理（读写缓存文件、清理过期缓存）
- **APIClient**: 对外暴露的主入口，协调整个流程

## 3. 数据流

### fetchRemoteSkillMd(repositoryUrl, skillId) 完整流程

```
1. 检查缓存
   ├─ 读取 globalStorage/skill-cache/index.json
   ├─ 检查 skillId 是否存在且未过期
   └─ 命中则返回 globalStorage/skill-cache/{skillId}.md

2. Clone 仓库（缓存未命中）
   ├─ 调用 cloneRepo(url) → 返回临时目录路径
   └─ 使用 --depth=1 浅克隆，加快速度

3. 查找 SKILL.md
   ├─ 调用 discoverSkillsInPath(tempDir)
   ├─ 检查根目录 SKILL.md
   ├─ 检查优先位置：skills/, .agents/skills/, .claude/skills/ 等
   └─ 支持多 skill 仓库，返回第一个找到的

4. 缓存并清理
   ├─ 读取 skill.md 内容
   ├─ 写入 globalStorage/skill-cache/{skillId}.md
   ├─ 更新 index.json（记录时间戳）
   ├─ 清理过期缓存（TTL 24小时，最多保留 100 个）
   └─ 调用 cleanupTempDir(tempDir)

5. 返回文件路径
   └─ 返回 globalStorage 中 skill.md 的绝对路径
```

### 缓存文件结构

```
globalStorage/
├── skill-cache/
│   ├── index.json              # 缓存索引
│   ├── my-skill.md            # skillId: "my-skill"
│   ├── another-skill.md       # skillId: "another-skill"
│   └── ...
```

### index.json 结构

```json
{
  "skills": {
    "my-skill": {
      "cachedAt": "2026-02-27T10:00:00Z",
      "repositoryUrl": "https://github.com/owner/repo"
    }
  }
}
```

## 4. 缓存策略

### 配置参数

```typescript
interface CacheConfig {
  ttl: number;           // 24 小时（86400000 ms）
  maxCount: number;      // 最多 100 个 skill
  cleanupInterval: number; // 每次写入时触发清理检查
}
```

### LRU 清理策略
- 达到 `maxCount` 时，删除最旧的缓存（基于 `cachedAt` 时间戳）
- 清理过期缓存（超过 TTL）在每次写入时触发
- 启动时可选执行一次全量清理

### 内存缓存（可选优化）

```typescript
// 在 APIClient 中维护运行时缓存
private memoryCache = new Map<string, Promise<string>>();

// 防止并发请求同一 skill
if (this.memoryCache.has(skillId)) {
  return this.memoryCache.get(skillId)!;
}
const promise = this.fetchWithClone(skillId, repositoryUrl);
this.memoryCache.set(skillId, promise);
```

## 5. 错误处理

### Clone 失败
- **网络错误**: 提示用户检查网络连接
- **私有仓库**: 提示需要配置认证
- **超时**: 默认 60 秒，给出友好提示

### 未找到 SKILL.md
- 检查根目录和常见位置
- 如果是多 skill 仓库，提示用户指定具体 skill
- 返回错误而非抛出异常，让上层决定如何处理

### 缓存管理
- **索引文件损坏**: 重建索引
- **达到数量上限**: 删除最旧的缓存（LRU）
- **写入失败**: 降级为只返回内容，不缓存

### 并发安全
- 同一个 skillId 正在下载：复用进行中的请求（Promise 缓存）
- 防止重复 clone 同一个仓库

## 6. API 接口

### APIClient.fetchRemoteSkillMd

```typescript
/**
 * 从远程仓库获取 skill.md 并缓存
 * @param repositoryUrl - Git 仓库 URL
 * @param skillId - 技能唯一标识
 * @returns 返回缓存文件的绝对路径
 */
async fetchRemoteSkillMd(
  repositoryUrl: string,
  skillId: string
): Promise<string>
```

### SkillCache 方法

```typescript
/**
 * 获取缓存的 skill.md 路径，如果存在且未过期
 */
getCachedSkillMd(skillId: string): string | null

/**
 * 缓存 skill.md 内容
 */
cacheSkillMd(skillId: string, content: string, repositoryUrl: string): Promise<string>

/**
 * 清理过期和过多的缓存
 */
cleanupCache(): Promise<void>
```

### Git 工具函数

```typescript
/**
 * 克隆仓库到临时目录（浅克隆）
 */
cloneRepo(url: string, ref?: string): Promise<string>

/**
 * 清理临时目录
 */
cleanupTempDir(dir: string): Promise<void>
```

### Skills 工具函数

```typescript
/**
 * 在指定目录中查找 SKILL.md 文件
 */
discoverSkillsInPath(basePath: string): Promise<SkillMdLocation[]>
```

## 7. 类型定义

```typescript
interface SkillMdLocation {
  path: string;        // SKILL.md 文件的绝对路径
  name: string;        // 从 frontmatter 解析的 name
  skillDir: string;    // SKILL.md 所在目录
}

interface CacheEntry {
  cachedAt: string;    // ISO 8601 时间戳
  repositoryUrl: string;
}

interface CacheIndex {
  skills: Record<string, CacheEntry>;
}

interface GitCloneError extends Error {
  url: string;
  isTimeout: boolean;
  isAuthError: boolean;
}
```

## 8. 实现优先级

### Phase 1: 基础功能
1. 实现 `cloneRepo` 和 `cleanupTempDir`
2. 实现 `discoverSkillsInPath`
3. 实现基础的 `fetchRemoteSkillMd`（不含缓存）

### Phase 2: 缓存系统
1. 实现 `SkillCache` 的缓存管理方法
2. 实现 LRU 清理策略
3. 集成到 `fetchRemoteSkillMd` 流程

### Phase 3: 错误处理和优化
1. 完善错误处理
2. 添加内存缓存防止并发请求
3. 添加日志和调试信息

## 9. 测试策略

### 单元测试
- `cloneRepo`: 测试成功/失败/超时场景
- `discoverSkillsInPath`: 测试各种目录结构
- `SkillCache`: 测试缓存读写、清理逻辑

### 集成测试
- 端到端测试完整的 fetch 流程
- 测试缓存命中和未命中场景
- 测试多 skill 仓库场景

### 手动测试
- 测试真实的 GitHub 仓库
- 测试网络错误场景
- 验证缓存在 globalStorage 中正确存储

## 10. 参考资料

- 参考项目克隆逻辑: `/Users/wangyida/GitRepo/skills/src/git.ts`
- 参考项目技能查找: `/Users/wangyida/GitRepo/skills/src/skills.ts`
