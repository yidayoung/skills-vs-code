import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { SkillCache } from '../managers/SkillCache';
import { APIClient } from '../managers/APIClient';

export class SkillDetailProvider {
  /**
   * Show skill.md content in editor
   */
  static async show(
    context: vscode.ExtensionContext,
    skill: any,
    managers?: {
      skillCache: SkillCache;
      apiClient: APIClient;
    }
  ): Promise<void> {
    let content: string | null = null;

    try {
      // For local skills
      if (skill.source?.type === 'local' && skill.source.localPath) {
        const skillMdPath = path.join(skill.source.localPath, 'SKILL.md');
        content = await fs.readFile(skillMdPath, 'utf-8');
      } else if (skill.skillMdUrl && managers) {
        // For remote skills - try cache first
        content = await managers.skillCache.getCachedSkill(skill.skillMdUrl);

        // If not in cache, fetch from API
        if (!content) {
          content = await managers.apiClient.fetchSkillMd(skill.skillMdUrl);

          // Cache the content
          if (content) {
            await managers.skillCache.setCachedSkill(skill.skillMdUrl, content);
          }
        }
      }

      // If we have content, show it
      if (content) {
        const doc = await vscode.workspace.openTextDocument({
          language: 'markdown',
          content
        });
        await vscode.window.showTextDocument(doc);
      } else {
        // Fallback: show basic info
        const fallbackContent = `# ${skill.name}\n\n${skill.description}\n\n*Full content not available. Repository: ${skill.repository || 'N/A'}*`;
        const doc = await vscode.workspace.openTextDocument({
          language: 'markdown',
          content: fallbackContent
        });
        await vscode.window.showTextDocument(doc);
        vscode.window.showWarningMessage('Could not load full skill content');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show skill: ${error}`);
    }
  }
}
