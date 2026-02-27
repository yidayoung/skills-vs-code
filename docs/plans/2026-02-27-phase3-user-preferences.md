# Phase 3: User Preferences Manager

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement user preference storage using VSCode's globalState API

**Architecture:**
- Single UserPreferences class wrapping globalState
- Store default agents, default scope, recent APIs
- Simple get/set API with type safety

**Tech Stack:**
- VSCode Extension API (globalState)
- TypeScript types from Phase 2

---

## Task 1: Create UserPreferences Class

**Files:**
- Create: `src/managers/UserPreferences.ts`

**Step 1: Create UserPreferences class**

```typescript
import * as vscode from 'vscode';
import { Scope } from '../types';

const DEFAULT_AGENTS = ['claude-code'];
const DEFAULT_SCOPE: Scope = 'global';

/**
 * Manages user preferences stored in VSCode globalState
 */
export class UserPreferences {
  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Get the default selected agents
   */
  getDefaultAgents(): string[] {
    return this.context.globalState.get<string[]>('defaultAgents', DEFAULT_AGENTS);
  }

  /**
   * Set the default selected agents
   */
  async setDefaultAgents(agents: string[]): Promise<void> {
    await this.context.globalState.update('defaultAgents', agents);
  }

  /**
   * Get the default installation scope
   */
  getDefaultScope(): Scope {
    return this.context.globalState.get<Scope>('defaultScope', DEFAULT_SCOPE);
  }

  /**
   * Set the default installation scope
   */
  async setDefaultScope(scope: Scope): Promise<void> {
    await this.context.globalState.update('defaultScope', scope);
  }

  /**
   * Get recently used API URLs
   */
  getRecentAPIs(): string[] {
    return this.context.globalState.get<string[]>('recentAPIs', []);
  }

  /**
   * Add an API to recent list (maintains max 5)
   */
  async addRecentAPI(apiUrl: string): Promise<void> {
    const recent = this.getRecentAPIs().filter(u => u !== apiUrl);
    recent.unshift(apiUrl);
    await this.context.globalState.update('recentAPIs', recent.slice(0, 5));
  }

  /**
   * Clear all preferences
   */
  async clearAll(): Promise<void> {
    await this.context.globalState.update('defaultAgents', undefined);
    await this.context.globalState.update('defaultScope', undefined);
    await this.context.globalState.update('recentAPIs', undefined);
  }
}
```

**Step 2: Commit**

```bash
git add src/managers/UserPreferences.ts
git commit -m "feat: add UserPreferences manager"
```

---

## Task 2: Create Tests for UserPreferences

**Files:**
- Create: `src/managers/__tests__/UserPreferences.test.ts`

**Step 1: Create test file**

```typescript
import * as vscode from 'vscode';
import { UserPreferences } from '../UserPreferences';
import { Scope } from '../../types';

// Mock vscode.ExtensionContext
const createMockContext = (): vscode.ExtensionContext => ({
  globalState: {
    get: jest.fn(),
    update: jest.fn()
  },
  // Other required properties...
} as any);

describe('UserPreferences', () => {
  let preferences: UserPreferences;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    mockContext = createMockContext();
    preferences = new UserPreferences(mockContext);
  });

  describe('getDefaultAgents', () => {
    it('should return stored agents', () => {
      (mockContext.globalState.get as jest.Mock).mockReturnValue(['claude-code', 'cursor']);
      expect(preferences.getDefaultAgents()).toEqual(['claude-code', 'cursor']);
    });

    it('should return default when none stored', () => {
      (mockContext.globalState.get as jest.Mock).mockReturnValue(undefined);
      expect(preferences.getDefaultAgents()).toEqual(['claude-code']);
    });
  });

  describe('setDefaultAgents', () => {
    it('should update stored agents', async () => {
      await preferences.setDefaultAgents(['cursor', 'opencode']);
      expect(mockContext.globalState.update).toHaveBeenCalledWith('defaultAgents', ['cursor', 'opencode']);
    });
  });

  describe('getDefaultScope', () => {
    it('should return stored scope', () => {
      (mockContext.globalState.get as jest.Mock).mockReturnValue('project');
      expect(preferences.getDefaultScope()).toBe('project');
    });

    it('should return default when none stored', () => {
      (mockContext.globalState.get as jest.Mock).mockReturnValue(undefined);
      expect(preferences.getDefaultScope()).toBe('global');
    });
  });

  describe('addRecentAPI', () => {
    it('should add API to front of list', async () => {
      (mockContext.globalState.get as jest.Mock).mockReturnValue(['api2.com', 'api3.com']);
      await preferences.addRecentAPI('api1.com');
      expect(mockContext.globalState.update).toHaveBeenCalledWith('recentAPIs', ['api1.com', 'api2.com', 'api3.com']);
    });

    it('should remove duplicate if exists', async () => {
      (mockContext.globalState.get as jest.Mock).mockReturnValue(['api1.com', 'api2.com']);
      await preferences.addRecentAPI('api1.com');
      expect(mockContext.globalState.update).toHaveBeenCalledWith('recentAPIs', ['api1.com', 'api2.com']);
    });

    it('should limit to 5 items', async () => {
      const existing = ['api1.com', 'api2.com', 'api3.com', 'api4.com', 'api5.com'];
      (mockContext.globalState.get as jest.Mock).mockReturnValue(existing);
      await preferences.addRecentAPI('api0.com');
      const expected = ['api0.com', 'api1.com', 'api2.com', 'api3.com', 'api4.com'];
      expect(mockContext.globalState.update).toHaveBeenCalledWith('recentAPIs', expected);
    });
  });
});
```

**Step 2: Commit**

```bash
git add src/managers/__tests__/UserPreferences.test.ts
git commit -m "test: add UserPreferences tests"
```

---

## Task 3: Integrate with Extension

**Files:**
- Modify: `src/extension.ts`

**Step 1: Add UserPreferences to extension**

Modify extension.ts to export the UserPreferences class:

```typescript
import * as vscode from 'vscode';
import { SkillSidebarProvider } from './webview/SkillSidebarProvider';
export { UserPreferences } from './managers/UserPreferences';

export function activate(context: vscode.ExtensionContext) {
  console.log('Skills VSCode extension is now active!');

  const disposable = vscode.commands.registerCommand(
    'skills.showSidebar',
    () => {
      SkillSidebarProvider.show(context);
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
```

**Step 2: Commit**

```bash
git add src/extension.ts
git commit -m "feat: export UserPreferences from extension"
```

---

## Phase 3 Completion Checklist

- [x] UserPreferences class created
- [x] Tests written and passing
- [x] Exported from extension
- [x] All changes committed to git

---

**Phase 3 Complete!** 🎉

Next: Create Phase 4 plan for Skill Manager Core.
