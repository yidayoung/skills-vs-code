import * as vscode from 'vscode';
import * as path from 'path';
import { VSCodeMessage } from '../../types';
import { SkillManager } from '../../managers/SkillManager';
import { APIClient } from '../../managers/APIClient';
import { SkillCache } from '../../managers/SkillCache';
import { UserPreferences } from '../../managers/UserPreferences';

export function setupMessageHandlers(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  managers: {
    skillManager: SkillManager;
    apiClient: APIClient;
    skillCache: SkillCache;
    userPreferences: UserPreferences;
  }
): void {
  panel.webview.onDidReceiveMessage(
    async (message: VSCodeMessage) => {
      switch (message.type) {
        case 'ready':
          await handleReady(panel, context, managers);
          break;
        case 'requestInstalledSkills':
          await handleRequestInstalledSkills(panel, managers);
          break;
        case 'search':
          await handleSearch(panel, managers, message.query);
          break;
        case 'install':
          await handleInstall(panel, context, managers, message.skill);
          break;
        case 'update':
          await handleUpdate(panel, context, managers, message.skill, message.agents);
          break;
        case 'remove':
          await handleRemove(panel, context, managers, message.skillId, message.agents, message.scope);
          break;
        case 'viewSkill':
          await handleViewSkill(panel, context, managers, message.skill);
          break;
        case 'switchTab':
          // Tab switching is handled on the webview side
          break;
        default:
          console.warn('Unknown message type:', (message as any).type);
      }
    },
    undefined,
    context.subscriptions
  );
}

async function handleReady(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager; userPreferences: UserPreferences }
) {
  // Send initial configuration and installed skills
  const defaultAgents = managers.userPreferences.getDefaultAgents();
  const defaultScope = managers.userPreferences.getDefaultScope();

  panel.webview.postMessage({
    type: 'ready',
    config: {
      defaultAgents,
      defaultScope
    }
  });

  // Load installed skills
  await handleRequestInstalledSkills(panel, managers);
}

async function handleRequestInstalledSkills(
  panel: vscode.WebviewPanel,
  managers: { skillManager: SkillManager }
) {
  try {
    const skills = await managers.skillManager.listInstalledSkills();

    panel.webview.postMessage({
      type: 'installedSkills',
      data: skills
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load installed skills: ${error}`);
    panel.webview.postMessage({
      type: 'installedSkills',
      data: []
    });
  }
}

async function handleSearch(
  panel: vscode.WebviewPanel,
  managers: { apiClient: APIClient },
  query: string
) {
  try {
    panel.webview.postMessage({ type: 'searchStart' });

    const results = await managers.apiClient.searchSkills(query);

    panel.webview.postMessage({
      type: 'searchResults',
      data: results
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    panel.webview.postMessage({
      type: 'searchError',
      error: errorMessage
    });
  }
}

async function handleInstall(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager; userPreferences: UserPreferences },
  skill: any
) {
  try {
    const defaultAgents = managers.userPreferences.getDefaultAgents();
    const defaultScope = managers.userPreferences.getDefaultScope();

    // For now, we'll need to clone the repo first
    // This is a simplified version - full implementation would:
    // 1. Clone the repository to a temp location
    // 2. Parse the skill
    // 3. Call skillManager.installSkill

    vscode.window.showInformationMessage(
      `Installing ${skill.name}...`,
    );

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Installing ${skill.name}`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });

      // TODO: Implement actual installation
      // For now, just show a message
      progress.report({ increment: 100, message: 'Complete' });
    });

    vscode.window.showInformationMessage(`${skill.name} installed successfully!`);

    // Refresh installed skills list
    await handleRequestInstalledSkills(panel, managers);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to install skill: ${error}`);
  }
}

async function handleUpdate(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager },
  skill: any,
  agents: string[] = []
) {
  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Updating ${skill.name}`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Updating...' });

      await managers.skillManager.updateSkill(skill, agents);

      progress.report({ increment: 100, message: 'Complete' });
    });

    vscode.window.showInformationMessage(`${skill.name} updated successfully!`);

    // Refresh installed skills list
    await handleRequestInstalledSkills(panel, managers);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update skill: ${error}`);
  }
}

async function handleRemove(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager },
  skillId: string,
  agents: string[] = [],
  scope: 'project' | 'global' = 'project'
) {
  try {
    const confirmed = await vscode.window.showWarningMessage(
      `Are you sure you want to remove this skill?`,
      { modal: true },
      'Remove',
      'Cancel'
    );

    if (confirmed !== 'Remove') {
      return;
    }

    await managers.skillManager.removeSkill(skillId, agents, scope);

    vscode.window.showInformationMessage('Skill removed successfully!');

    // Refresh installed skills list
    await handleRequestInstalledSkills(panel, managers);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to remove skill: ${error}`);
  }
}

async function handleViewSkill(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  managers: { skillCache: SkillCache; apiClient: APIClient },
  skill: any
) {
  try {
    let content: string | null = null;

    // Check if it's a local skill (has localPath)
    if (skill.source?.type === 'local' && skill.source.localPath) {
      // Read from local filesystem
      const fs = await import('fs/promises');
      const skillMdPath = path.join(skill.source.localPath, 'SKILL.md');
      content = await fs.readFile(skillMdPath, 'utf-8');
    } else if (skill.skillMdUrl) {
      // Try cache first
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

    if (content) {
      // Create a new untitled document with the skill content
      const doc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content
      });
      await vscode.window.showTextDocument(doc);
    } else {
      vscode.window.showErrorMessage('Could not load skill content');
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to view skill: ${error}`);
  }
}

