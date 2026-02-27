import * as vscode from 'vscode';
import { setupMessageHandlers } from './messages/handlers';
import { SkillManager } from '../managers/SkillManager';
import { APIClient } from '../managers/APIClient';
import { SkillCache } from '../managers/SkillCache';
import { UserPreferences } from '../managers/UserPreferences';

/**
 * 侧边栏 WebView Provider
 * 在 VSCode 侧边栏中渲染 Skills Manager UI
 */
export class SkillsSidebarWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'agentSkillsWebView';

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  private managers!: {
    skillManager: SkillManager;
    apiClient: APIClient;
    skillCache: SkillCache;
    userPreferences: UserPreferences;
  };

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    // Get API URLs from configuration
    const apiUrls = vscode.workspace.getConfiguration('skills').get('apiUrls', [
      {
        url: 'https://skills.sh',
        enabled: true,
        name: 'Skills.sh',
        priority: 100
      }
    ]);

    // Initialize managers
    this.managers = {
      skillManager: new SkillManager(
        (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath,
        _context.globalStorageUri.fsPath
      ),
      apiClient: new APIClient(apiUrls, _context),
      skillCache: new SkillCache(_context),
      userPreferences: new UserPreferences(_context)
    };
  }

  /**
   * 解析 WebviewView
   * 当侧边栏被显示时调用
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // 配置 Webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist')
      ]
    };

    // 设置 HTML
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Setup message handlers with managers
    // WebviewView implements the WebviewLike interface
    setupMessageHandlers(webviewView as any, this._context, this.managers);

    // 监听可见性变化
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        // 侧边栏显示时刷新数据
        this.refreshData();
      }
    });

    // 监听 webview 销毁事件，清理订阅
    webviewView.onDidDispose(() => {
      this.dispose();
    });
  }

  /**
   * 刷新数据
   * 通知 webview 重新加载技能数据
   */
  public refreshData(): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'refresh'
      });
    }
  }

  /**
   * 发送消息到 Webview
   */
  public postMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * 生成 Webview HTML 内容
   * @param webview VS Code Webview 实例
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    // 生产模式: 使用构建后的文件
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'sidebar.sidebar.js')
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'sidebar.sidebar.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
  <link href="${styleUri}" rel="stylesheet">
  <title>Skills Manager</title>
  <style>
    /* 移除 VS Code WebviewView 的默认内边距 */
    body {
      padding: 0 !important;
    }
    html {
      padding: 0 !important;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    // vscode.env.language: 当前 IDE 显示语言（VS Code 官方 API）
    window.__LOCALE__ = ${JSON.stringify(vscode.env.language)};
    // 注意: acquireVsCodeApi() 将在 vscode.ts 模块中调用，避免重复调用
  </script>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

/**
 * 生成随机 nonce 值
 * 用于 CSP 策略中的脚本安全
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
