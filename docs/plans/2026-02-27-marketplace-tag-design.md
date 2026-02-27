# 市场标签显示功能设计

**日期**: 2026-02-27
**作者**: Claude
**状态**: 设计已完成，待实施

## 概述

为市场技能添加彩色标签显示，帮助用户快速识别技能来源。标签颜色基于市场名称自动生成，保持固定不变。

## 需求

### 核心需求
1. 市场标签以 tag 形式显示在技能卡片上
2. 颜色自动生成且固定（每次启动不变）
3. 市场标签只在未安装技能上显示
4. 已安装技能显示 IDE 类型标签（如 "Claude Code"）

### 约束条件
- 向后兼容：不破坏现有 API 和前端
- 性能：颜色计算开销可忽略
- 可扩展：支持未来添加自定义颜色或更多市场

## 设计方案

### 方案选择

采用 **方案 A：前端生成颜色**
- 后端只传递市场名称
- 前端使用哈希函数从预设调色板计算颜色
- 逻辑集中，易于调试和维护

### 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        后端                                  │
├─────────────────────────────────────────────────────────────┤
│  SkillAPIConfig (配置)      APIClient                        │
│  ├─ name: string           └─ searchSkills()                │
│  ├─ url: string              └─ 返回结果中添加 marketName    │
│  └─ enabled: boolean                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        前端                                  │
├─────────────────────────────────────────────────────────────┤
│  MarketplaceTab              SkillCard                       │
│  ├─ 接收搜索结果              ├─ 显示市场标签（未安装）      │
│  └─ 传递 marketName          └─ 显示 IDE 标签（已安装）      │
│                              │                               │
│  marketColors.ts              │                               │
│  └─ getMarketColorConfig()   └─ 生成颜色配置                │
│      ├─ stringHash()             ├─ bg                      │
│      └─ MARKET_PALETTE[]         ├─ color                   │
│                                   └─ borderColor             │
└─────────────────────────────────────────────────────────────┘
```

## 数据结构

### 后端类型变更

**文件**: `src/types/api.ts`

```typescript
export interface SkillSearchResult {
  // ... 现有字段
  /** Marketplace name (e.g., "Skills.sh", "Community Hub") */
  marketName?: string;
}
```

### 前端类型变更

**文件**: `webview/src/types/index.ts`（或相应文件）

```typescript
export interface SkillCardProps {
  // ... 现有字段
  /** Marketplace name (for uninstalled skills) */
  marketName?: string;
}

