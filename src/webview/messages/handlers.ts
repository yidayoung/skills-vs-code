import * as vscode from 'vscode';
import { VSCodeMessage, SkillSearchResult, LeaderboardView, SkillAPIConfig, Skill } from '../../types';
import { SkillManager } from '../../managers/SkillManager';
import { APIClient } from '../../managers/APIClient';
import { SkillCache } from '../../managers/SkillCache';
import { UserPreferences } from '../../managers/UserPreferences';
import { SkillDetailProvider } from '../../editors/SkillDetailProvider';
import { parseSource } from '../../utils/source-parser';

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
        case 'checkInstalledSkillUpdates':
          await handleCheckInstalledSkillUpdates(webviewLike, managers);
          break;
        case 'requestMarketConfigs':
          await handleRequestMarketConfigs(webviewLike);
          break;
        case 'saveMarketConfigs':
          await handleSaveMarketConfigs(webviewLike, context, managers, message.configs);
          break;
        case 'testMarketConfig':
          await handleTestMarketConfig(webviewLike, managers, message.config);
          break;
        case 'search':
          await handleSearch(webviewLike, managers, message.query);
          break;
        case 'getLeaderboard':
          await handleGetLeaderboard(webviewLike, managers, message.view, message.page, message.requestId);
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
          await handleViewSkill(webviewLike, context, managers, message.skill, message.openMode);
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
  _context: vscode.ExtensionContext,
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

