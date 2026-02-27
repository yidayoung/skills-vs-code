import * as vscode from 'vscode';
import * as path from 'path';
import { VSCodeMessage } from '../../types';
import { SkillManager } from '../../managers/SkillManager';
import { APIClient } from '../../managers/APIClient';
import { SkillCache } from '../../managers/SkillCache';
import { UserPreferences } from '../../managers/UserPreferences';
import { SkillDetailProvider } from '../../editors/SkillDetailProvider';

/**
 * 通用 Webview 接口
 * 支持 WebviewPanel 和 WebviewView
 */
export interface WebviewLike {
  webview: vscode.Webview;
}

export function setupMessageHandlers(
  webviewLike: WebviewLike,
  context: vscode.ExtensionContext,
  managers: {
    skillManager: SkillManager;
    apiClient: APIClient;
    skillCache: SkillCache;
    userPreferences: UserPreferences;
  }
): void {
  const messageDisposable = webviewLike.webview.onDidReceiveMessage(
    async (message: VSCodeMessage) => {
      switch (message.type) {
        case 'ready':
          await handleReady(webviewLike, context, managers);
          break;
        case 'requestInstalledSkills':
          await handleRequestInstalledSkills(webviewLike, managers);
          break;
        case 'search':
          await handleSearch(webviewLike, managers, message.query);
          break;
        case 'getTrending':
          await handleGetTrending(webviewLike, managers);
          break;
        case 'install':
          await handleInstall(webviewLike, context, managers, message.skill);
          break;
        case 'update':
          await handleUpdate(webviewLike, context, managers, message.skill, message.agents);
          break;
        case 'remove':
          await handleRemove(webviewLike, context, managers, message.skillId, message.agents, message.scope);
          break;
        case 'viewSkill':
          await handleViewSkill(webviewLike, context, managers, message.skill);
          break;
        case 'openRepository':
          await handleOpenRepository(message.url);
          break;
        case 'fetchRemoteSkillMd':
          await handleFetchRemoteSkillMd(webviewLike, managers, message.data);
          break;
        case 'openSkillMd':
          await handleOpenSkillMd(message.data);
          break;
        case 'switchTab':
          // Tab switching is handled on the webview side
          break;
        default:
          console.warn('Unknown message type:', (message as any).type);
      }
    }
  );

  // Add to context subscriptions for cleanup
  context.subscriptions.push(messageDisposable);
}

async function handleReady(
  webviewLike: WebviewLike,
  context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager; userPreferences: UserPreferences }
) {
  // Send initial configuration and installed skills
  const defaultAgents = managers.userPreferences.getDefaultAgents();
  const defaultScope = managers.userPreferences.getDefaultScope();

  webviewLike.webview.postMessage({
    type: 'ready',
    config: {
      defaultAgents,
      defaultScope
    }
  });

  // Load installed skills
  await handleRequestInstalledSkills(webviewLike, managers);
}

