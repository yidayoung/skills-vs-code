import * as assert from 'assert';
import * as vscode from 'vscode';
import { APIClient } from '../../managers/APIClient';
import { SkillManager } from '../../managers/SkillManager';

// Mock WebviewPanel
class MockWebviewPanel {
  public webview = {
    postMessage: () => {},
    onDidReceiveMessage: () => {}
  };
  public disposed = false;
  public dispose() {
    this.disposed = true;
  }
}

suite('Message Handlers Integration Tests Suite', () => {
  let mockPanel: any;

  setup(() => {
    mockPanel = new MockWebviewPanel();
  });

  test('APIClient search should return valid structure', async () => {
    const apiClient = new APIClient([
      {
        url: 'https://api.skills.sh/search',
        enabled: true,
        name: 'Test API',
        priority: 100
      }
    ]);

    const results = await apiClient.searchSkills('git');

    // Verify results are array
    assert.ok(Array.isArray(results));

    // Verify result structure
    if (results.length > 0) {
      const result = results[0];
      assert.ok(result.id || result.name);
    }
  });

  test('SkillManager should list installed skills', async () => {
    const skillManager = new SkillManager(
      (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0])?.uri.fsPath,
      '/tmp/test-global-storage'
    );

    const skills = await skillManager.listInstalledSkills();

    // Should return array
    assert.ok(Array.isArray(skills));
  });

  test('Search with special characters should not crash', async () => {
    const apiClient = new APIClient([
      {
        url: 'https://api.skills.sh/search',
        enabled: true,
        name: 'Test API',
        priority: 100
      }
    ]);

    // Test various special characters
    const queries = ['c++', 'node.js', 'git-flow', 'test@123'];

    for (const query of queries) {
      try {
        const results = await apiClient.searchSkills(query);
        assert.ok(Array.isArray(results));
      } catch (error) {
        // Should not throw, but if it does, test should fail
        assert.fail(`Search failed for query: ${query}`);
      }
    }
  });

  test('Multiple API clients should deduplicate results', async () => {
    const multiUrlClient = new APIClient([
      {
        url: 'https://api.skills.sh/search',
        enabled: true,
        name: 'API 1',
        priority: 100
      },
      {
        url: 'https://api.skills.sh/search',
        enabled: true,
        name: 'API 2',
        priority: 50
      }
    ]);

    const results = await multiUrlClient.searchSkills('test');

    // Verify no duplicates by ID
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length);
  });

  test('Disabled APIs should be skipped', async () => {
    const disabledClient = new APIClient([
      {
        url: 'https://api.skills.sh/search',
        enabled: false,
        name: 'Disabled API',
        priority: 100
      }
    ]);

    const results = await disabledClient.searchSkills('test');

    // Should return empty array since all APIs are disabled
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
  });
});
