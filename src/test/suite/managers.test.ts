import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
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

  test('SkillManager should install single discovered skill without selection prompt', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-single-'));
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const repoRoot = path.join(tempRoot, 'repo');
    const singleSkillDir = path.join(repoRoot, '.claude', 'skills', 'ui-ux-pro-max');
    const skillMdPath = path.join(singleSkillDir, 'SKILL.md');

    await fs.mkdir(workspaceRoot, { recursive: true });
    await fs.mkdir(singleSkillDir, { recursive: true });
    await fs.writeFile(
      skillMdPath,
      `---
name: ui-ux-pro-max
description: UI/UX skill
---

# ui-ux-pro-max
`,
      'utf-8'
    );

    const originalShowQuickPick = vscode.window.showQuickPick;
    const showQuickPickStub = async () => {
      throw new Error('showQuickPick should not be called for single skill');
    };
    (vscode.window as any).showQuickPick = showQuickPickStub;

    try {
      const skillManager = new SkillManager(workspaceRoot, '/tmp/test-global-storage');

      await (skillManager as any).installFromPath(repoRoot, [], 'project', workspaceRoot);

      const installedSkill = path.join(workspaceRoot, '.agents', 'skills', 'ui-ux-pro-max', 'SKILL.md');
      await fs.access(installedSkill);
    } finally {
      (vscode.window as any).showQuickPick = originalShowQuickPick;
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  test('SkillManager should persist resolved sub-skill path into source metadata for auto-discovered installs', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-source-path-'));
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const repoRoot = path.join(tempRoot, 'repo');
    const singleSkillDir = path.join(repoRoot, 'skills', 'find-skills');
    const skillMdPath = path.join(singleSkillDir, 'SKILL.md');

    await fs.mkdir(workspaceRoot, { recursive: true });
    await fs.mkdir(singleSkillDir, { recursive: true });
    await fs.writeFile(
      skillMdPath,
      `---
name: find-skills
description: Search skills
---

# find-skills
`,
      'utf-8'
    );

    try {
      const skillManager = new SkillManager(workspaceRoot, '/tmp/test-global-storage');

      await (skillManager as any).installFromPath(
        repoRoot,
        [],
        'project',
        workspaceRoot,
        {
          sourceType: 'github',
          sourceUrl: 'https://github.com/vercel-labs/skills.git',
          repository: 'https://github.com/vercel-labs/skills.git',
          ownerRepo: 'vercel-labs/skills',
          skillPath: 'SKILL.md'
        }
      );

      const sourceMetadataPath = path.join(
        workspaceRoot,
        '.agents',
        'skills',
        'find-skills',
        '.skill-source.json'
      );
      const sourceMetadataRaw = await fs.readFile(sourceMetadataPath, 'utf-8');
      const sourceMetadata = JSON.parse(sourceMetadataRaw);

      assert.strictEqual(
        sourceMetadata.skillPath,
        'skills/find-skills/SKILL.md',
        'auto-discovered single skill should persist its resolved relative path'
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  test('SkillManager should expose source.skillId from metadata when listing installed skills', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-source-skillid-'));
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const installedSkillDir = path.join(workspaceRoot, '.agents', 'skills', 'demo-skill');
    const skillMdPath = path.join(installedSkillDir, 'SKILL.md');
    const sourceMetadataPath = path.join(installedSkillDir, '.skill-source.json');
    const expectedSkillId = 'find-skills';

    await fs.mkdir(installedSkillDir, { recursive: true });
    await fs.writeFile(
      skillMdPath,
      `---
name: demo-skill
description: Demo Skill
---

# demo-skill
`,
      'utf-8'
    );

    await fs.writeFile(
      sourceMetadataPath,
      JSON.stringify({
        sourceType: 'github',
        sourceUrl: 'https://github.com/vercel-labs/skills.git',
        repository: 'https://github.com/vercel-labs/skills.git',
        ownerRepo: 'vercel-labs/skills',
        skillPath: `skills/${expectedSkillId}/SKILL.md`,
        skillId: expectedSkillId,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, null, 2),
      'utf-8'
    );

    try {
      const skillManager = new SkillManager(workspaceRoot, '/tmp/test-global-storage');
      const skills = await skillManager.listInstalledSkills({ global: false, agentFilter: [] });
      const target = skills.find(s => s.name === 'demo-skill');

      assert.ok(target, '应该找到 demo-skill');
      assert.strictEqual(
        target?.source?.skillId,
        expectedSkillId,
        '已安装技能应从 metadata 暴露 source.skillId'
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  test('SkillManager should derive source.skillId from legacy metadata skillPath', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-source-legacy-skillid-'));
    const workspaceRoot = path.join(tempRoot, 'workspace');
    const installedSkillDir = path.join(workspaceRoot, '.agents', 'skills', 'legacy-demo-skill');
    const skillMdPath = path.join(installedSkillDir, 'SKILL.md');
    const sourceMetadataPath = path.join(installedSkillDir, '.skill-source.json');
    const expectedSkillId = 'legacy-skill-id';

    await fs.mkdir(installedSkillDir, { recursive: true });
    await fs.writeFile(
      skillMdPath,
      `---
name: legacy-demo-skill
description: Legacy Demo Skill
---

# legacy-demo-skill
`,
      'utf-8'
    );

    await fs.writeFile(
      sourceMetadataPath,
      JSON.stringify({
        sourceType: 'github',
        sourceUrl: 'https://github.com/vercel-labs/skills.git',
        repository: 'https://github.com/vercel-labs/skills.git',
        ownerRepo: 'vercel-labs/skills',
        skillPath: `skills/${expectedSkillId}/SKILL.md`,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, null, 2),
      'utf-8'
    );

    try {
      const skillManager = new SkillManager(workspaceRoot, '/tmp/test-global-storage');
      const skills = await skillManager.listInstalledSkills({ global: false, agentFilter: [] });
      const target = skills.find(s => s.name === 'legacy-demo-skill');

      assert.ok(target, '应该找到 legacy-demo-skill');
      assert.strictEqual(
        target?.source?.skillId,
        expectedSkillId,
        '旧 metadata 应可从 skillPath 推导出 source.skillId'
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
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
