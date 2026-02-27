# Skills VSCode Extension Design

**Date:** 2026-02-27
**Author:** Claude Code
**Status:** Approved

## Overview

A VSCode extension that provides a visual interface for managing agent skills, integrating with the `npx skills` CLI ecosystem. The extension offers a sidebar webview for browsing, installing, updating, and managing skills across multiple IDEs (Claude Code, Cursor, OpenCode, etc.).

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────┐
│                   Extension (extension.ts)           │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ SkillSidebar    │  │ SkillDetailView         │  │
│  │  (WebView + Tab)│  │  (Markdown Preview)     │  │
│  └─────────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Skill       │  │ SkillCache  │  │ APIClient   │ │
│  │ Manager     │  │             │  │             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│         │                   │                   │    │
│    [npx skills        [globalStorage]    [fetch with     │
│     core logic]                          retry logic]    │
└─────────────────────────────────────────────────────┘
```

## Project Structure

```
skills-vs-code/
├── src/
│   ├── extension.ts                          # 扩展入口
│   ├── types/
│   │   ├── skill.ts                          # Skill 相关类型
│   │   └── api.ts                            # API 响应类型
│   ├── managers/
│   │   ├── SkillManager.ts                   # 核心：从 npx skills 复制的逻辑
│   │   ├── SkillCache.ts                     # globalStorage 缓存管理
│   │   ├── APIClient.ts                      # API 请求客户端
│   │   └── UserPreferences.ts                # 用户偏好设置
│   ├── webview/
│   │   ├── SkillSidebar.ts                   # 侧边栏 WebView
│   │   └── messages/                         # WebView 消息处理
│   ├── editors/
│   │   └── SkillDetailProvider.ts            # Markdown 详情展示
│   └── utils/
│       ├── pathUtils.ts                      # 路径处理工具
│       └── npxSkillAdapter.ts                # npx skills 适配器
├── webview/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── App.tsx
│   │   └── utils/vscode.ts
├── package.json
└── tsconfig.json
```

## Core Components

### 1. SkillManager

**Purpose:** Core business logic copied from `npx skills` CLI

**Responsibilities:**
- List installed skills across all agents
- Install skills to specific agents/scopes
- Check for updates
- Update and remove skills
- Scan skill directories

**Key Methods:**
```typescript
class SkillManager {
  listInstalledSkills(): Promise<Skill[]>
  installSkill(source: string, agents: string[], scope: Scope): Promise<void>
  checkUpdates(skills: Skill[]): Promise<Skill[]>
  updateSkill(skill: Skill, agents: string[]): Promise<void>
  removeSkill(skillId: string, agents: string[], scope: Scope): Promise<void>
}
```

### 2. SkillCache

**Purpose:** Cache remote skill.md files using VSCode globalStorage

**Strategy:**
- LRU cache with max 50MB
- 7-day expiry
- Cache key: hash of URL
- Auto-cleanup when size limit reached

**Key Methods:**
```typescript
class SkillCache {
  getCachedSkill(url: string): Promise<string | null>
  setCachedSkill(url: string, content: string): Promise<void>
  invalidateCache(url: string): Promise<void>
  clearAll(): Promise<void>
}
```

### 3. APIClient

**Purpose:** Fetch skills from marketplace APIs

**Features:**
- Support multiple API URLs (configurable in settings)
- Enable/disable individual APIs
- Deduplicate results from multiple sources
- Timeout and retry logic
- Mixed-mode loading (cache first, update in background)

**Configuration:**
```json
{
  "skills.apiUrls": [
    { "url": "https://skills.sh/api/search", "enabled": true, "priority": 1 },
    { "url": "https://custom.api/search", "enabled": false, "priority": 2 }
  ]
}
```

### 4. UserPreferences

**Purpose:** Remember user choices for better UX

**Stored Data:**
- Default selected agents
- Default installation scope (project/global)
- Recently used APIs

### 5. SkillSidebar (WebView)

**Purpose:** Main UI for browsing and managing skills

**Tabs:**
1. **Installed Skills**
   - Group by agent or scope
   - Show update status
   - Update/remove actions

2. **Marketplace**
   - Search functionality
   - Install action
   - View skill details

**Implementation Note:** Use ui-ux-pro-max skill to design VSCode-native UI

### 6. SkillDetailView

**Purpose:** Display skill.md content in editor

**Behavior:**
- Local skills: Open file directly
- Remote skills: Fetch from cache or API, then display

## Data Models

### Skill

```typescript
interface Skill {
  id: string;                    // 唯一标识：owner/repo/skill-name
  name: string;                  // 从 SKILL.md frontmatter 提取
  description: string;           // 从 SKILL.md frontmatter 提取
  source: SkillSource;
  installedVersions?: InstalledVersion[];
  latestVersion?: string;
  hasUpdate: boolean;
  metadata?: SkillMetadata;
}

