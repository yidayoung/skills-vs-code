# Phase 2: Type Definitions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Define complete TypeScript type system for the entire extension

**Architecture:**
- Centralized type definitions in `src/types/` directory
- Clear separation between domain types (skill) and external types (API)
- Reusable types across extension and webview

**Tech Stack:**
- TypeScript 5.3
- VSCode Extension API types

---

## Task 1: Create Skill Types

**Files:**
- Create: `src/types/skill.ts`

**Step 1: Create skill.ts with all skill-related types**

```typescript
/**
 * Represents a skill that can be installed to various agents
 */
export interface Skill {
  /** Unique identifier: owner/repo/skill-name */
  id: string;
  /** Name from SKILL.md frontmatter */
  name: string;
  /** Description from SKILL.md frontmatter */
  description: string;
  /** Source information (local or remote) */
  source: SkillSource;
  /** Installed versions across agents */
  installedVersions?: InstalledVersion[];
  /** Latest version (commit hash or tag) */
  latestVersion?: string;
  /** Whether an update is available */
  hasUpdate: boolean;
  /** Additional metadata */
  metadata?: SkillMetadata;
}

/**
 * Information about where a skill comes from
 */
export interface SkillSource {
  /** Type of source */
  type: 'local' | 'remote';
  /** GitHub repository: owner/repo */
  repository?: string;
  /** API URL this came from */
  apiUrl?: string;
  /** Local file system path */
  localPath?: string;
  /** Path to the SKILL.md file */
  skillMdPath: string;
}

/**
 * Represents a skill installed to a specific agent
 */
export interface InstalledVersion {
  /** Agent identifier (claude-code, cursor, etc.) */
  agent: string;
  /** Installation scope */
  scope: 'project' | 'global';
  /** File system path */
  path: string;
  /** Installation method */
  installMethod: 'symlink' | 'copy';
  /** Version (commit hash or tag) */
  version?: string;
}

/**
 * Additional metadata about a skill
 */
export interface SkillMetadata {
  /** Whether this is an internal skill */
  internal?: boolean;
  /** Author name */
  author?: string;
  /** Homepage URL */
  homepage?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Installation scope
 */
export type Scope = 'project' | 'global';

/**
 * Installation method
 */
export type InstallMethod = 'symlink' | 'copy';
```

**Step 2: Commit**

```bash
git add src/types/skill.ts
git commit -m "feat: add skill type definitions"
```

---

## Task 2: Create API Types

**Files:**
- Create: `src/types/api.ts`

**Step 1: Create api.ts with API response types**

```typescript
/**
 * Configuration for a skill marketplace API
 */
export interface SkillAPIConfig {
  /** API URL */
  url: string;
  /** Whether this API is enabled */
  enabled: boolean;
  /** Display name */
  name?: string;
  /** Priority for sorting (higher first) */
  priority?: number;
}

/**
 * Response from skill search API
 */
export interface SkillSearchResponse {
  /** Search results */
  skills: SkillSearchResult[];
  /** Total number of results */
  total: number;
  /** Page number (if paginated) */
  page?: number;
}

/**
 * A skill from marketplace search results
 */
export interface SkillSearchResult {
  /** Unique identifier */
  id: string;
  /** Skill name */
  name: string;
  /** Skill description */
  description: string;
  /** GitHub repository */
  repository: string;
  /** URL to fetch SKILL.md */
  skillMdUrl: string;
  /** Version (commit or tag) */
  version?: string;
  /** GitHub stars count */
  stars?: number;
  /** Last updated timestamp */
  updatedAt?: string;
}

/**
 * Cached skill content
 */
export interface CachedSkill {
  /** Original URL */
  url: string;
  /** File content */
  content: string;
  /** Cache timestamp */
  timestamp: number;
  /** Content size in bytes */
  size: number;
}
```

**Step 2: Commit**

```bash
git add src/types/api.ts
git commit -m "feat: add API type definitions"
```

---

## Task 3: Create Agent Types

**Files:**
- Create: `src/types/agents.ts`

**Step 1: Create agents.ts with agent configuration types**

```typescript
/**
 * Information about a supported agent/IDE
 */
export interface AgentInfo {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Project-relative install path */
  projectPath: string;
  /** Global install path */
  globalPath: string;
}

/**
 * All supported agents
 * (This will be populated from npx skills data)
 */
export type SupportedAgent =
  | 'claude-code'
  | 'cursor'
  | 'opencode'
  | 'cline'
  | 'codex'
  | 'github-copilot'
  // ... more agents as needed

/**
 * Agent selection for installation
 */
export interface AgentSelection {
  /** Agent identifier */
  agent: SupportedAgent;
  /** Whether selected for installation */
  selected: boolean;
}
```

