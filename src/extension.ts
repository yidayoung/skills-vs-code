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