interface SkillSource {
  type: 'local' | 'remote';
  repository?: string;
  apiUrl?: string;
  localPath?: string;
  skillMdPath: string;
}

interface InstalledVersion {
  agent: string;                 // claude-code, cursor, etc.
  scope: 'project' | 'global';
  path: string;
  installMethod: 'symlink' | 'copy';
  version?: string;
}
```

## User Flow

### Install Skill Flow

1. User searches marketplace in sidebar
2. Clicks "Install" on a skill
3. Extension shows QuickPick for:
   - Select target IDEs (claude-code, cursor, etc.)
   - Select scope (Project/User)
4. Shows progress notification
5. Extension calls `SkillManager.installSkill()`
6. Refreshes installed skills list

### View Skill Flow

1. User clicks on a skill card
2. Extension checks if local or remote
3. **Local**: Opens skill.md in editor
4. **Remote**:
   - Checks cache first
   - If cached and valid, display
   - If not, fetches from API, caches, then displays
5. Opens in text editor with markdown preview

## Configuration

### VSCode Settings

```json
{
  "skills.apiUrls": [
    {
      "url": "https://skills.sh/api/search",
      "enabled": true,
      "name": "Official Skills Registry",
      "priority": 1
    }
  ],
  "skills.cacheMaxSize": 52428800,
  "skills.cacheExpiryDays": 7,
  "skills.defaultAgents": ["claude-code"],
  "skills.defaultScope": "global"
}
```

## Technical Decisions

### 1. Code Reuse Strategy

**Decision:** Copy core logic from `npx skills`

**Rationale:**
- Better performance than spawning child processes
- Full control over execution
- Can adapt to VSCode extension context

**Trade-off:** Need to keep in sync with npx skills updates

### 2. Cache Implementation

**Decision:** Use VSCode globalStorage

**Rationale:**
- Persisted across sessions
- Managed by VSCode API
- Simple key-value store

### 3. API Configuration

**Decision:** Store in VSCode settings with enable/disable

**Rationale:**
- Familiar to VSCode users
- Can be configured at workspace or user level
- Easy to edit JSON

### 4. Network Request Handling

**Decision:** Mixed-mode loading

**Rationale:**
- Responsive UI for non-critical operations
- Synchronous for critical operations (install/update)
- Better user experience

## Implementation Plan

See: `docs/plans/2026-02-27-skills-vscode-extension-implementation.md` (to be created by writing-plans skill)

## Dependencies

- `npx skills` source code (for copying core logic)
- `claude-plugin-marketplace` (reference for VSCode extension structure)
- React + Vite (for webview)
- VSCode Extension API

## Success Criteria

- [x] Can list all installed skills across agents
- [x] Can search marketplace for skills
- [x] Can install skills to selected agents
- [x] Can update outdated skills
- [x] Can remove skills
- [x] Can view skill.md content
- [x] Caching works correctly
- [x] UI feels native to VSCode
- [x] Configuration via settings works