async function handleRequestInstalledSkills(
  webviewLike: WebviewLike,
  managers: { skillManager: SkillManager }
) {
  try {
    const skills = await managers.skillManager.listInstalledSkills();

    webviewLike.webview.postMessage({
      type: 'installedSkills',
      data: skills
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load installed skills: ${error}`);
    webviewLike.webview.postMessage({
      type: 'installedSkills',
      data: []
    });
  }
}

async function handleSearch(
  webviewLike: WebviewLike,
  managers: { apiClient: APIClient },
  query: string
) {
  try {
    webviewLike.webview.postMessage({ type: 'searchStart' });

    const results = await managers.apiClient.searchSkills(query);

    webviewLike.webview.postMessage({
      type: 'searchResults',
      data: results
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    webviewLike.webview.postMessage({
      type: 'searchError',
      error: errorMessage
    });
  }
}

async function handleGetTrending(
  webviewLike: WebviewLike,
  managers: { apiClient: APIClient }
) {
  try {
    const results = await managers.apiClient.getTrendingSkills(10);

    webviewLike.webview.postMessage({
      type: 'trendingResults',
      data: results
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch trending skills:', errorMessage);
  }
}

async function handleInstall(
  webviewLike: WebviewLike,
  context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager; userPreferences: UserPreferences; apiClient: APIClient },
  skill: any
) {
  try {
    // Check if user wants to skip prompts
    const skipPrompts = managers.userPreferences.getSkipInstallPrompts();

    if (skipPrompts) {
      // Use default settings directly without prompting
      const { getSupportedAgents } = await import('../../utils/agents');
      const allAgents = getSupportedAgents();
      const universalAgents = allAgents.filter(a => a.universal);
      const lastSelectedAgents = managers.userPreferences.getDefaultAgents();

      // Combine universal agents with default non-universal agents
      const selectedAgentIds = [
        ...universalAgents.map(a => a.id),
        ...lastSelectedAgents
      ];

      const installScope: 'project' | 'global' = managers.userPreferences.getDefaultScope();

      console.log(`[Install] Skipping prompts, using defaults: agents=${selectedAgentIds.join(', ')}, scope=${installScope}`);

      // Perform the installation directly
      await performInstallation(webviewLike, context, managers, skill, selectedAgentIds, installScope);
      return;
    }

    // Step 1: Select agents to install to
    const { getSupportedAgents } = await import('../../utils/agents');
    const allAgents = getSupportedAgents();

    // Separate universal and non-universal agents
    const universalAgents = allAgents.filter(a => a.universal);
    const otherAgents = allAgents.filter(a => !a.universal);

    // Get last selected agents
    const lastSelectedAgents = managers.userPreferences.getDefaultAgents();

    // Build quick pick items for non-universal agents
    const agentItems = otherAgents.map(agent => ({
      label: agent.displayName,
      picked: lastSelectedAgents.includes(agent.id),
      detail: agent.id,
      agentId: agent.id
    }));

    // Add info about universal agents (always included)
    const universalLabel = universalAgents.length > 0
      ? `Universal agents (always included): ${universalAgents.map(a => a.displayName).join(', ')}`
      : '';

    // Show agent selection quick pick
    const selectedAgentItems = await vscode.window.showQuickPick(
      agentItems,
      {
        placeHolder: 'Select agents to install skill to',
        canPickMany: true,
        title: universalLabel ? `Install ${skill.name}\n${universalLabel}` : `Install ${skill.name}`
      }
    );

    if (!selectedAgentItems) {
      // User cancelled
      return;
    }

    // Combine universal agents with selected agents
    const selectedAgentIds = [
      ...universalAgents.map(a => a.id),
      ...selectedAgentItems.map(item => item.agentId)
    ];

    // Save the selection for next time (only save non-universal agents)
    await managers.userPreferences.setDefaultAgents(selectedAgentItems.map(item => item.agentId));

    // Step 2: Select installation scope
    const scopeOptions = [
      { label: 'Global', description: 'Install in user home directory (~/.agents/skills)', value: 'global' },
      { label: 'Project', description: 'Install in current project directory (.agents/skills)', value: 'project' }
    ];

    const selectedItem = await vscode.window.showQuickPick(
      scopeOptions,
      {
        placeHolder: 'Select installation scope',
        title: 'Where do you want to install this skill?'
      }
    );

    if (!selectedItem) {
      // User cancelled
      return;
    }

    const installScope: 'project' | 'global' = selectedItem.value as 'project' | 'global';

    // Save the scope selection for next time
    await managers.userPreferences.setDefaultScope(installScope);

    // Step 3: Perform the installation
    await performInstallation(webviewLike, context, managers, skill, selectedAgentIds, installScope);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to install skill: ${errorMessage}`);
  }
}

/**
 * Perform the actual skill installation
 */
async function performInstallation(
  webviewLike: WebviewLike,
  context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager; userPreferences: UserPreferences; apiClient: APIClient },
  skill: any,
  agents: string[],
  scope: 'project' | 'global'
) {
  vscode.window.showInformationMessage(`Installing ${skill.name}...`);

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Installing ${skill.name}`,
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0, message: 'Parsing skill source...' });

    // Use provider system for multi-platform support
    const { downloadSkillFolder } = await import('../../providers');
    const os = await import('os');
    const fs = await import('fs/promises');
    const pathModule = await import('path');

    console.log(`[Install] skill:`, skill);
    console.log(`[Install] skill.repository: ${skill.repository}`);
    console.log(`[Install] skill.id: ${skill.id}`);
    console.log(`[Install] skill.skillId: ${(skill as any).skillId}`);

    // Determine the skill path
    let skillPath = '';

    // Check if this is a sub-skill (has skillId field)
    if ((skill as any).skillId) {
      // This is a specific skill from a multi-skill repository
      // Construct path: skills/{skillId}
      skillPath = `skills/${(skill as any).skillId}`;
      console.log(`[Install] Using skillId to construct path: ${skillPath}`);
    } else if (skill.id && typeof skill.id === 'string' && skill.id.includes('/')) {
      // Try to extract path from skill.id (format: "owner/repo/skillName")
      const parts = skill.id.split('/');
      console.log(`[Install] skill.id parts:`, parts);

      if (parts.length >= 3) {
        // Format: "owner/repo/skillName" or "owner/repo/category/skillName"
        // Extract the skill name and construct path
        const skillName = parts[parts.length - 1]; // Last part is the skill name
        skillPath = `skills/${skillName}`;
        console.log(`[Install] Extracted from skill.id: "${skillPath}"`);
      }
    }

    progress.report({ increment: 10, message: 'Creating temporary directory...' });

    const tempDir = pathModule.join(os.tmpdir(), `skill-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    progress.report({ increment: 20, message: 'Downloading skill files...' });

    // Download using provider system (supports GitHub, GitLab, etc.)
    await downloadSkillFolder(skill.repository, tempDir, skillPath || undefined);

    // Debug: list what's in tempDir after download
    try {
      const fs = await import('fs/promises');
      const entries = await fs.readdir(tempDir, { withFileTypes: true });
      console.log(`[Install] Contents of tempDir after download:`);
      for (const entry of entries.slice(0, 10)) {
        console.log(`  - ${entry.name} (${entry.isDirectory() ? 'dir' : 'file'})`);
      }

      // Check if SKILL.md exists in tempDir root
      const skillMdPath = pathModule.join(tempDir, 'SKILL.md');
      try {
        await fs.access(skillMdPath);
        console.log(`[Install] ✓ SKILL.md found in tempDir root`);
      } catch {
        console.log(`[Install] ✗ SKILL.md NOT found in tempDir root`);
      }
    } catch (err) {
      console.error(`[Install] Could not list tempDir: ${err}`);
    }

    const scopeLabel = scope === 'global' ? 'global' : 'project';
    const agentLabels = agents.join(', ');
    progress.report({ increment: 70, message: `Installing to ${scopeLabel} (${agentLabels})...` });

    await managers.skillManager.installSkill(tempDir, agents, scope);

    progress.report({ increment: 90, message: 'Cleaning up...' });

    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    progress.report({ increment: 100, message: 'Complete!' });
  });

  vscode.window.showInformationMessage(`${skill.name} installed successfully!`);

  await handleRequestInstalledSkills(webviewLike, managers);
}

