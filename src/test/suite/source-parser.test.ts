/**
 * Source Parser 单元测试
 * 测试各种 source 格式的解析
 */

import * as assert from 'assert';
import {
  parseSource,
  buildSkillId,
  parseSkillId,
  buildRepositoryUrlFromSkillId,
  normalizeRepositoryUrl,
  getOwnerRepo,
  parseOwnerRepo
} from '../../utils/source-parser';
import type { GitHubSource, GitLabSource, LocalSource } from '../../utils/source-types';

suite('Source Parser Tests', () => {

  suite('parseSource - GitHub', () => {

    test('应该解析 GitHub 短名字 (owner/repo)', () => {
      const result = parseSource('anthropics/claude-code');
      assert.strictEqual(result.type, 'github');
      const github = result as GitHubSource;
      assert.strictEqual(github.owner, 'anthropics');
      assert.strictEqual(github.repo, 'claude-code');
      assert.strictEqual(github.url, 'https://github.com/anthropics/claude-code.git');
    });

    test('应该解析 GitHub 短名字带路径 (owner/repo/path)', () => {
      const result = parseSource('anthropics/claude-code/skills/test');
      assert.strictEqual(result.type, 'github');
      const github = result as GitHubSource;
      assert.strictEqual(github.owner, 'anthropics');
      assert.strictEqual(github.repo, 'claude-code');
      assert.strictEqual(github.subpath, 'skills/test');
    });

    test('应该解析 GitHub @skill 语法 (owner/repo@skill)', () => {
      const result = parseSource('anthropics/claude-code@test-skill');
      assert.strictEqual(result.type, 'github');
      const github = result as GitHubSource;
      assert.strictEqual(github.owner, 'anthropics');
      assert.strictEqual(github.repo, 'claude-code');
      assert.strictEqual(github.skillFilter, 'test-skill');
    });

    test('应该解析 GitHub URL', () => {
      const result = parseSource('https://github.com/anthropics/claude-code');
      assert.strictEqual(result.type, 'github');
      const github = result as GitHubSource;
      assert.strictEqual(github.owner, 'anthropics');
      assert.strictEqual(github.repo, 'claude-code');
      assert.strictEqual(github.url, 'https://github.com/anthropics/claude-code.git');
    });

    test('应该解析 GitHub URL 带分支', () => {
      const result = parseSource('https://github.com/anthropics/claude-code/tree/main');
      assert.strictEqual(result.type, 'github');
      const github = result as GitHubSource;
      assert.strictEqual(github.owner, 'anthropics');
      assert.strictEqual(github.repo, 'claude-code');
      assert.strictEqual(github.ref, 'main');
    });

    test('应该解析 GitHub URL 带路径和分支', () => {
      const result = parseSource('https://github.com/anthropics/claude-code/tree/main/skills/test');
      assert.strictEqual(result.type, 'github');
      const github = result as GitHubSource;
      assert.strictEqual(github.owner, 'anthropics');
      assert.strictEqual(github.repo, 'claude-code');
      assert.strictEqual(github.ref, 'main');
      assert.strictEqual(github.subpath, 'skills/test');
    });
  });

  suite('parseSource - GitLab', () => {

    test('应该解析 GitLab.com 短名字', () => {
      const result = parseSource('gitlab.com/owner/repo');
      assert.strictEqual(result.type, 'gitlab');
      const gitlab = result as GitLabSource;
      assert.strictEqual(gitlab.hostname, 'gitlab.com');
      assert.strictEqual(gitlab.repoPath, 'owner/repo');
      assert.strictEqual(gitlab.url, 'https://gitlab.com/owner/repo.git');
    });

    test('应该解析 GitLab.com 短名字带子组', () => {
      const result = parseSource('gitlab.com/group/subgroup/repo');
      assert.strictEqual(result.type, 'gitlab');
      const gitlab = result as GitLabSource;
      assert.strictEqual(gitlab.hostname, 'gitlab.com');
      assert.strictEqual(gitlab.repoPath, 'group/subgroup/repo');
    });

    test('应该解析 GitLab URL', () => {
      const result = parseSource('https://gitlab.com/owner/repo');
      assert.strictEqual(result.type, 'gitlab');
      const gitlab = result as GitLabSource;
      assert.strictEqual(gitlab.hostname, 'gitlab.com');
      assert.strictEqual(gitlab.repoPath, 'owner/repo');
    });

    test('应该解析 GitLab 私有实例', () => {
      const result = parseSource('https://gitlab.example.com/owner/repo');
      assert.strictEqual(result.type, 'gitlab');
      const gitlab = result as GitLabSource;
      assert.strictEqual(gitlab.hostname, 'gitlab.example.com');
      assert.strictEqual(gitlab.repoPath, 'owner/repo');
    });
  });

  suite('parseSource - Local Path', () => {

    test('应该解析绝对路径', () => {
      const result = parseSource('/Users/test/skills');
      assert.strictEqual(result.type, 'local');
      const local = result as LocalSource;
      assert.strictEqual(local.localPath, '/Users/test/skills');
    });

    test('应该解析相对路径', () => {
      const result = parseSource('./skills');
      assert.strictEqual(result.type, 'local');
      const local = result as LocalSource;
      assert.ok(local.localPath.endsWith('skills'));
    });

    test('应该解析当前目录', () => {
      const result = parseSource('.');
      assert.strictEqual(result.type, 'local');
    });
  });

  suite('normalizeRepositoryUrl', () => {

    test('应该规范化 GitHub 短名字', () => {
      const result = normalizeRepositoryUrl('anthropics/claude-code');
      assert.strictEqual(result, 'https://github.com/anthropics/claude-code.git');
    });

    test('应该规范化 GitLab 短名字', () => {
      const result = normalizeRepositoryUrl('gitlab.com/owner/repo');
      assert.strictEqual(result, 'https://gitlab.com/owner/repo.git');
    });

    test('应该规范化完整 URL（无 .git）', () => {
      const result = normalizeRepositoryUrl('https://github.com/anthropics/claude-code');
      assert.strictEqual(result, 'https://github.com/anthropics/claude-code.git');
    });

    test('应该保持已有 .git 后缀', () => {
      const result = normalizeRepositoryUrl('https://github.com/anthropics/claude-code.git');
      assert.strictEqual(result, 'https://github.com/anthropics/claude-code.git');
    });

    test('应该处理无效输入', () => {
      const result = normalizeRepositoryUrl('not-a-valid-url');
      assert.strictEqual(result, 'not-a-valid-url');
    });
  });

  suite('getOwnerRepo', () => {

    test('应该从 GitHub source 提取 owner/repo', () => {
      const source = parseSource('anthropics/claude-code');
      const result = getOwnerRepo(source);
      assert.strictEqual(result, 'anthropics/claude-code');
    });

    test('应该从 GitLab source 提取 repoPath', () => {
      const source = parseSource('gitlab.com/group/subgroup/repo');
      const result = getOwnerRepo(source);
      assert.strictEqual(result, 'group/subgroup/repo');
    });

    test('应该对本地路径返回 null', () => {
      const source = parseSource('/Users/test/skills');
      const result = getOwnerRepo(source);
      assert.strictEqual(result, null);
    });
  });

  suite('parseOwnerRepo', () => {

    test('应该解析有效的 owner/repo', () => {
      const result = parseOwnerRepo('anthropics/claude-code');
      assert.deepStrictEqual(result, { owner: 'anthropics', repo: 'claude-code' });
    });

    test('应该对无效格式返回 null', () => {
      assert.strictEqual(parseOwnerRepo('invalid'), null);
      assert.strictEqual(parseOwnerRepo('invalid/'), null);
      assert.strictEqual(parseOwnerRepo('/repo'), null);
    });
  });

  suite('buildSkillId', () => {

    test('应该为 GitHub 构建 skillId', () => {
      const source = parseSource('anthropics/claude-code');
      const skillId = buildSkillId(source);
      assert.strictEqual(skillId, 'github/anthropics/claude-code');
    });

    test('应该为 GitHub 带子路径构建 skillId', () => {
      const source = parseSource('anthropics/claude-code/skills/test');
      const skillId = buildSkillId(source);
      assert.strictEqual(skillId, 'github/anthropics/claude-code/skills/test');
    });

    test('应该为 GitHub 带 skillFilter 构建 skillId', () => {
      const source = parseSource('anthropics/claude-code@test');
      const skillId = buildSkillId(source);
      assert.strictEqual(skillId, 'github/anthropics/claude-code@test');
    });
  });

  suite('parseSkillId', () => {

    test('应该解析基本 GitHub skillId', () => {
      const result = parseSkillId('github/anthropics/claude-code');
      assert.deepStrictEqual(result, {
        type: 'github',
        repoPath: 'anthropics/claude-code'
      });
    });

    test('应该解析带子路径的 GitHub skillId', () => {
      const result = parseSkillId('github/anthropics/claude-code/skills/test');
      assert.deepStrictEqual(result, {
        type: 'github',
        repoPath: 'anthropics/claude-code',
        subpath: 'skills/test'
      });
    });

    test('应该解析带 @skill 的 GitHub skillId', () => {
      const result = parseSkillId('github/anthropics/claude-code@test');
      assert.deepStrictEqual(result, {
        type: 'github',
        repoPath: 'anthropics/claude-code',
        skillName: 'test'
      });
    });

    test('应该对无效 skillId 返回 null', () => {
      assert.strictEqual(parseSkillId('invalid'), null);
      assert.strictEqual(parseSkillId(''), null);
    });
  });

  suite('buildRepositoryUrlFromSkillId', () => {

    test('应该从 GitHub skillId 构建仓库 URL', () => {
      const result = buildRepositoryUrlFromSkillId('github/anthropics/claude-code');
      assert.strictEqual(result, 'https://github.com/anthropics/claude-code.git');
    });

    test('应该从 GitLab skillId 构建仓库 URL', () => {
      const result = buildRepositoryUrlFromSkillId('gitlab/gitlab.com/owner/repo');
      assert.strictEqual(result, 'https://gitlab.com/owner/repo.git');
    });

    test('应该对本地 skillId 返回 null', () => {
      const result = buildRepositoryUrlFromSkillId('local/some_path');
      assert.strictEqual(result, null);
    });
  });
});
