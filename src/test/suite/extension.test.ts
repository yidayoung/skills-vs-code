import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('yidayoung.agent-skills-manager-pro'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('yidayoung.agent-skills-manager-pro');
    assert.ok(extension);
    await extension?.activate();
    assert.strictEqual(extension?.isActive, true);
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('skills.refresh'));
    assert.ok(commands.includes('skills.search'));
    assert.ok(commands.includes('skills.installFromURI'));
    assert.ok(commands.includes('skills.clearCache'));
  });
});
