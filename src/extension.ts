import * as vscode from 'vscode';
import { SkillSidebarProvider } from './webview/SkillSidebarProvider';
import { SkillDetailProvider } from './editors/SkillDetailProvider';
import { SkillManager } from './managers/SkillManager';
import { UserPreferences } from './managers/UserPreferences';
import { APIClient } from './managers/APIClient';
import { SkillCache } from './managers/SkillCache';

export { UserPreferences } from './managers/UserPreferences';

let statusBarItem: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Skills VSCode extension is now active!');

  // Initialize managers
  const userPreferences = new UserPreferences(context);
  const skillManager = new SkillManager(
    (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath,
    context.globalStorageUri.fsPath
  );
  const skillCache = new SkillCache(context);
  const apiClient = new APIClient(
    vscode.workspace.getConfiguration('skills').get('apiUrls', [
      {
        url: 'https://api.skills.sh/search',
        enabled: true,
        name: 'Skills.sh',
        priority: 100
      }
    ])
  );

  // Create status bar button
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'skills.showSidebar';
  statusBarItem.text = '$(extensions) Skills';
  statusBarItem.tooltip = 'Open Skills Manager';
  statusBarItem.show();

  // Register sidebar command
  const sidebarCommand = vscode.commands.registerCommand(
    'skills.showSidebar',
    () => {
      SkillSidebarProvider.show(context);
    }
  );

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand(
    'skills.refresh',
    async () => {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: 'Refreshing skills...',
        cancellable: false
      }, async () => {
        // Force refresh by reopening sidebar
        SkillSidebarProvider.show(context);
      });
    }
  );

  // Register search command
  const searchCommand = vscode.commands.registerCommand(
    'skills.search',
    () => {
      // Open sidebar and switch to marketplace tab
      SkillSidebarProvider.show(context);
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
      await SkillDetailProvider.show(context, skill);
    }
  );

  // Register all disposables
  context.subscriptions.push(
    sidebarCommand,
    refreshCommand,
    searchCommand,
    installFromURICommand,
    viewSkillCommand,
    statusBarItem
  );

  // Log activation info
  console.log('Skills Manager commands registered:');
  console.log('  - skills.showSidebar');
  console.log('  - skills.refresh');
  console.log('  - skills.search');
  console.log('  - skills.installFromURI');
  console.log('  - skills.viewSkill');
}

export function deactivate() {
  console.log('Skills VSCode extension is now deactivated!');

  // Dispose status bar item
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
