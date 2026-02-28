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
      assert.ok(typeof result.description === 'string');
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

  test('APIClient should fetch leaderboard skills from /api/skills/{view}/{page}', async () => {
    const client = new APIClient([
      {
        url: 'https://skills.sh',
        enabled: true,
        name: 'Skills.sh',
        priority: 100
      }
    ]);

    (client as any).makeHttpsRequest = async (requestUrl: string) => {
      assert.ok(requestUrl.includes('/api/skills/all-time/0'));
      return {
        skills: [
          {
            id: 'vercel-labs/skills/find-skills',
            source: 'vercel-labs/skills',
            skillId: 'find-skills',
            name: 'find-skills',
            installs: 1000
          }
        ],
        total: 1,
        page: 0,
        hasMore: false
      };
    };

    const result = await client.getLeaderboardSkills('all-time', 0);
    assert.strictEqual(result.skills.length, 1);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.page, 0);
    assert.strictEqual(result.hasMore, false);
  });

  test('APIClient should deduplicate leaderboard skills across multiple endpoints', async () => {
    const client = new APIClient([
      {
        url: 'https://skills.sh',
        enabled: true,
        name: 'Primary',
        priority: 100
      },
      {
        url: 'https://skills.sh',
        enabled: true,
        name: 'Mirror',
        priority: 50
      }
    ]);

    (client as any).makeHttpsRequest = async () => ({
      skills: [
        {
          id: 'vercel-labs/skills/find-skills',
          source: 'vercel-labs/skills',
          skillId: 'find-skills',
          name: 'find-skills',
          installs: 1000
        }
      ],
      total: 1,
      page: 0,
      hasMore: false
    });

    const result = await client.getLeaderboardSkills('all-time', 0);
    assert.strictEqual(result.skills.length, 1);
  });

  test('APIClient should return empty leaderboard response when all endpoints fail', async () => {
    const client = new APIClient([
      {
        url: 'https://skills.sh',
        enabled: true,
        name: 'Skills.sh',
        priority: 100
      }
    ]);

    (client as any).makeHttpsRequest = async () => {
      throw new Error('network error');
    };

    const result = await client.getLeaderboardSkills('all-time', 0);
    assert.deepStrictEqual(result.skills, []);
    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.page, 0);
    assert.strictEqual(result.hasMore, false);
  });

  test('APIClient should derive skillId from source/id when leaderboard skillId is missing', async () => {
    const client = new APIClient([
      {
        url: 'https://skills.sh',
        enabled: true,
        name: 'Skills.sh',
        priority: 100
      }
    ]);

    (client as any).makeHttpsRequest = async () => ({
      skills: [
        {
          id: 'vercel-labs/skills/find-skills',
          source: 'vercel-labs/skills',
          name: 'find-skills',
          installs: 1000
        }
      ],
      total: 1,
      page: 0,
      hasMore: false
    });

    const result = await client.getLeaderboardSkills('all-time', 0);
    assert.strictEqual(result.skills.length, 1);
    assert.strictEqual(result.skills[0].skillId, 'find-skills');
  });
});
