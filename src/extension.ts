import * as vscode from 'vscode';
import { SkillsSidebarWebviewProvider } from './webview/SkillsSidebarWebviewProvider';
import { SkillDetailProvider } from './editors/SkillDetailProvider';
import { APIClient } from './managers/APIClient';
import { SkillCache } from './managers/SkillCache';

let sidebarWebviewProvider: SkillsSidebarWebviewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Register sidebar WebviewView provider
  sidebarWebviewProvider = new SkillsSidebarWebviewProvider(
    context.extensionUri,
    context
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'agentSkillsWebView',
      sidebarWebviewProvider
    )
  );

  // Initialize managers (shared across commands)
  const skillCache = new SkillCache(context);
  const apiClient = new APIClient(
    vscode.workspace.getConfiguration('skills').get('apiUrls', [
      {
        url: 'https://skills.sh',
        enabled: true,
        name: 'Skills.sh',
        priority: 100
      }
    ]),
    context  // Pass context for fetchRemoteSkillMd support
  );

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand(
    'skills.refresh',
    async () => {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Refreshing skills...',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Loading...' });
        // Refresh sidebar webview
        sidebarWebviewProvider?.refreshData();
        progress.report({ increment: 100, message: 'Complete' });
      });
    }
  );

  // Register search command
  const searchCommand = vscode.commands.registerCommand(
    'skills.search',
    async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search for skills',
        placeHolder: 'e.g., git, testing, debugging'
      });

      if (query) {
        try {
          const results = await apiClient.searchSkills(query);

          if (results.length === 0) {
            vscode.window.showInformationMessage(`No results found for "${query}"`);
            return;
          }

          // Show quick pick with results
          const items = results.map(skill => ({
            label: skill.name,
            description: skill.description || '',
            detail: skill.repository || '',
            skill
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Found ${results.length} skills`
          });

          if (selected) {
            // Show skill detail or install
            await SkillDetailProvider.show(selected.skill, { skillCache, apiClient });
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Search failed: ${error}`);
        }
      }
    }
  );

  // Register install from URI command
  const installFromURICommand = vscode.commands.registerCommand(
    'skills.installFromURI',
    async () => {
      const uri = await vscode.window.showInputBox({
        prompt: 'Enter the repository URL or skill identifier',
        placeHolder: 'https://github.com/owner/repo or owner/repo/skill-name'
      });

      if (uri) {
        vscode.window.showInformationMessage(`Installation from URI will be implemented for: ${uri}`);
        // TODO: Implement git clone and skill installation
      }
    }
  );

  // Register view skill command
  const viewSkillCommand = vscode.commands.registerCommand(
    'skills.viewSkill',
    async (skill) => {
      await SkillDetailProvider.show(skill, { skillCache, apiClient });
    }
  );

  // Register clear cache command
  const clearCacheCommand = vscode.commands.registerCommand(
    'skills.clearCache',
    async () => {
      const confirmed = await vscode.window.showWarningMessage(
        'Are you sure you want to clear the skill cache? This will free up disk space but may slow down subsequent skill detail views.',
        'Clear',
        'Cancel'
      );

      if (confirmed === 'Clear') {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Clearing cache...',
          cancellable: false
        }, async () => {
          await skillCache.clear();

          const stats = await skillCache.getCacheStats();
          vscode.window.showInformationMessage(
            `Cache cleared. Current size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB (${stats.count} items)`
          );
        });
      }
    }
  );

  // Register all disposables
  context.subscriptions.push(
    refreshCommand,
    searchCommand,
    installFromURICommand,
    viewSkillCommand,
    clearCacheCommand
  );
}

export function deactivate() {
  // Deactivation logic if needed
}
