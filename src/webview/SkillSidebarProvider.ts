import * as vscode from 'vscode';
import { setupMessageHandlers } from './messages/handlers';
import { SkillManager } from '../managers/SkillManager';
import { APIClient } from '../managers/APIClient';
import { SkillCache } from '../managers/SkillCache';
import { UserPreferences } from '../managers/UserPreferences';

export class SkillSidebarProvider {
  public static currentPanel: SkillSidebarProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private managers!: {
    skillManager: SkillManager;
    apiClient: APIClient;
    skillCache: SkillCache;
    userPreferences: UserPreferences;
  };

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.ExtensionContext['extensionUri'],
    context: vscode.ExtensionContext
  ) {
    this._panel = panel;

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
        context.globalStorageUri.fsPath
      ),
      apiClient: new APIClient(apiUrls, context),
      skillCache: new SkillCache(context),
      userPreferences: new UserPreferences(context)
    };

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Setup message handlers with managers
    setupMessageHandlers(panel, context, this.managers);
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
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist')
        ]
      }
    );

    SkillSidebarProvider.currentPanel = new SkillSidebarProvider(
      panel,
      context.extensionUri,
      context
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Use the correct path for the built files
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'sidebar.sidebar.js')
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'sidebar.sidebar.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline';">
  <title>Skills Manager</title>
  <link rel="stylesheet" href="${cssUri}">
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
