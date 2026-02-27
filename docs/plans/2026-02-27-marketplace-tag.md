# 市场标签显示功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 为市场技能添加彩色标签显示，帮助用户快速识别技能来源，颜色基于市场名称自动生成且固定不变。

**架构:** 前端基于名称哈希从预设调色板生成颜色，后端在搜索结果中添加 `marketName` 字段。市场标签和 IDE 类型标签互斥显示（未安装显示市场，已安装显示 IDE）。

**技术栈:**
- 后端: TypeScript, VSCode Extension API
- 前端: React, TypeScript, CSS
- 测试: Jest (后端), React Testing Library (前端，可选)

---

## Task 1: 后端类型定义 - 添加 marketName 字段

**文件:**
- Modify: `src/types/api.ts:30-57`

**Step 1: 更新 SkillSearchResult 接口**

在 `SkillSearchResult` 接口中添加 `marketName` 可选字段：

```typescript
export interface SkillSearchResult {
  /** Unique identifier */
  id: string;
  /** Skill name */
  name: string;
  /** Skill description */
  description: string;
  /** Git repository URL (used for cloning) */
  repository: string;
  /**
   * Skill subdirectory name for multi-skill repositories
   * e.g., "my-skill" for a repository with skills/my-skill/SKILL.md
   */
  skillId?: string;
  /**
   * @deprecated Use `repository` with `fetchRemoteSkillMd()` instead.
   * Direct URL to fetch SKILL.md (legacy, may not work for private repos)
   */
  skillMdUrl?: string;
  /** Version (commit or tag) */
  version?: string;
  /** GitHub stars count */
  stars?: number;
  /** Installation count (from skills.sh) */
  installs?: number;
  /** Last updated timestamp */
  updatedAt?: string;
  /** Marketplace name (e.g., "Skills.sh", "Community Hub") */
  marketName?: string;
}
```

**Step 2: 运行类型检查**

Run: `npm run compile`
Expected: 编译成功，无类型错误

**Step 3: 提交**

```bash
git add src/types/api.ts
git commit -m "feat(api): add marketName field to SkillSearchResult

添加可选的 marketName 字段，用于标识技能来源市场。
支持在搜索结果中显示市场名称。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 后端实现 - APIClient 添加 marketName 到搜索结果

**文件:**
- Modify: `src/managers/APIClient.ts:72-109`

**Step 1: 定位 fetchFromAPI 方法**

确认 `fetchFromAPI` 方法的位置，它在第 72-109 行。

**Step 2: 修改 normalizeSkillResult 方法添加 marketName 参数**

修改 `normalizeSkillResult` 方法签名以接受 `marketName`：

```typescript
private normalizeSkillResult(skill: any, _apiUrl: string, marketName?: string): SkillSearchResult {
  // Handle skills.sh API format: { id, name, installs, source }
  if (skill.source) {
    return this.parseSourceField(skill, marketName);
  }

  // Handle generic API format (already has full URLs)
  return {
    id: skill.id || skill.repository || `${skill.name || 'unknown'}`,
    name: skill.name || 'Unknown',
    description: skill.description || '',
    repository: skill.repository || skill.repo || '',
    skillId: skill.skillId,  // Pass through skillId for multi-skill repos
    skillMdUrl: skill.skillMdUrl || skill.skill_md_url || skill.readme_url || '',
    version: skill.version || skill.commit || skill.tag,
    stars: skill.stars || skill.star_count || 0,
    installs: skill.installs,
    updatedAt: skill.updatedAt || skill.updated_at || skill.last_updated,
    marketName  // 添加 marketName 字段
  };
}
```

**Step 3: 修改 fetchFromAPI 调用 normalizeSkillResult**

更新 `fetchFromAPI` 方法中调用 `normalizeSkillResult` 的两处（第 97 和 100 行）：

```typescript
if (Array.isArray(responseData.skills)) {
  const marketName = config.name || new URL(config.url).hostname;
  return responseData.skills.map((skill: any) => this.normalizeSkillResult(skill, config.url, marketName));
} else if (Array.isArray(responseData)) {
  // Handle direct array response
  const marketName = config.name || new URL(config.url).hostname;
  return responseData.map((skill: any) => this.normalizeSkillResult(skill, config.url, marketName));
}
```

**Step 4: 修改 parseSourceField 方法签名**

更新 `parseSourceField` 方法以接受 `marketName` 参数（第 203 行）：

```typescript
private parseSourceField(skill: any, marketName?: string): SkillSearchResult {
  const source = skill.source;

  // ... 现有逻辑保持不变 ...

  return {
    id: skill.id || cleanRepoPath,
    name: skill.name || 'Unknown',
    description: skill.installs
      ? `${this.formatInstalls(skill.installs)}`
      : skill.description || 'A skill for AI coding assistants',
    repository,
    skillId: skill.skillId,  // Pass through skillId for multi-skill repos
    skillMdUrl,
    version: undefined,
    stars: 0,
    installs: skill.installs,
    updatedAt: undefined,
    marketName  // 添加 marketName 字段
  };
}
```

**Step 5: 运行类型检查**

Run: `npm run compile`
Expected: 编译成功，无类型错误

**Step 6: 运行后端测试（如果存在）**

Run: `npm test -- src/test/suite/api-client.test.ts`
Expected: 现有测试通过

**Step 7: 提交**

```bash
git add src/managers/APIClient.ts
git commit -m "feat(api-client): add marketName to search results

