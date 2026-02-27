import * as vscode from 'vscode';
import { SkillCache } from '../managers/SkillCache';
import { APIClient } from '../managers/APIClient';

export class SkillDetailProvider {
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
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        return; // Success, exit early
      }

      // For remote skills - try cache first, then fetch via repository clone
      if (skill.repository && skill.id && managers) {
        try {
          // Try cache first
          const cachedPath = await managers.skillCache.getCachedSkillMd(skill.id);
          if (cachedPath) {
            const uri = vscode.Uri.file(cachedPath);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
            return; // Success, exit early
          }

          // Not in cache, fetch by cloning repository
          const cachedFilePath = await managers.apiClient.fetchRemoteSkillMd(
            skill.repository,
            skill.id
          );

          const uri = vscode.Uri.file(cachedFilePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc);
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
