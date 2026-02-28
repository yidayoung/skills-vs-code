# Market Settings Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sidebar "Market Settings" tab that supports table-based marketplace management with live apply and connection tests.

**Architecture:** Keep extension as source of truth for market configs. Webview sends management messages, extension validates and updates `skills.apiUrls` via VS Code configuration API, then rebuilds API client in-memory to apply changes instantly. UI uses a table editor with per-row actions and test buttons.

**Tech Stack:** TypeScript, VS Code extension API (`workspace.getConfiguration().update`, `onDidChangeConfiguration`), React webview UI.

---

### Task 1: Add market management message contracts

**Files:**
- Modify: `src/types/messages.ts`

**Steps:**
1. Add message types for `requestMarketConfigs`, `marketConfigs`, `saveMarketConfigs`, `testMarketConfig`, `testMarketConfigResult`.
2. Compile to confirm type validity.

### Task 2: Add extension-side market config manager behavior

**Files:**
- Modify: `src/webview/SkillsSidebarWebviewProvider.ts`
- Modify: `src/webview/messages/handlers.ts`
- Modify: `src/managers/APIClient.ts`

**Steps:**
1. Add provider helper to rebuild API client from latest configuration.
2. Register `onDidChangeConfiguration` for `skills.apiUrls` and rebuild client + notify webview.
3. Add message handlers for request/save/test market configs.
4. Add API client helper to test endpoints (`/api/search` and `/api/skills/all-time/0`).

### Task 3: Add Market Settings tab with table editor

**Files:**
- Modify: `webview/src/components/TabContainer.tsx`
- Modify: `webview/src/App.tsx`
- Create: `webview/src/components/MarketSettingsTab.tsx`
- Modify: `webview/src/i18n.ts`
- Modify: `webview/src/App.css`

**Steps:**
1. Add third tab entry for Market Settings.
2. Build a simple editable table: `Enabled | Name | Base URL | Priority | Actions`.
3. Add row operations: add, edit inline, delete, move up/down.
4. Add save button to push full config list.
5. Add per-row test button and show result.
6. Load configs on tab mount and refresh on update message.

### Task 4: Verification

**Files:**
- N/A

**Steps:**
1. Run `npm run compile`.
2. Run `npm run build-webview`.
3. Verify no TypeScript errors and build succeeds.
