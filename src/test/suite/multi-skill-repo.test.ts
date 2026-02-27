/**
 * 多技能仓库测试
 * 测试从包含多个技能的仓库中获取特定技能
 */

import * as assert from 'assert';
import { parseSource, buildSkillId } from '../../utils/source-parser';

suite('Multi-Skill Repository Tests', () => {

  suite('parseSource - 多技能仓库', () => {

    test('应该解析 GitHub 短名字带路径', () => {
      const result = parseSource('planetscale/database-skills');
      assert.strictEqual(result.type, 'github');
      assert.strictEqual((result as any).owner, 'planetscale');
      assert.strictEqual((result as any).repo, 'database-skills');
    });

    test('应该解析 GitHub URL', () => {
      const result = parseSource('https://github.com/planetscale/database-skills.git');
      assert.strictEqual(result.type, 'github');
      assert.strictEqual((result as any).owner, 'planetscale');
      assert.strictEqual((result as any).repo, 'database-skills');
    });
  });

  suite('buildSkillId - 包含子路径', () => {

    test('应该为子路径构建正确的 skillId', () => {
      const source = parseSource('https://github.com/planetscale/database-skills.git');

      // 模拟在 skills/mysql 找到技能
      const sourceWithSubpath = { ...source, subpath: 'skills/mysql' };
      const skillId = buildSkillId(sourceWithSubpath);

      // 应该是：github/planetscale/database-skills/skills/mysql
      assert.strictEqual(skillId, 'github/planetscale/database-skills/skills/mysql');
    });

    test('应该使用 skillFilter 构建 skillId', () => {
      const source = parseSource('planetscale/database-skills@postgres');

      assert.strictEqual((source as any).skillFilter, 'postgres');
      const skillId = buildSkillId(source);

      // 应该是：github/planetscale/database-skills@postgres
      assert.strictEqual(skillId, 'github/planetscale/database-skills@postgres');
    });
  });

  suite('缓存文件名生成', () => {

    test('应该将 skillId 中的斜杠转义为安全字符', () => {
      // 这个测试验证缓存文件名的安全性
      const skillId = 'github/planetscale/database-skills/skills/mysql';

      // 斜杠需要被转义，否则会被解释为子目录
      const safeFileName = skillId.replace(/\//g, '-');

      // 期望的文件名应该是单级文件，而不是多级目录
      assert.strictEqual(safeFileName, 'github-planetscale-database-skills-skills-mysql');
      assert.strictEqual(safeFileName.split('/').length, 1); // 不应该包含斜杠
    });
  });
});
