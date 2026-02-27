# Phase 1: Project Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Initialize VSCode extension project with complete build infrastructure

**Architecture:**
- VSCode extension using standard extension API
- WebView using React + Vite for modern UI
- TypeScript for type safety
- Modular project structure for scalability

**Tech Stack:**
- VSCode Extension API
- TypeScript 5.x
- React 18
- Vite 5
- TailwindCSS (for later phases)

---

## Task 1: Initialize package.json

**Files:**
- Create: `package.json`

**Step 1: Create package.json with extension metadata**

```json
{
  "name": "skills-vscode",
  "displayName": "Skills Manager",
  "description": "Manage agent skills from VSCode",
  "version": "0.1.0",
  "publisher": "your-publisher-name",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "skills.showSidebar",
        "title": "Show Skills Sidebar",
        "icon": "$(sidebar)"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run compile && npm run build-webview",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "build-webview": "cd webview && npm run build",
    "dev-webview": "cd webview && npm run dev"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "@types/vscode": "^1.80.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

**Step 2: Initialize npm and install dependencies**

Run:
```bash
npm install
```

Expected: `node_modules/` folder created with dependencies

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: initialize package.json with extension metadata"
```

---

## Task 2: Create TypeScript Configuration

**Files:**
- Create: `tsconfig.json`
- Create: `webview/tsconfig.json`
- Create: `webview/tsconfig.node.json`

**Step 1: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "exclude": ["node_modules", ".vscode-test"]
}
```

**Step 2: Create webview/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 3: Create webview/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: Commit**

```bash
git add tsconfig.json webview/tsconfig.json webview/tsconfig.node.json
git commit -m "feat: add TypeScript configuration"
```

---

## Task 3: Create Basic Extension Structure

**Files:**
- Create: `src/extension.ts`
- Create: `.vscodeignore`
- Create: `.gitignore`

**Step 1: Create src/extension.ts**

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Skills VSCode extension is now active!');

  const disposable = vscode.commands.registerCommand(
    'skills.showSidebar',
    () => {
      vscode.window.showInformationMessage('Skills Sidebar coming soon!');
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  console.log('Skills VSCode extension is now deactivated!');
}
```

**Step 2: Create .vscodeignore**

```
.vscode/**
.vscode-test/**
src/**
.gitignore**
.git/**
.DS_Store**
node_modules/**
webview/node_modules/**
webview/src/**
webview/**/*.ts
webview/**/*.tsx
tsconfig.json
webview/tsconfig*.json
webview/vite.config.ts
*.map
package-lock.json
```

**Step 3: Create .gitignore**

```
node_modules/
out/
dist/
webview/dist/
webview/node_modules/
*.vsix
.DS_Store
```

**Step 4: Test compilation**

Run:
```bash
npm run compile
```

Expected: `out/extension.js` and `out/extension.d.ts` created

**Step 5: Commit**

```bash
git add src/extension.ts .vscodeignore .gitignore out/
git commit -m "feat: add basic extension structure"
```

---

## Task 4: Initialize WebView with Vite

**Files:**
- Create: `webview/package.json`
- Create: `webview/vite.config.ts`
- Create: `webview/index.html`
- Create: `webview/src/main.tsx`
- Create: `webview/src/App.tsx`
- Create: `webview/src/vscode.ts`

**Step 1: Create webview/package.json**

```json
{
  "name": "skills-webview",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

**Step 2: Create webview/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidebar: './index.html'
      },
      output: {
        entryFileNames: 'sidebar.[name].js',
        chunkFileNames: 'sidebar.[name].js',
        assetFileNames: 'sidebar.[name].[ext]'
      }
    }
  }
});
```

**Step 3: Create webview/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Skills Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 4: Create webview/src/vscode.ts**

```typescript
export const vscode = acquireVsCodeApi();

export interface VSCodeMessage {
  type: string;
  [key: string]: any;
}
```

**Step 5: Create webview/src/App.tsx**

```typescript
import React from 'react';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <h1>Skills Manager</h1>
      <p>Extension loaded successfully!</p>
    </div>
  );
}
```

**Step 6: Create webview/src/App.css**

```css
.app {
  padding: 20px;
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
}

h1 {
  font-size: 24px;
  margin-bottom: 10px;
}

p {
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
}
```

**Step 7: Create webview/src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 8: Install webview dependencies**

Run:
```bash
cd webview && npm install && cd ..
```

Expected: `webview/node_modules/` created

**Step 9: Test webview build**

Run:
```bash
npm run build-webview
```

Expected: `webview/dist/` created with `sidebar.sidebar.js`

**Step 10: Commit**

```bash
git add webview/
git commit -m "feat: initialize webview with Vite and React"
```

---

## Task 5: Create WebView Provider

**Files:**
- Create: `src/webview/SkillSidebarProvider.ts`
- Modify: `src/extension.ts`

**Step 1: Create src/webview/SkillSidebarProvider.ts**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';

export class SkillSidebarProvider {
  public static currentPanel: SkillSidebarProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.ExtensionContext['extensionUri']
  ) {
    this._panel = panel;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  public static show(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SkillSidebarProvider.currentPanel) {
      SkillSidebarProvider.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'skillsSidebar',
      'Skills',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist')
        ]
      }
    );

    SkillSidebarProvider.currentPanel = new SkillSidebarProvider(
      panel,
      context.extensionUri
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'assets', 'index.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skills Manager</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose() {
    SkillSidebarProvider.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
```

**Step 2: Modify src/extension.ts to use the provider**

```typescript
import * as vscode from 'vscode';
import { SkillSidebarProvider } from './webview/SkillSidebarProvider';

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

**Step 3: Test compilation**

Run:
```bash
npm run compile
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/webview/SkillSidebarProvider.ts src/extension.ts
git commit -m "feat: add WebView provider for sidebar"
```

---

## Phase 1 Completion Checklist

- [x] package.json with extension metadata
- [x] TypeScript configuration (root and webview)
- [x] Basic extension structure (extension.ts)
- [x] WebView initialized with React + Vite
- [x] WebView provider created
- [x] Can compile extension successfully
- [x] Can build webview successfully
- [x] All changes committed to git

---

**Phase 1 Complete!** 🎉

Next: Run `npm run vscode:prepublish` to verify full build works, then proceed to Phase 2.
