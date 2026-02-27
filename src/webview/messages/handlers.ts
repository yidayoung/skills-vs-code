import * as vscode from 'vscode';
import { VSCodeMessage } from '../../types';

export function setupMessageHandlers(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext
): void {
  panel.webview.onDidReceiveMessage(
    async (message: VSCodeMessage) => {
      switch (message.type) {
        case 'ready':
          await handleReady(panel, context);
          break;
        case 'search':
          await handleSearch(panel, message.query);
          break;
        case 'install':
          await handleInstall(panel, context, message.skill);
          break;
        // TODO: Add more handlers
        default:
          console.warn('Unknown message type:', message.type);
      }
    },
    undefined,
    context.subscriptions
  );
}

async function handleReady(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
  // TODO: Send initial data
  panel.webview.postMessage({
    type: 'installedSkills',
    skills: []
  });
}

async function handleSearch(panel: vscode.WebviewPanel, query: string) {
  // TODO: Search and return results
  panel.webview.postMessage({
    type: 'searchResults',
    results: [],
    query
  });
}

async function handleInstall(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  skill: any
) {
  // TODO: Install skill
  panel.webview.postMessage({
    type: 'skillsUpdateStatus',
    status: 'success'
  });
}