interface MarketplaceSkill {
  // ... 现有字段
  marketName?: string;
}
```

## 核心实现

### 1. 颜色生成工具

**文件**: `webview/src/utils/marketColors.ts`（新建）

```typescript
/** 预设的 12 种市场颜色 */
const MARKET_PALETTE = [
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

/** 简单的字符串哈希函数 */
function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/** 获取市场的颜色配置 */
export function getMarketColorConfig(marketName: string): typeof MARKET_PALETTE[0] {
  const index = stringHash(marketName) % MARKET_PALETTE.length;
  return MARKET_PALETTE[index];
}
```

### 2. 后端实现

**文件**: `src/managers/APIClient.ts`

修改 `searchSkills()` 方法，在聚合搜索结果时添加 `marketName`：

```typescript
async searchSkills(query: string): Promise<SkillSearchResponse> {
  const allResults: SkillSearchResult[] = [];

  for (const config of this.getSortedAPIConfigs()) {
    if (!config.enabled) continue;

    try {
      const results = await this.searchSingleAPI(query, config);
      // 为每个结果添加市场名称
      const resultsWithMarket = results.map(skill => ({
        ...skill,
        marketName: config.name || new URL(config.url).hostname
      }));
      allResults.push(...resultsWithMarket);
    } catch (error) {
      // ... 错误处理
    }
  }

  // ... 返回聚合结果
}
```

### 3. UI 实现

**文件**: `webview/src/components/SkillCard.tsx`

```typescript
import { getMarketColorConfig } from '../utils/marketColors';

export const SkillCard: React.FC<SkillCardProps> = ({
  marketName,
  installed = false,
  agentType,
  // ... 其他 props
}) => {
  // 市场标签配置（未安装时使用）
  const isValidMarketName = marketName?.trim().length > 0;
  const marketTagConfig = isValidMarketName && !installed
    ? getMarketColorConfig(marketName.trim())
    : null;

  // IDE 标签配置（已安装时使用）
  const ideTagConfig = installed && agentType !== 'universal'
    ? getAgentTagConfig(agentType)
    : null;

  return (
    <div className="skill-card">
      <div className="skill-card-header">
        <div className="skill-header-left">
          {/* 市场标签或 IDE 标签（互斥） */}
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

          <h3 className="skill-name">{name}</h3>
        </div>
        {/* ... 其他内容 */}
      </div>
    </div>
  );
};
```

**文件**: `webview/src/components/MarketplaceTab.tsx`

传递 `marketName` 到 SkillCard：

```tsx
<SkillCard
  key={skill.id}
  // ... 其他 props
  marketName={skill.marketName}
  installed={false}
  onInstall={() => handleInstall(skill)}
/>
```

### 4. 样式

**文件**: `webview/src/App.css`

```css
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

## 错误处理和边界情况

| 场景 | 处理方式 |
|------|---------|
| 缺失 marketName | 不显示市场标签，功能正常 |
| 空字符串或只有空格 | trim() 后验证，无效则不显示 |
| 市场名称过长 | CSS max-width + text-overflow 截断 |
| 已安装技能 | 不显示市场标签，显示 IDE 标签 |
| API 配置变更 | 颜色自动重新计算，无需额外处理 |
| 特殊字符 | 哈希函数正常处理 |

## 测试计划

### 单元测试

**文件**: `webview/src/utils/marketColors.test.ts`

- ✅ 同一市场名称返回相同颜色
- ✅ 不同市场名称返回有效颜色
- ✅ 返回值包含 bg、color、borderColor
- ✅ 处理空字符串
- ✅ 处理特殊字符

### 集成测试

**文件**: `webview/src/components/SkillCard.test.tsx`

- ✅ 未安装技能显示市场标签
- ✅ 已安装技能不显示市场标签
- ✅ 标签应用正确颜色样式
- ✅ 无 marketName 时不显示标签

### 手动测试清单

1. ✅ 市场标签显示在未安装技能卡片上
2. ✅ 安装技能后，市场标签消失，IDE 标签出现
3. ✅ 不同市场名称显示不同颜色
4. ✅ 刷新页面后，同一市场的颜色保持一致
5. ✅ 市场名称过长时正确截断
6. ✅ 没有市场名称时不显示标签
7. ✅ 多个市场搜索结果正确显示

## 文件变更清单

### 后端（3 个文件）
- [ ] `src/types/api.ts` - 添加 `marketName` 字段
- [ ] `src/managers/APIClient.ts` - 修改 `searchSkills()` 方法
- [ ] `src/webview/messages/handlers.ts` - 确保消息传递（如需要）

### 前端（4 个文件）
- [ ] `webview/src/utils/marketColors.ts` - 新建
- [ ] `webview/src/components/SkillCard.tsx` - 添加市场标签
- [ ] `webview/src/components/MarketplaceTab.tsx` - 传递 `marketName`
- [ ] `webview/src/types/index.ts` - 更新 `SkillCardProps`
- [ ] `webview/src/App.css` - 添加标签样式

### 测试（2 个文件，可选）
- [ ] `webview/src/utils/marketColors.test.ts` - 新建
- [ ] `webview/src/components/SkillCard.test.tsx` - 扩展

## 向后兼容性

✅ **完全兼容**
- `marketName` 是可选字段
- 旧版本 API 不返回该字段，前端正常处理
- 旧版本前端忽略该字段，不影响现有功能
- 不需要数据库迁移或配置文件变更

## 性能影响

✅ **可忽略**
- 字符串哈希：O(n)，n < 50 字符
- 每个技能卡片计算一次
- 无网络请求增加
- 无额外存储需求

## 可扩展性

✅ **良好**
- 调色板可轻松扩展（修改 `MARKET_PALETTE`）
- 颜色算法独立，易于替换
- 支持未来添加自定义市场颜色
- 市场标签和 IDE 标签架构一致

## 用户体验改进

1. **视觉识别**：用户可以快速识别技能来源
2. **信任建立**：知名市场（如 Skills.sh）的颜色标签增强可信度
3. **信息清晰**：市场标签和 IDE 标签互斥显示，避免混乱
4. **一致性**：同一市场的颜色固定，建立视觉记忆

## 实施建议

1. **优先级**: 中等 - 功能增强，不影响核心流程
2. **复杂度**: 低 - 改动集中，风险可控
3. **依赖**: 无
4. **风险评估**: 低 - 向后兼容，易于回滚

## 未来优化方向

1. **去重逻辑**：多个市场返回相同技能时的合并策略
2. **自定义颜色**：支持在配置中为重要市场指定品牌色
3. **颜色主题**：根据 VSCode 主题自动调整标签颜色
4. **市场筛选**：允许用户按市场筛选搜索结果