async function handleUpdate(
  webviewLike: WebviewLike,
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
    await handleRequestInstalledSkills(webviewLike, managers);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update skill: ${error}`);
  }
}

async function handleRemove(
  webviewLike: WebviewLike,
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
    await handleRequestInstalledSkills(webviewLike, managers);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to remove skill: ${error}`);
  }
}

async function handleViewSkill(
  _webviewLike: WebviewLike,
  _context: vscode.ExtensionContext,
  managers: { skillCache: SkillCache; apiClient: APIClient },
  skill: any
) {
  try {
    await SkillDetailProvider.show(skill, managers);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to view skill: ${error}`);
  }
}

async function handleOpenRepository(url: string) {
  try {
    // 复用 APIClient 的 URL 规范化逻辑
    const normalizedUrl = APIClient.normalizeRepositoryUrl(url);
    await vscode.env.openExternal(vscode.Uri.parse(normalizedUrl));
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open repository: ${error}`);
  }
}

async function handleFetchRemoteSkillMd(
  webviewLike: WebviewLike,
  managers: { apiClient: APIClient },
  data: { repositoryUrl: string; skillId: string }
) {
  try {
    const { repositoryUrl, skillId } = data;

    const filePath = await managers.apiClient.fetchRemoteSkillMd(repositoryUrl, skillId);

    webviewLike.webview.postMessage({
      type: 'skillMdFetched',
      data: { filePath, skillId }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    webviewLike.webview.postMessage({
      type: 'skillMdError',
      data: {
        error: errorMessage,
        skillId: data.skillId
      }
    });
  }
}

async function handleOpenSkillMd(data: { filePath: string }) {
  try {
    const doc = await vscode.workspace.openTextDocument(data.filePath);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open skill.md: ${error}`);
  }
}