async function handleCheckInstalledSkillUpdates(
  webviewLike: WebviewLike,
  managers: { skillManager: SkillManager }
) {
  webviewLike.webview.postMessage({
    type: 'skillsUpdateStatus',
    data: { status: 'checking' }
  });

  try {
    const skills = await managers.skillManager.listInstalledSkills();
    const skillsWithUpdates = await managers.skillManager.checkUpdates(skills);

    webviewLike.webview.postMessage({
      type: 'installedSkills',
      data: skillsWithUpdates
    });
    webviewLike.webview.postMessage({
      type: 'skillsUpdateStatus',
      data: { status: 'done' }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to check skill updates: ${error}`);
    webviewLike.webview.postMessage({
      type: 'skillsUpdateStatus',
      data: { status: 'error' }
    });
  }
}

function getCurrentMarketConfigs(): SkillAPIConfig[] {
  return vscode.workspace.getConfiguration('skills').get<SkillAPIConfig[]>('apiUrls', [
    {
      url: 'https://skills.sh',
      enabled: true,
      name: 'Skills.sh',
      priority: 100
    }
  ]);
}

function normalizeMarketConfigs(configs: SkillAPIConfig[]): SkillAPIConfig[] {
  return configs
    .map((config, index) => ({
      url: (config.url || '').trim(),
      enabled: config.enabled !== false,
      name: (config.name || '').trim() || undefined,
      priority: typeof config.priority === 'number' ? config.priority : (100 - index)
    }))
    .filter(config => config.url.length > 0);
}

async function handleRequestMarketConfigs(webviewLike: WebviewLike) {
  webviewLike.webview.postMessage({
    type: 'marketConfigs',
    data: getCurrentMarketConfigs()
  });
}

async function handleSaveMarketConfigs(
  webviewLike: WebviewLike,
  context: vscode.ExtensionContext,
  managers: { apiClient: APIClient },
  configs: SkillAPIConfig[]
) {
  try {
    const normalized = normalizeMarketConfigs(Array.isArray(configs) ? configs : []);
    await vscode.workspace.getConfiguration('skills').update('apiUrls', normalized, true);
    managers.apiClient = new APIClient(normalized, context);

    webviewLike.webview.postMessage({
      type: 'marketConfigsSaved',
      data: normalized
    });
    webviewLike.webview.postMessage({
      type: 'marketConfigs',
      data: normalized
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    webviewLike.webview.postMessage({
      type: 'marketConfigsSaveError',
      error: errorMessage
    });
  }
}

async function handleTestMarketConfig(
  webviewLike: WebviewLike,
  managers: { apiClient: APIClient },
  config: SkillAPIConfig
) {
  const startedAt = Date.now();
  try {
    const result = await managers.apiClient.testMarketConfig(config);
    webviewLike.webview.postMessage({
      type: 'testMarketConfigResult',
      configUrl: config.url,
      latencyMs: Date.now() - startedAt,
      ...result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    webviewLike.webview.postMessage({
      type: 'testMarketConfigResult',
      configUrl: config.url,
      latencyMs: Date.now() - startedAt,
      searchOk: false,
      leaderboardOk: false,
      searchError: errorMessage,
      leaderboardError: errorMessage
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

async function handleGetLeaderboard(
  webviewLike: WebviewLike,
  managers: { apiClient: APIClient },
  view: LeaderboardView,
  page: number = 0,
  requestId?: string
) {
  try {
    webviewLike.webview.postMessage({
      type: 'leaderboardStart',
      view,
      page,
      requestId
    });

    const result = await managers.apiClient.getLeaderboardSkills(view, page);

    webviewLike.webview.postMessage({
      type: 'leaderboardResults',
      view,
      page: result.page,
      total: result.total,
      hasMore: result.hasMore,
      data: result.skills,
      requestId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    webviewLike.webview.postMessage({
      type: 'leaderboardError',
      view,
      page,
      error: errorMessage,
      requestId
    });
  }
}

async function handleInstall(
  webviewLike: WebviewLike,
  _context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager; userPreferences: UserPreferences; apiClient: APIClient },
  skill: SkillSearchResult
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

      // Perform the installation directly
      await performInstallation(webviewLike, _context, managers, skill, selectedAgentIds, installScope);
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
    await performInstallation(webviewLike, _context, managers, skill, selectedAgentIds, installScope);

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
  _context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager; userPreferences: UserPreferences; apiClient: APIClient },
  skill: SkillSearchResult,
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

    // Determine the skill path
    let skillPath = '';

    // Check if this is a sub-skill (has skillId field)
    if ((skill as any).skillId) {
      // This is a specific skill from a multi-skill repository
      // Construct path: skills/{skillId}
      skillPath = `skills/${(skill as any).skillId}`;
    } else if (skill.id && typeof skill.id === 'string' && skill.id.includes('/')) {
      // Try to extract path from skill.id (format: "owner/repo/skillName")
      const parts = skill.id.split('/');

      if (parts.length >= 3) {
        // Format: "owner/repo/skillName" or "owner/repo/category/skillName"
        // Extract the skill name and construct path
        const skillName = parts[parts.length - 1]; // Last part is the skill name
        skillPath = `skills/${skillName}`;
      }
    }

    progress.report({ increment: 10, message: 'Creating temporary directory...' });

    const tempDir = pathModule.join(os.tmpdir(), `skill-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    progress.report({ increment: 20, message: 'Downloading skill files...' });

    // Normalize repository URL before downloading
    const normalizedRepositoryUrl = APIClient.normalizeRepositoryUrl(skill.repository);

    // Download using provider system (supports GitHub, GitLab, etc.)
    await downloadSkillFolder(normalizedRepositoryUrl, tempDir, skillPath || undefined);

    const scopeLabel = scope === 'global' ? 'global' : 'project';
    const agentLabels = agents.join(', ');
    progress.report({ increment: 70, message: `Installing to ${scopeLabel} (${agentLabels})...` });

    const parsedSource = parseSource(normalizedRepositoryUrl);
    const sourceType = parsedSource.type === 'github' || parsedSource.type === 'gitlab' || parsedSource.type === 'git'
      ? parsedSource.type
      : 'git';
    const ownerRepo = parsedSource.type === 'github'
      ? `${parsedSource.owner}/${parsedSource.repo}`
      : parsedSource.type === 'gitlab'
        ? parsedSource.repoPath
        : undefined;

    await managers.skillManager.installSkill(tempDir, agents, scope, {
      sourceType,
      sourceUrl: normalizedRepositoryUrl,
      repository: normalizedRepositoryUrl,
      ownerRepo,
      sourceRef: parsedSource.type === 'github' || parsedSource.type === 'gitlab' ? parsedSource.ref : undefined,
      skillPath: skillPath ? `${skillPath}/SKILL.md` : 'SKILL.md',
      skillId: skill.skillId
    });

    progress.report({ increment: 90, message: 'Cleaning up...' });

    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    progress.report({ increment: 100, message: 'Complete!' });
  });

  vscode.window.showInformationMessage(`${skill.name} installed successfully!`);

  await handleRequestInstalledSkills(webviewLike, managers);
}

async function handleUpdate(
  webviewLike: WebviewLike,
  _context: vscode.ExtensionContext,
  managers: { skillManager: SkillManager },
  skill: Skill | SkillSearchResult,
  agents: string[] = []
) {
  try {
    let updated = false;
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Updating ${skill.name}`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Updating...' });

      updated = await managers.skillManager.updateSkill(skill, agents);

      progress.report({ increment: 100, message: 'Complete' });
    });

    if (!updated) {
      vscode.window.showInformationMessage(`${skill.name} is already up to date.`);
      return;
    }

    vscode.window.showInformationMessage(`${skill.name} updated successfully!`);

    // Refresh installed skills list
    await handleRequestInstalledSkills(webviewLike, managers);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update skill: ${error}`);
  }
}

async function handleRemove(
  webviewLike: WebviewLike,
  _context: vscode.ExtensionContext,
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
  skill: any,
  openMode?: 'preview' | 'direct'
) {
  try {
    await SkillDetailProvider.show(skill, managers, { openMode });
  } catch (error) {
    console.error(`[handleViewSkill] Error:`, error);
    vscode.window.showErrorMessage(`Failed to view skill: ${error}`);
  }
}

async function handleOpenRepository(url: string) {
  try {
    // 复用 APIClient 的 URL 规范化逻辑
    const normalizedUrl = APIClient.normalizeRepositoryUrl(url);
    await vscode.env.openExternal(vscode.Uri.parse(normalizedUrl));
  } catch (error) {
    console.error(`[handleOpenRepository] Error:`, error);
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
    const uri = vscode.Uri.file(data.filePath);
    try {
      await vscode.commands.executeCommand('markdown.showPreview', uri);
    } catch {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open skill.md: ${error}`);
  }
}
