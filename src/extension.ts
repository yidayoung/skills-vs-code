import * as vscode from 'vscode';
import { SkillSidebarProvider } from './webview/SkillSidebarProvider';
import { SkillDetailProvider } from './editors/SkillDetailProvider';

export { UserPreferences } from './managers/UserPreferences';

export function activate(context: vscode.ExtensionContext) {
  console.log('Skills VSCode extension is now active!');

  // Register sidebar command
  const sidebarCommand = vscode.commands.registerCommand(
    'skills.showSidebar',
    () => {
      SkillSidebarProvider.show(context);
    }
  );

  // Register view skill command
  const viewSkillCommand = vscode.commands.registerCommand(
    'skills.viewSkill',
    async (skill) => {
      await SkillDetailProvider.show(skill);
    }
  );

  context.subscriptions.push(sidebarCommand, viewSkillCommand);
}

export function deactivate() {}