在 fetchFromAPI 方法中添加 marketName 字段到搜索结果。
优先使用 config.name，否则使用 URL hostname。
更新 normalizeSkillResult 和 parseSourceField 方法签名。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: 前端工具 - 创建市场颜色生成工具

**文件:**
- Create: `webview/src/utils/marketColors.ts`

**Step 1: 创建颜色工具文件**

创建新文件 `webview/src/utils/marketColors.ts`：

```typescript
/**
 * Market color generation utilities
 * Generates consistent colors for marketplace tags based on market name hash
 */

/** Color configuration for UI tags */
export interface MarketColorConfig {
  /** Background color (rgba for transparency) */
  bg: string;
  /** Text color (hex) */
  color: string;
  /** Border color (rgba for transparency) */
  borderColor: string;
}

/** 预设的 12 种市场颜色 - 精心挑选的色相，确保区分度和可读性 */
const MARKET_PALETTE: MarketColorConfig[] = [
  { bg: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', borderColor: 'rgba(239, 68, 68, 0.2)' },   // Red
  { bg: 'rgba(249, 115, 22, 0.1)', color: '#EA580C', borderColor: 'rgba(249, 115, 22, 0.2)' },  // Orange
  { bg: 'rgba(234, 179, 8, 0.1)', color: '#CA8A04', borderColor: 'rgba(234, 179, 8, 0.2)' },    // Yellow
  { bg: 'rgba(34, 197, 94, 0.1)', color: '#16A34A', borderColor: 'rgba(34, 197, 94, 0.2)' },    // Green
  { bg: 'rgba(20, 184, 166, 0.1)', color: '#0D9488', borderColor: 'rgba(20, 184, 166, 0.2)' },  // Teal
  { bg: 'rgba(6, 182, 212, 0.1)', color: '#0891B2', borderColor: 'rgba(6, 182, 212, 0.2)' },    // Cyan
  { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563EB', borderColor: 'rgba(59, 130, 246, 0.2)' },   // Blue
  { bg: 'rgba(99, 102, 241, 0.1)', color: '#4F46E5', borderColor: 'rgba(99, 102, 241, 0.2)' },   // Indigo
  { bg: 'rgba(139, 92, 246, 0.1)', color: '#7C3AED', borderColor: 'rgba(139, 92, 246, 0.2)' },   // Violet
  { bg: 'rgba(236, 72, 153, 0.1)', color: '#DB2777', borderColor: 'rgba(236, 72, 153, 0.2)' },   // Pink
  { bg: 'rgba(168, 162, 158, 0.1)', color: '#78716C', borderColor: 'rgba(168, 162, 158, 0.2)' },  // Stone
  { bg: 'rgba(107, 114, 128, 0.1)', color: '#4B5563', borderColor: 'rgba(107, 114, 128, 0.2)' }, // Gray
];

/**
 * Simple string hash function
 * Produces consistent hash values for the same input string
 * @param str - Input string to hash
 * @returns Numeric hash value (non-negative integer)
 */
function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get color configuration for a marketplace
 * Colors are consistent for the same market name across sessions
 * @param marketName - Name of the marketplace
 * @returns Color configuration with bg, color, and borderColor
 */
export function getMarketColorConfig(marketName: string): MarketColorConfig {
  const index = stringHash(marketName) % MARKET_PALETTE.length;
  return MARKET_PALETTE[index];
}
```

