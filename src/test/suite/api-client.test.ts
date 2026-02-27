import * as assert from 'assert';
import * as vscode from 'vscode';
import { APIClient } from '../../managers/APIClient';

suite('APIClient Tests Suite', () => {
  let apiClient: APIClient;

  suiteSetup(() => {
    const apiUrls = [
      {
        url: 'https://api.skills.sh/search',
        enabled: true,
        name: 'Skills.sh',
        priority: 100
      }
    ];
    apiClient = new APIClient(apiUrls);
  });

  test('APIClient should initialize with API URLs', () => {
    assert.ok(apiClient);
  });

  test('APIClient should search skills', async () => {
    const results = await apiClient.searchSkills('git');

    assert.ok(Array.isArray(results));
    // Note: Results depend on actual API, just verify structure
    results.forEach(result => {
      assert.ok(result.id);
      assert.ok(result.name);
      assert.ok(result.description);
    });
  });

  test('APIClient should handle empty search query', async () => {
    const results = await apiClient.searchSkills('');

    // Should return empty results or all skills depending on API
    assert.ok(Array.isArray(results));
  });

  test('APIClient should handle special characters', async () => {
    const results = await apiClient.searchSkills('c++');

    assert.ok(Array.isArray(results));
  });

  test('APIClient should deduplicate results from multiple APIs', async () => {
    const multiUrlClient = new APIClient([
      {
        url: 'https://api.skills.sh/search',
        enabled: true,
        name: 'Skills.sh',
        priority: 100
      },
      {
        url: 'https://api.skills.sh/search',
        enabled: true,
        name: 'Skills.sh Mirror',
        priority: 50
      }
    ]);

    const results = await multiUrlClient.searchSkills('test');

    assert.ok(Array.isArray(results));
    // Verify no duplicates
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length);
  });

  test('APIClient should handle API errors gracefully', async () => {
    const badClient = new APIClient([
      {
        url: 'https://invalid-url-that-does-not-exist.com/search',
        enabled: true,
        name: 'Bad API',
        priority: 100
      }
    ]);

    try {
      const results = await badClient.searchSkills('test');
      // Should either throw error or return empty results
      assert.ok(Array.isArray(results));
    } catch (error) {
      // Expected to throw
      assert.ok(error);
    }
  });

  test('APIClient should respect enabled flag', async () => {
    const disabledClient = new APIClient([
      {
        url: 'https://api.skills.sh/search',
        enabled: false,
        name: 'Disabled API',
        priority: 100
      }
    ]);

    const results = await disabledClient.searchSkills('test');

    // Should return empty results since all APIs are disabled
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
  });
});
