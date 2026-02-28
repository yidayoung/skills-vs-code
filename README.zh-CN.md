# Agent Skills Manager Pro

[English](./README.md)

在 VS Code 及其兼容 IDE（含 Cursor）中管理 AI Agent 技能。

## 功能

- 从远端市场发现技能。
- 在侧边栏中安装、更新、卸载技能。
- 支持多种 Agent 生态（如 Claude Code、Cursor、Cline）。
- 在 IDE 内直接用 Markdown 查看/编辑 `SKILL.md`。
- 对远端 `SKILL.md` 做本地缓存，提升详情打开速度。

## 环境要求

- VS Code `1.80.0+` 或兼容的 VS Code 系 IDE。
- 系统 `PATH` 中可用 `git`（用于仓库克隆与技能安装流程）。

## 安装

### 从 Marketplace 安装

在 VS Code Marketplace 搜索 **Agent Skills Manager Pro** 并安装。

### 从 VSIX 安装

1. 下载 `.vsix` 安装包。
2. 执行 `Extensions: Install from VSIX...`。
3. 选择下载的文件完成安装。

## 快速开始

1. 从 Activity Bar 打开 **Skills** 视图。
2. 在 **Marketplace** 搜索并安装技能。
3. 在 **Installed** 中点击技能卡片，打开对应 `SKILL.md`。

## 截图

### 侧边栏总览
![侧边栏总览](./assets/01-sidebar-overview.png)

### 市场搜索
![市场搜索](./assets/02-marketplace-search-config.png)

### 技能卡片操作
![技能卡片操作](./assets/03-skill-card-actions.png)

### 已安装页面
![已安装页面](./assets/04-installed-tab.png)

### 技能详情
![技能详情](./assets/05-skill-detail.png)

## 配置项

| 配置 | 说明 | 默认值 |
| --- | --- | --- |
| `skills.apiUrls` | 市场基础 URL（不带路径），扩展会拼接固定 API 路径（例如 `/api/search`、`/api/skills/all-time/{page}`）。 | `[{ "url": "https://skills.sh", "enabled": true, "name": "Skills.sh", "priority": 100 }]` |
| `skills.defaultAgents` | 安装技能时默认目标 Agent。 | `["claude-code"]` |
| `skills.defaultScope` | 默认安装作用域。 | `"global"` |
| `skills.cacheMaxSize` | 下载文档缓存的本地最大大小，单位 MB。 | `50` |
| `skills.cacheExpiryDays` | 下载文档缓存过期天数。 | `7` |
| `skills.skipInstallPrompts` | 跳过安装流程中的交互提示，直接使用默认值。 | `false` |

## 接口文档

- 市场接口规范: [docs/api/api.md](./docs/api/api.md)

## 命令

- `Skills: Refresh`
- `Skills: Search Marketplace`
- `Skills: Install from URL...`
- `Skills: Clear Cache`

## 国际化

- 扩展贡献点文案使用 `package.nls.json` 与 `package.nls.zh-cn.json`。
- Webview UI 根据 IDE 显示语言在英文与简体中文之间切换。

## 开发

```bash
npm install
npm run compile
npm run build-webview
```

发布打包前构建：

```bash
npm run vscode:prepublish
```

## 仓库

- 源码: [github.com/yidayoung/skills-vs-code](https://github.com/yidayoung/skills-vs-code)
- 问题反馈: [github.com/yidayoung/skills-vs-code/issues](https://github.com/yidayoung/skills-vs-code/issues)

## License

MIT
