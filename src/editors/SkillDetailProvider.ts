import * as vscode from 'vscode';
import { SkillCache } from '../managers/SkillCache';
import { APIClient } from '../managers/APIClient';

export class SkillDetailProvider {
  private static async openMarkdownInEditor(uri: vscode.Uri): Promise<void> {
    try {
      // Prefer VS Code's built-in Markdown preview/editor when available.
      await vscode.commands.executeCommand('markdown.showPreview', uri);
    } catch {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    }
  }

  /**
   * Show skill.md content in editor
   */
  static async show(
    skill: any,
    managers?: {
      skillCache: SkillCache;
      apiClient: APIClient;
    }
  ): Promise<void> {
    try {
      // For local skills - open the file directly
      if (skill.source?.type === 'local' && skill.source.skillMdPath) {
        const uri = vscode.Uri.file(skill.source.skillMdPath);
        await SkillDetailProvider.openMarkdownInEditor(uri);
        return; // Success, exit early
      }

      // For remote skills - try cache first, then fetch via repository clone
      if (skill.repository && skill.id && managers) {
        try {
          // 构建缓存 key（对于多技能仓库，需要包含子技能名称）
          const subSkillName = skill.skillId || skill.name;
          const fullSkillId = `${skill.id}@${subSkillName}`;
          const safeSkillId = fullSkillId.replace(/\//g, '-');

          // Try cache first with the correct key
          const cachedPath = await managers.skillCache.getCachedSkillMd(safeSkillId);
          if (cachedPath) {
            const uri = vscode.Uri.file(cachedPath);
            await SkillDetailProvider.openMarkdownInEditor(uri);
            return; // Success, exit early
          }

          // Not in cache, fetch by cloning repository
          console.log(`[SkillDetailProvider] Fetching skill: repository=${skill.repository}, id=${skill.id}, subSkill=${subSkillName}`);

          const cachedFilePath = await managers.apiClient.fetchRemoteSkillMd(
            skill.repository,
            skill.id,
            subSkillName  // Use skill.name as sub-skill identifier
          );

          const uri = vscode.Uri.file(cachedFilePath);
          await SkillDetailProvider.openMarkdownInEditor(uri);
          return; // Success, exit early
        } catch (error) {
          console.error(`Failed to fetch remote skill: ${error}`);
          // Fall through to show error message
        }
      }

      // Fallback: show basic info
      const fallbackContent = `# ${skill.name}\n\n${skill.description}\n\n*Full content not available. Repository: ${skill.repository || 'N/A'}*`;
      const doc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: fallbackContent
      });
      await vscode.window.showTextDocument(doc);
      vscode.window.showWarningMessage('Could not load full skill content');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show skill: ${error}`);
    }
  }
}
