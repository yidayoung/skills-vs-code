import * as vscode from 'vscode';
import * as path from 'path';

export class SkillDetailProvider {
  /**
   * Show skill.md content in editor
   */
  static async show(skill: any): Promise<void> {
    // For local skills
    if (skill.source?.localPath) {
      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.file(skill.source.skillMdPath)
      );
      await vscode.window.showTextDocument(doc);
    } else {
      // For remote skills - fetch and show in untitled document
      const content = `# ${skill.name}\n\n${skill.description}\n\nTODO: Fetch full content from cache/API`;
      const doc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content
      });
      await vscode.window.showTextDocument(doc);
    }
  }
}