**Step 2: Commit**

```bash
git add src/types/agents.ts
git commit -m "feat: add agent type definitions"
```

---

## Task 4: Create Configuration Types

**Files:**
- Create: `src/types/config.ts`

**Step 1: Create config.ts with VSCode configuration types**

```typescript
/**
 * VSCode configuration for the extension
 */
export interface SkillsConfig {
  /** API URLs for marketplace */
  apiUrls: SkillAPIConfig[];
  /** Maximum cache size in bytes */
  cacheMaxSize: number;
  /** Cache expiry time in days */
  cacheExpiryDays: number;
  /** Default selected agents */
  defaultAgents: string[];
  /** Default installation scope */
  defaultScope: Scope;
}

/**
 * User preferences (stored in globalState)
 */
export interface UserPreferences {
  /** Default selected agents */
  defaultAgents: string[];
  /** Default installation scope */
  defaultScope: Scope;
  /** Recently used API URLs */
  recentAPIs: string[];
}

/**
 * Re-export types from other files
 */
import { Scope } from './skill';
export { Scope };
export type { SkillAPIConfig } from './api';
```

**Step 2: Commit**

```bash
git add src/types/config.ts
git commit -m "feat: add configuration type definitions"
```

---

## Task 5: Create WebView Message Types

**Files:**
- Create: `src/types/messages.ts`

**Step 1: Create messages.ts with WebView communication types**

```typescript
/**
 * Message types sent between extension and webview
 */
export type MessageType =
  | 'ready'                    // Webview is ready
  | 'installedSkills'          // Extension → Webview: list of installed skills
  | 'search'                   // Webview → Extension: search query
  | 'searchResults'            // Extension → Webview: search results
  | 'searchError'              // Extension → Webview: search failed
  | 'install'                  // Webview → Extension: install skill
  | 'update'                   // Webview → Extension: update skill
  | 'remove'                   // Webview → Extension: remove skill
  | 'viewSkill'                // Webview → Extension: view skill details
  | 'skillsUpdateStatus'       // Extension → Webview: which skills have updates
  | 'searchStart';             // Extension → Webview: search started

/**
 * Base message interface
 */
export interface VSCodeMessage {
  type: MessageType;
  [key: string]: any;
}

/**
 * Ready message (no payload)
 */
export interface ReadyMessage extends VSCodeMessage {
  type: 'ready';
}

/**
 * Installed skills message
 */
export interface InstalledSkillsMessage extends VSCodeMessage {
  type: 'installedSkills';
  data: import('./skill').Skill[];
}

/**
 * Search message
 */
export interface SearchMessage extends VSCodeMessage {
  type: 'search';
  query: string;
}

/**
 * Install skill message
 */
export interface InstallSkillMessage extends VSCodeMessage {
  type: 'install';
  skill: import('./api').SkillSearchResult;
}

/**
 * Update skill message
 */
export interface UpdateSkillMessage extends VSCodeMessage {
  type: 'update';
  skill: import('./skill').Skill;
}

/**
 * View skill message
 */
export interface ViewSkillMessage extends VSCodeMessage {
  type: 'viewSkill';
  skill: import('./skill').Skill | import('./api').SkillSearchResult;
}
```

**Step 2: Commit**

```bash
git add src/types/messages.ts
git commit -m "feat: add WebView message type definitions"
```

---

## Task 6: Create Type Index

**Files:**
- Create: `src/types/index.ts`

**Step 1: Create index.ts to export all types**

```typescript
// Skill types
export * from './skill';

// API types
export * from './api';

// Agent types
export * from './agents';

// Configuration types
export * from './config';

// Message types
export * from './messages';
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add type index barrel export"
```

---

## Phase 2 Completion Checklist

- [x] Skill types defined (Skill, SkillSource, InstalledVersion, etc.)
- [x] API types defined (SkillSearchResponse, SkillSearchResult, etc.)
- [x] Agent types defined (AgentInfo, SupportedAgent)
- [x] Configuration types defined (SkillsConfig, UserPreferences)
- [x] WebView message types defined (all message types)
- [x] Type index barrel created
- [x] All changes committed to git

---

**Phase 2 Complete!** 🎉

Next: Create Phase 3 plan for User Preferences Manager.
