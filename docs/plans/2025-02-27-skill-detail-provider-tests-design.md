# SkillDetailProvider 测试设计文档

**日期**: 2025-02-27
**作者**: Claude Code
**状态**: 已批准

## 测试目标

验证 `SkillDetailProvider.show()` 方法在两种场景下的正确行为：
1. **本地技能**：直接打开本地文件
2. **远端技能**：从 API 拉取 SKILL.md，缓存并展示

## 测试方法：集成测试

**测试文件**：`src/test/suite/skill-detail-provider.test.ts`

**测试范围**：
- 使用真实的依赖（SkillCache、APIClient、VSCode API）
- 只验证正常逻辑，不测试错误场景
- 主要测试真实的远端仓库

## 测试用例

### 1. 本地技能展示

**目的**：验证本地技能能直接打开文件

**步骤**：
1. 创建测试用的本地 SKILL.md 文件
2. 构造本地 skill 对象（`source.type === 'local'`, `source.skillMdPath`）
3. 调用 `SkillDetailProvider.show(skill)`
4. 验证 VSCode 打开了正确的文件

**预期结果**：
- 本地文件在新标签页中打开
- 内容为 SKILL.md 的完整内容

### 2. 远端技能展示（缓存未命中）

**目的**：验证首次访问远端技能时的完整流程

**步骤**：
1. 使用真实的公开技能仓库（如 `anthropics/anthropic-ai-skills`）
2. 清空缓存
3. 调用 `SkillDetailProvider.show(skill)`
4. 验证内容被拉取、缓存并展示

**预期结果**：
- APIClient 发起网络请求
- 内容被存储到缓存
- 新文档打开展示内容

### 3. 远端技能展示（缓存命中）

**目的**：验证缓存生效，避免重复网络请求

**步骤**：
1. 使用相同的远端技能
2. 预先填充缓存
3. 调用 `SkillDetailProvider.show(skill)`
4. 验证直接从缓存读取

**预期结果**：
- 不触发网络请求
- 缓存内容被正确展示
- 响应速度快

### 4. 远端技能展示（缓存过期）

**目的**：验证过期缓存会触发重新拉取

**步骤**：
1. 设置一个过期的缓存条目
2. 调用 `SkillDetailProvider.show(skill)`
3. 验证重新拉取并更新缓存

**预期结果**：
- 旧缓存被忽略
- 发起新的网络请求
- 缓存被更新

## 技术实现

### 测试框架
- Mocha + VSCode 测试框架
- @vscode/test-electron

### 依赖
- 真实的 `SkillCache` 实例
- 真实的 `APIClient` 实例
- VSCode Extension Context

### 测试数据
- 本地测试：临时创建的 SKILL.md 文件
- 远端测试：真实的 GitHub raw 内容 URL
  - 示例：`https://raw.githubusercontent.com/anthropics/anthropic-ai-skills/HEAD/SKILL.md`

## 后续步骤

1. 创建详细的实现计划
2. 编写测试代码
3. 运行测试验证
4. 添加到 CI/CD 流程
