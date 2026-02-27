import * as assert from 'assert';
import * as vscode from 'vscode';
import { UserPreferences } from '../../managers/UserPreferences';
import { SkillManager } from '../../managers/SkillManager';
import { SkillCache } from '../../managers/SkillCache';

suite('Manager Tests Suite', () => {
  let context: vscode.ExtensionContext;

  suiteSetup(async () => {
    // Activate extension
    const extension = vscode.extensions.getExtension('yidayoung.agent-skills-manager-pro');
    await extension?.activate();
    context = (global as any).testExtensionContext;
  });

  test('UserPreferences should store and retrieve values', async () => {
    const prefs = new UserPreferences(context);

    await prefs.setDefaultAgents(['claude-code', 'cursor']);
    const agents = await prefs.getDefaultAgents();
    assert.deepStrictEqual(agents, ['claude-code', 'cursor']);

    await prefs.setDefaultScope('project');
    const scope = await prefs.getDefaultScope();
    assert.strictEqual(scope, 'project');
  });

  test('SkillManager should list skills', async () => {
    const skillManager = new SkillManager(
      (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath,
      context.globalStorageUri.fsPath
    );

    const skills = await skillManager.listInstalledSkills();
    assert.ok(Array.isArray(skills));
  });

  test('SkillCache should cache and retrieve skills', async () => {
    const cache = new SkillCache(context);

    const testUrl = 'https://example.com/skill/test';
    const testContent = '# Test Skill';

    await cache.setCachedSkill(testUrl, testContent);
    const retrieved = await cache.getCachedSkill(testUrl);

    assert.ok(retrieved);
    assert.strictEqual(retrieved, testContent);
  });

  suiteTeardown(async () => {
    // Cleanup
    const cache = new SkillCache(context);
    await cache.clear();
  });
});
