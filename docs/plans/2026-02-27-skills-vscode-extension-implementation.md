# Skills VSCode Extension - Implementation Roadmap

> **For Claude:** This is the master roadmap. Each phase has its own detailed implementation plan.
>
> **Execution:** Execute phases sequentially. Each phase is self-contained and can be implemented independently.

**Goal:** Build a VSCode extension for managing agent skills with visual interface

**Overall Architecture:**
- WebView sidebar for UI (React + Vite)
- Core managers for business logic (copied from npx skills)
- globalStorage for caching remote skills
- Extension API for VSCode integration

**Tech Stack:**
- TypeScript
- VSCode Extension API
- React + Vite (WebView)
- TailwindCSS (via ui-ux-pro-max skill)

---

## Phase Overview

### Phase 1: Project Foundation
**File:** `2026-02-27-phase1-project-foundation.md`

**Goal:** Initialize VSCode extension project with build infrastructure

**Deliverables:**
- Working VSCode extension with Hello World webview
- TypeScript configuration
- React + Vite webview build setup
- Basic project structure

**Estimated Time:** 1-2 hours

---

### Phase 2: Type Definitions
**File:** `2026-02-27-phase2-type-definitions.md`

**Goal:** Define all TypeScript types and interfaces

**Deliverables:**
- Skill types (Skill, SkillSource, InstalledVersion)
- API types (SkillSearchResponse, SkillSearchResult)
- Configuration types
- Complete type system

**Estimated Time:** 30-60 minutes

---

### Phase 3: User Preferences Manager
**File:** `2026-02-27-phase3-user-preferences.md`

**Goal:** Implement user preference storage

**Deliverables:**
- UserPreferences class
- Store/retrieve default agents
- Store/retrieve default scope
- Test coverage

**Estimated Time:** 1-2 hours

---

### Phase 4: Skill Manager Core
**File:** `2026-02-27-phase4-skill-manager.md`

**Goal:** Copy and adapt core logic from npx skills

**Deliverables:**
- SkillManager class with list/install/update/remove
- Agent configuration from npx skills
- Directory scanning logic
- Test coverage

**Estimated Time:** 3-4 hours

**Note:** This is the largest phase as it involves understanding and copying npx skills logic.

---

### Phase 5: API Client
**File:** `2026-02-27-phase5-api-client.md`

**Goal:** Implement marketplace API client

**Deliverables:**
- APIClient class
- Search functionality
- Multiple URL support with enable/disable
- Deduplication logic
- Error handling and retry
- Test coverage

**Estimated Time:** 2-3 hours

---

### Phase 6: Cache Manager
**File:** `2026-02-27-phase6-cache-manager.md`

**Goal:** Implement caching for remote skill.md files

**Deliverables:**
- SkillCache class using globalStorage
- LRU eviction
- Expiry checking
- Size management
- Test coverage

**Estimated Time:** 2-3 hours

---

### Phase 7: WebView UI - Basic Structure
**File:** `2026-02-27-phase7-webview-basic.md`

**Goal:** Build basic webview with tab navigation

**Deliverables:**
- SkillSidebar provider class
- React webview with tabs
- Message passing between extension and webview
- Basic styling using VSCode variables

**Estimated Time:** 2-3 hours

---

### Phase 8: WebView UI - Installed Skills Tab
**File:** `2026-02-27-phase8-webview-installed.md`

**Goal:** Build installed skills list with grouping

**Deliverables:**
- InstalledSkills component
- Group by agent/scope toggle
- SkillCard component
- Update/remove actions
- Loading states

**Estimated Time:** 3-4 hours

**Note:** Use @ui-ux-pro-max:ui-ux-pro-max for VSCode-native design

---

### Phase 9: WebView UI - Marketplace Tab
**File:** `2026-02-27-phase9-webview-marketplace.md`

**Goal:** Build marketplace search and browse

**Deliverables:**
- MarketplaceTab component
- Search input
- Skill list display
- Install action
- Loading and error states

**Estimated Time:** 2-3 hours

**Note:** Use @ui-ux-pro-max:ui-ux-pro-max for VSCode-native design

---

### Phase 10: Skill Detail View
**File:** `2026-02-27-phase10-skill-detail-view.md`

**Goal:** Display skill.md content in editor

**Deliverables:**
- SkillDetailProvider class
- Open local files
- Fetch and cache remote files
- Markdown preview
- Error handling

**Estimated Time:** 2-3 hours

---

### Phase 11: Extension Integration
**File:** `2026-02-27-phase11-extension-integration.md`

**Goal:** Wire everything together in extension.ts

**Deliverables:**
- Extension activation
- Command registration
- Sidebar registration
- Configuration schema
- Status bar integration (optional)

**Estimated Time:** 2-3 hours

---

### Phase 12: Testing & Polish
**File:** `2026-02-27-phase12-testing-polish.md`

**Goal:** Comprehensive testing and bug fixes

**Deliverables:**
- Integration tests
- Manual testing checklist
- Bug fixes
- Performance optimization
- Documentation

**Estimated Time:** 4-6 hours

---

## Execution Guidelines

### Order of Execution
Execute phases sequentially. Each phase builds on the previous ones.

### Starting a Phase
1. Read the phase's detailed plan file
2. Follow the tasks in order
3. Commit after each task
4. Move to next phase only when current phase is complete

### Testing
- Each phase includes its own test tasks
- Run tests after completing each task
- Don't proceed if tests are failing

### Getting Help
- Reference design doc: `2026-02-27-skills-vscode-extension-design.md`
- Reference npx skills source: `/Users/wangyida/GitRepo/skills/src/`
- Reference claude-plugin-marketplace: `/Users/wangyida/GitRepo/claude-plugin-marketplace/src/`

---

## Total Estimated Time

**22-34 hours** of development time across all phases.

---

**Ready to start? Begin with Phase 1: Project Foundation.**