**Step 2: 创建 utils 目录（如果不存在）**

Run: `mkdir -p webview/src/utils`
Expected: 目录创建成功或已存在

**Step 3: 验证文件语法**

Run: `cd webview && npm run type-check 2>&1 | head -20`
Expected: 无语法错误（可能还没有 type-check 脚本，那就跳过）

**Step 4: 提交**

```bash
git add webview/src/utils/marketColors.ts
git commit -m "feat(webview): add market color generation utility

创建颜色生成工具，基于市场名称哈希从预设调色板分配颜色。
包含 12 种精心挑选的颜色，确保区分度和可读性。
同一市场名称始终获得相同颜色。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 前端类型 - 更新 SkillCardProps

**文件:**
- Modify: `webview/src/types/index.ts:84-105`

**Step 1: 更新 SkillCardProps 接口**

在 `SkillCardProps` 接口中添加 `marketName` 可选字段：

```typescript
export interface SkillCardProps {
  id: string;
  name: string;
  description: string;
  agentType: SupportedAgent;
  scope: 'project' | 'global';
  installed?: boolean;
  hasUpdate?: boolean;
  repository?: string;
  skillMdUrl?: string;
  source?: {
    type: 'local' | 'remote';
    skillMdPath?: string;
    localPath?: string;
  };
  stars?: number;
  updatedAt?: string;
  /** Marketplace name (for uninstalled skills) */
  marketName?: string;
  onInstall?: () => void;
  onRemove?: () => void;
  onUpdate?: () => void;
  onViewDetails?: () => void;
}
```

**Step 2: 提交**

```bash
git add webview/src/types/index.ts
git commit -m "feat(webview-types): add marketName to SkillCardProps

添加可选的 marketName 字段到 SkillCardProps 接口。
用于在技能卡片上显示市场来源标签。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 前端实现 - SkillCard 显示市场标签

**文件:**
- Modify: `webview/src/components/SkillCard.tsx:1-185`

**Step 1: 添加 marketColors 导入**

在文件顶部添加导入：

```typescript
import React, { useState } from 'react';
import { vscode } from '../vscode';
import { SkillCardProps, getAgentTagConfig } from '../types';
import { getMarketColorConfig } from '../utils/marketColors';
```

**Step 2: 更新组件函数签名**

解构 `marketName` prop：

```typescript
export const SkillCard: React.FC<SkillCardProps> = ({
  id,
  name,
  description,
  agentType,
  scope,
  installed = false,
  hasUpdate = false,
  repository,
  skillMdUrl,
  source,
  stars,
  updatedAt,
  marketName,
  onInstall,
  onRemove,
  onUpdate,
  onViewDetails
}) => {
```

**Step 3: 添加市场标签逻辑**

在现有 `tagConfig` 定义之后添加市场标签配置（约第 26 行后）：

```typescript
  // Ensure tagConfig is never undefined
  const tagConfig = getAgentTagConfig(agentType) || {
    label: agentType.replace('-', ' ').replace(/^\w/, c => c.toUpperCase()),
    color: '#6B7280',
    bg: 'rgba(107, 114, 128, 0.1)',
    borderColor: 'rgba(107, 114, 128, 0.2)',
  };

  // 市场标签配置（未安装时使用）
  const isValidMarketName = marketName?.trim().length > 0;
  const marketTagConfig = isValidMarketName && !installed
    ? getMarketColorConfig(marketName.trim())
    : null;

  // IDE 标签配置（已安装时使用）
  const ideTagConfig = installed && agentType !== 'universal'
    ? tagConfig
    : null;
```

**Step 4: 更新标签渲染逻辑**

替换现有的 IDE 标签渲染逻辑（约第 92-104 行）为互斥的市场/IDE 标签：

