import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('your-publisher-name.skills-vscode'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('your-publisher-name.skills-vscode');
    assert.ok(extension);
    await extension?.activate();
    assert.strictEqual(extension?.isActive, true);
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('skills.showSidebar'));
    assert.ok(commands.includes('skills.refresh'));
    assert.ok(commands.includes('skills.search'));
    assert.ok(commands.includes('skills.installFromURI'));
  });
});
