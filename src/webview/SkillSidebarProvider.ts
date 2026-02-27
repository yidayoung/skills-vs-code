import * as vscode from 'vscode';
import * as path from 'path';
import { setupMessageHandlers } from './messages/handlers';

export class SkillSidebarProvider {
  public static currentPanel: SkillSidebarProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.ExtensionContext['extensionUri'],
    context: vscode.ExtensionContext
  ) {
    this._panel = panel;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Setup message handlers
    setupMessageHandlers(panel, context);
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