```typescript
        <div className="skill-header-left">
          {/* 市场标签（未安装时）或 IDE 标签（已安装时） */}
          {marketTagConfig ? (
            <span
              className="market-tag"
              style={{
                backgroundColor: marketTagConfig.bg,
                color: marketTagConfig.color,
                borderColor: marketTagConfig.borderColor,
              }}
            >
              {marketName}
            </span>
          ) : ideTagConfig ? (
            <span
              className="ide-tag"
              style={{
                backgroundColor: ideTagConfig.bg,
                color: ideTagConfig.color,
                borderColor: ideTagConfig.borderColor,
              }}
            >
              {ideTagConfig.label}
            </span>
          ) : null}

          {/* Skill Name */}
          <h3 className="skill-name">{name}</h3>
        </div>
```

**Step 5: 提交**

```bash
git add webview/src/components/SkillCard.tsx
git commit -m "feat(skill-card): add marketplace tag display

在技能卡片上显示市场标签（未安装技能）或 IDE 标签（已安装技能）。
标签互斥显示，避免信息混乱。
使用市场颜色生成工具为每个市场分配固定颜色。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 前端实现 - MarketplaceTab 传递 marketName

**文件:**
- Modify: `webview/src/components/MarketplaceTab.tsx:7-17,174-187`

**Step 1: 更新 MarketplaceSkill 接口**

在 `MarketplaceSkill` 接口中添加 `marketName` 字段：

```typescript
interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  repository: string;
  skillMdUrl: string;
  version?: string;
  stars?: number;
  updatedAt?: string;
  marketName?: string;
}
```

**Step 2: 传递 marketName 到 SkillCard**

在渲染 SkillCard 时传递 `marketName` prop（约第 174-187 行）：

```tsx
            {skills.map(skill => (
              <SkillCard
                key={skill.id}
                id={skill.id}
                name={skill.name}
                description={skill.description}
                repository={skill.repository}
                skillMdUrl={skill.skillMdUrl}
                stars={skill.stars}
                updatedAt={skill.updatedAt}
                marketName={skill.marketName}
                agentType="claude-code" // 市场默认为 claude-code，安装后可选择
                scope="project" // 市场技能默认为项目安装
                installed={false}
                onInstall={() => handleInstall(skill)}
              />
            ))}
```

**Step 3: 提交**

```bash
git add webview/src/components/MarketplaceTab.tsx
git commit -m "feat(marketplace-tab): pass marketName to SkillCard

在 MarketplaceTab 中接收并传递 marketName 到 SkillCard。
确保市场标签正确显示在搜索结果中。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: 前端样式 - 添加市场标签样式

**文件:**
- Modify: `webview/src/App.css`

**Step 1: 定位标签样式**

查找现有的 `.ide-tag` 样式定义，可能在文件中间或末尾。

**Step 2: 添加或更新市场标签样式**

在适当位置添加（如果已有 `.ide-tag` 样式，可以合并或添加别名）：

```css
/* Market and IDE tag styles */
.market-tag,
.ide-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid;
  display: inline-block;
  margin-right: 8px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Step 3: 提交**

```bash
git add webview/src/App.css
git commit -m "style(webview): add market tag styles

添加市场标签样式，包括文本截断处理。
复用 ide-tag 样式保持一致性。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: 后端测试 - 验证 marketName 功能

**文件:**
- Modify: `src/test/suite/api-client.test.ts`

**Step 1: 读取现有测试文件**

Run: `cat src/test/suite/api-client.test.ts`
Expected: 查看现有测试结构

**Step 2: 添加 marketName 测试用例**

在现有测试文件中添加新的测试用例（根据实际测试结构调整）：

```typescript
suite('APIClient - marketName', () => {
  test('should include marketName from config name', async () => {
    const mockConfig: SkillAPIConfig = {
      url: 'https://api.test.com',
      enabled: true,
      name: 'Test Market'
    };

    const client = new APIClient([mockConfig]);
    // Mock the HTTP request
    // ... 根据实际测试结构添加

    const results = await client.searchSkills('test');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].marketName, 'Test Market');
  });

  test('should use hostname as fallback when config name is missing', async () => {
    const mockConfig: SkillAPIConfig = {
      url: 'https://api.example.com',
      enabled: true
      // no name field
    };

    const client = new APIClient([mockConfig]);
    // Mock the HTTP request
    // ... 根据实际测试结构添加

    const results = await client.searchSkills('test');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].marketName, 'api.example.com');
  });
});
```

