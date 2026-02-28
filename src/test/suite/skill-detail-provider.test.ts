import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { SkillDetailProvider } from '../../editors/SkillDetailProvider';
import { SkillCache } from '../../managers/SkillCache';
import { APIClient } from '../../managers/APIClient';

suite('SkillDetailProvider Tests Suite', () => {
  let context: vscode.ExtensionContext;
  let skillCache: SkillCache;
  let apiClient: APIClient;
  let tempDir: string;

  suiteSetup(async () => {
    // 获取测试用的 context
    const extension = vscode.extensions.getExtension('yidayoung.agent-skills-manager-pro');
    await extension?.activate();
    context = (global as any).testExtensionContext;

    // 初始化 managers
    skillCache = new SkillCache(context);
    apiClient = new APIClient([]);

    // 创建临时目录用于本地测试
    tempDir = path.join(os.tmpdir(), `skill-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  // 辅助方法：创建一个过期的缓存条目
  async function setExpiredCache(url: string, content: string): Promise<void> {
    const cacheKey = `skill_cache_1_${Buffer.from(url).toString('base64').replace(/[/+=]/g, '')}`;
    const expiredTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8天前

    await context.globalState.update(cacheKey, {
      url,
      content,
      timestamp: expiredTimestamp,
      size: content.length
    });
  }

  suiteTeardown(async () => {
    // 清理临时文件
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await skillCache.clear();
  });

  test('SkillDetailProvider should be imported', () => {
    assert.ok(SkillDetailProvider, 'SkillDetailProvider should be imported');
  });

  test('should open local skill file', async () => {
    // 准备测试数据
    const skillName = 'test-local-skill';
    const skillContent = `# ${skillName}\n\nThis is a test skill.\n\n## Usage\n\nTest usage here.`;
    const skillMdPath = path.join(tempDir, 'SKILL.md');

    // 创建本地 SKILL.md 文件
    await fs.writeFile(skillMdPath, skillContent);

    // 构造本地 skill 对象
    const localSkill = {
      id: skillName,
      name: skillName,
      description: 'A local test skill',
      source: {
        type: 'local' as const,
        skillMdPath: skillMdPath
      },
      hasUpdate: false
    };

    // 调用 SkillDetailProvider.show
    await SkillDetailProvider.show(localSkill, { skillCache, apiClient });

    // 验证：检查当前活动的文本编辑器
    const activeEditor = vscode.window.activeTextEditor;
    assert.ok(activeEditor, '应该打开一个文本编辑器');
    assert.strictEqual(
      activeEditor.document.uri.fsPath,
      skillMdPath,
      '应该打开正确的本地文件'
    );

    // 验证内容
    const documentContent = activeEditor.document.getText();
    assert.strictEqual(documentContent, skillContent, '内容应该匹配');

    // 清理：关闭所有编辑器
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should open installed remote skill from local SKILL.md path', async () => {
    const skillName = 'test-installed-remote-skill';
    const skillContent = `# ${skillName}\n\nInstalled from remote but should open local file.`;
    const skillMdPath = path.join(tempDir, 'remote-installed-SKILL.md');

    await fs.writeFile(skillMdPath, skillContent);

    const installedRemoteSkill = {
      id: skillName,
      name: skillName,
      description: 'Installed remote skill',
      source: {
        type: 'remote' as const,
        repository: 'https://github.com/example/skill-repo',
        skillMdPath
      },
      hasUpdate: false
    };

    await SkillDetailProvider.show(installedRemoteSkill, { skillCache, apiClient }, { openMode: 'direct' });

    const activeEditor = vscode.window.activeTextEditor;
    assert.ok(activeEditor, '应该打开一个文本编辑器');
    assert.strictEqual(
      activeEditor.document.uri.fsPath,
      skillMdPath,
      '已安装的远程技能应该直接打开本地 SKILL.md'
    );

    const documentContent = activeEditor.document.getText();
    assert.strictEqual(documentContent, skillContent, '内容应该匹配本地文件');

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should open local skill file directly without markdown preview command in direct mode', async () => {
    const skillName = 'test-local-direct-open';
    const skillContent = `# ${skillName}\n\nOpen directly in text editor.`;
    const skillMdPath = path.join(tempDir, `${skillName}.md`);
    await fs.writeFile(skillMdPath, skillContent);

    const localSkill = {
      id: skillName,
      name: skillName,
      description: 'Local direct-open test skill',
      source: {
        type: 'local' as const,
        skillMdPath
      },
      hasUpdate: false
    };

    const originalExecuteCommand = vscode.commands.executeCommand;
    let markdownPreviewCalled = false;

    (vscode.commands as any).executeCommand = async (command: string, ...args: any[]) => {
      if (command === 'markdown.showPreview') {
        markdownPreviewCalled = true;
      }
      return originalExecuteCommand.call(vscode.commands, command as any, ...args);
    };

    try {
      await SkillDetailProvider.show(localSkill, { skillCache, apiClient }, { openMode: 'direct' });

      const activeEditor = vscode.window.activeTextEditor;
      assert.ok(activeEditor, '应该打开一个文本编辑器');
      assert.strictEqual(
        activeEditor.document.uri.fsPath,
        skillMdPath,
        '应该直接打开本地文档'
      );
      assert.strictEqual(markdownPreviewCalled, false, '本地技能不应触发 markdown.showPreview');
    } finally {
      (vscode.commands as any).executeCommand = originalExecuteCommand;
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }
  });

  test('should request markdown preview for local skill in preview mode', async () => {
    const skillName = 'test-local-preview-open';
    const skillContent = `# ${skillName}\n\nOpen in markdown preview.`;
    const skillMdPath = path.join(tempDir, `${skillName}.md`);
    await fs.writeFile(skillMdPath, skillContent);

    const localSkill = {
      id: skillName,
      name: skillName,
      description: 'Local preview-open test skill',
      source: {
        type: 'local' as const,
        skillMdPath
      },
      hasUpdate: false
    };

    const originalExecuteCommand = vscode.commands.executeCommand;
    let markdownPreviewCalled = false;

    (vscode.commands as any).executeCommand = async (command: string, ...args: any[]) => {
      if (command === 'markdown.showPreview') {
        markdownPreviewCalled = true;
      }
      return originalExecuteCommand.call(vscode.commands, command as any, ...args);
    };

    try {
      await SkillDetailProvider.show(localSkill, { skillCache, apiClient }, { openMode: 'preview' });
      assert.strictEqual(markdownPreviewCalled, true, '预览模式应触发 markdown.showPreview');
    } finally {
      (vscode.commands as any).executeCommand = originalExecuteCommand;
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }
  });

  test('should fetch remote skill when cache misses', async function() {
    this.timeout(10000); // 网络请求可能需要更长时间

    // 使用真实的公开技能仓库
    const remoteSkill = {
      id: 'anthropic-ai-skills',
      name: 'Anthropic AI Skills',
      description: 'Official Anthropic skills repository',
      repository: 'https://github.com/anthropics/anthropic-ai-skills',
      skillMdUrl: 'https://raw.githubusercontent.com/anthropics/anthropic-ai-skills/HEAD/SKILL.md'
    };

    // 确保缓存为空
    await skillCache.invalidateCache(remoteSkill.skillMdUrl);

    // 调用 SkillDetailProvider.show
    await SkillDetailProvider.show(remoteSkill, { skillCache, apiClient });

    // 验证：文档被打开
    const activeEditor = vscode.window.activeTextEditor;
    assert.ok(activeEditor, '应该打开一个文本编辑器');

    // 验证：内容不为空
    const content = activeEditor.document.getText();
    assert.ok(content.length > 0, '应该有内容');
    assert.ok(content.includes('#'), '应该是 Markdown 格式');

    // 验证：内容被缓存
    const cachedContent = await skillCache.getCachedSkill(remoteSkill.skillMdUrl);
    assert.ok(cachedContent, '应该被缓存');
    assert.strictEqual(cachedContent, content, '缓存内容应该匹配');

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('should use cached remote skill', async function() {
    // 准备：预先填充缓存
    const testUrl = 'https://example.com/test-cached-skill.md';
    const testContent = `# Cached Skill\n\nThis content is from cache.`;

    await skillCache.setCachedSkill(testUrl, testContent);

    // 验证缓存已设置
    const beforeCache = await skillCache.getCachedSkill(testUrl);
    assert.strictEqual(beforeCache, testContent, '缓存应该被正确设置');

    // 构造 skill 对象
    const cachedSkill = {
      id: 'cached-skill',
      name: 'Cached Skill',
      description: 'A skill from cache',
      repository: testUrl,
      skillMdUrl: testUrl
    };

    // 调用 SkillDetailProvider.show
    await SkillDetailProvider.show(cachedSkill, { skillCache, apiClient });

    // 验证：文档被打开
    const activeEditor = vscode.window.activeTextEditor;
    assert.ok(activeEditor, '应该打开一个文本编辑器');

    // 验证：内容来自缓存
    const content = activeEditor.document.getText();
    assert.strictEqual(content, testContent, '应该使用缓存内容');

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await skillCache.invalidateCache(testUrl);
  });

  test('should refetch when cache is expired', async function() {
    this.timeout(10000);

    // 使用真实的公开技能仓库
    const testUrl = 'https://raw.githubusercontent.com/anthropics/anthropic-ai-skills/HEAD/SKILL.md';
    const expiredContent = '# Expired Content\n\nThis is old.';

    // 设置过期缓存
    await setExpiredCache(testUrl, expiredContent);

    // 验证过期缓存存在但已过期
    const cachedBefore = await skillCache.getCachedSkill(testUrl);
    assert.strictEqual(cachedBefore, null, '过期缓存应该返回 null');

    // 构造 skill 对象
    const remoteSkill = {
      id: 'anthropic-ai-skills-expired',
      name: 'Anthropic AI Skills',
      description: 'Test expired cache',
      repository: testUrl,
      skillMdUrl: testUrl
    };

    // 调用 SkillDetailProvider.show
    await SkillDetailProvider.show(remoteSkill, { skillCache, apiClient });

    // 验证：新内容被拉取
    const activeEditor = vscode.window.activeTextEditor;
    assert.ok(activeEditor, '应该打开一个文本编辑器');

    const content = activeEditor.document.getText();
    assert.notStrictEqual(content, expiredContent, '不应该使用过期内容');

    // 清理
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await skillCache.invalidateCache(testUrl);
  });
});
