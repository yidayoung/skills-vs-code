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