**Step 3: 运行测试**

Run: `npm test -- src/test/suite/api-client.test.ts`
Expected: 测试通过

**Step 4: 提交**

```bash
git add src/test/suite/api-client.test.ts
git commit -m "test(api-client): add marketName test cases

添加测试验证 marketName 字段正确包含在搜索结果中。
测试 config.name 优先级和 hostname 后备逻辑。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: 手动测试 - 验证端到端功能

**文件:** 无（手动测试）

**Step 1: 编译项目**

Run: `npm run compile`
Expected: 编译成功，无错误

**Step 2: 启动扩展**

Run: `在 VSCode 中按 F5 启动扩展开发主机`
Expected: 扩展在新窗口中启动

**Step 3: 打开技能市场侧边栏**

Action: 在扩展开发主机中打开技能市场侧边栏
Expected: 侧边栏显示正常

**Step 4: 搜索技能**

Action: 在搜索框输入关键词并搜索
Expected: 显示搜索结果卡片，每个卡片上有市场标签

**Step 5: 验证标签颜色**

Action: 观察不同市场的技能标签颜色
Expected:
- 同一市场的技能标签颜色一致
- 不同市场的技能标签颜色不同（大概率）

**Step 6: 验证标签互斥**

Action: 安装一个技能
Expected: 安装后市场标签消失，显示 IDE 标签

**Step 7: 刷新页面验证颜色固定**

Action: 刷新 VSCode 窗口或重新打开侧边栏
Expected: 市场标签颜色保持不变

**Step 8: 测试边界情况**

Action: 测试以下场景
- 没有市场名称的技能（不显示标签）
- 空字符串市场名称（不显示标签）
- 超长市场名称（正确截断）

Expected: 所有边界情况正常处理

**Step 9: 记录测试结果**

在 `docs/MANUAL_TESTING_CHECKLIST.md` 中添加测试记录（如果文件存在）

**Step 10: 提交测试记录**

```bash
git add docs/MANUAL_TESTING_CHECKLIST.md
git commit -m "test: record manual testing results for market tags

记录市场标签功能的手动测试结果。
验证颜色生成、标签互斥、边界情况处理等功能。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: 文档更新 - 更新相关文档

**文件:**
- Update: `README.md` 或其他相关文档

**Step 1: 检查现有文档**

Run: `ls docs/*.md`
Expected: 查看现有文档列表

**Step 2: 更新功能说明**

在适当位置添加市场标签功能的说明（如果需要）：

```markdown
## 市场标签

技能市场搜索结果会显示彩色的市场标签，帮助识别技能来源。
- 每个市场有固定的颜色，基于市场名称自动生成
- 未安装技能显示市场标签
- 已安装技能显示 IDE 类型标签
```

**Step 3: 提交文档更新**

```bash
git add README.md docs/
git commit -m "docs: add marketplace tag feature documentation

添加市场标签功能的使用说明。
解释标签颜色生成和显示逻辑。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 验收标准

实现完成后，验证以下标准：

### 功能完整性
- ✅ 搜索结果显示市场标签
- ✅ 同一市场的标签颜色一致
- ✅ 不同市场的标签颜色不同（大概率）
- ✅ 刷新后颜色保持不变
- ✅ 未安装显示市场标签，已安装显示 IDE 标签

### 代码质量
- ✅ 所有文件已编译通过
- ✅ 类型检查无错误
- ✅ 遵循现有代码风格
- ✅ 无 console 错误或警告

### 测试覆盖
- ✅ 单元测试通过（如果有）
- ✅ 手动测试完成
- ✅ 边界情况处理正确

### 文档完整性
- ✅ 设计文档已创建
- ✅ 实现计划已完成
- ✅ 代码提交信息清晰

---

## 实现顺序建议

按照以下顺序实现可以保证依赖关系正确：
1. Task 1: 类型定义（后端）
2. Task 2: 后端实现
3. Task 3: 前端工具
4. Task 4: 前端类型
5. Task 5: SkillCard 组件
6. Task 6: MarketplaceTab 组件
7. Task 7: 样式
8. Task 8: 后端测试（可选）
9. Task 9: 手动测试
10. Task 10: 文档更新

预计总时间：1-2 小时（不含测试）
