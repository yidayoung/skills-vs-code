import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { Skill, SkillSearchResult } from '../types';
import { getSupportedAgents, getAgentSkillsDir, detectInstalledAgents } from '../utils/agents';
import { parseSkillMd, sanitizeName } from '../utils/skills';
import { parseSource } from '../utils/source-parser';
import { cloneRepo, cleanupTempDir } from '../utils/git';

const AGENTS_DIR = '.agents';
const SKILLS_SUBDIR = 'skills';
const SOURCE_METADATA_FILE = '.skill-source.json';

interface SkillSourceMetadata {
  sourceType: 'github' | 'gitlab' | 'git';
  sourceUrl: string;
  repository: string;
  ownerRepo?: string;
  skillPath: string;
  skillId?: string;
  sourceRef?: string;
  installedHash?: string;
  lastRemoteHash?: string;
  skillFolderHash?: string;
  installedAt: string;
  updatedAt: string;
}

/**
 * Manages skill operations (install, list, update, remove)
 */
export class SkillManager {
  private static debugChannel: vscode.OutputChannel | null = null;

  constructor(
    private workspaceRoot: string | undefined,
    _globalStoragePath: string
  ) {}

  private debug(message: string): void {
    if (!SkillManager.debugChannel) {
      SkillManager.debugChannel = vscode.window.createOutputChannel('Skills Update Debug');
    }
    SkillManager.debugChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
  }

  /**
   * List all installed skills across agents
   */
  async listInstalledSkills(options?: {
    global?: boolean;
    agentFilter?: string[];
  }): Promise<Skill[]> {
    const cwd = this.workspaceRoot || process.cwd();
    const skillsMap = new Map<string, Skill>();
    const detectedAgents = await detectInstalledAgents();
    const agentsToCheck = options?.agentFilter || detectedAgents;

    // Determine scopes to scan
    const scopes: Array<{ global: boolean; path: string }> = [];

    if (options?.global === undefined) {
      // Scan both project and global
      scopes.push(
        { global: false, path: path.join(cwd, AGENTS_DIR, SKILLS_SUBDIR) },
        { global: true, path: path.join(homedir(), AGENTS_DIR, SKILLS_SUBDIR) }
      );
    } else {
      scopes.push({
        global: options.global,
        path: options.global
          ? path.join(homedir(), AGENTS_DIR, SKILLS_SUBDIR)
          : path.join(cwd, AGENTS_DIR, SKILLS_SUBDIR)
      });
    }

    // Scan canonical (.agents/skills) directory with 'universal' identifier
    for (const scope of scopes) {
      await this.scanDirectory(scope.path, scope.global, ['universal'], skillsMap);
    }

    // Scan agent-specific directories for non-canonical agents
    for (const agentId of agentsToCheck) {
      const agent = getSupportedAgents().find(a => a.id === agentId);
      if (!agent || agent.universal) continue;

      for (const scope of scopes) {
        const agentDir = getAgentSkillsDir(agentId, scope.global, cwd);
        await this.scanDirectory(agentDir, scope.global, [agentId], skillsMap);
      }
    }

    return Array.from(skillsMap.values());
  }

  private async scanDirectory(
    dirPath: string,
    global: boolean,
    agentIds: string[],
    skillsMap: Map<string, Skill>
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(dirPath, entry.name);
        const skillMdPath = path.join(skillDir, 'SKILL.md');

        // Check if SKILL.md exists
        try {
          await fs.access(skillMdPath);
        } catch {
          continue;
        }

        // Parse the skill
        const parsedSkill = await parseSkillMd(skillMdPath);
        if (!parsedSkill) continue;

        const sourceMetadata = await this.readSkillSourceMetadata(skillDir);
        const scopeKey = global ? 'global' : 'project';
        const hasPendingUpdate = Boolean(
          sourceMetadata?.installedHash &&
          sourceMetadata?.lastRemoteHash &&
          sourceMetadata.installedHash !== sourceMetadata.lastRemoteHash
        );
        const skillKey = `${scopeKey}:${parsedSkill.name}`;

        // Create or update skill in map
        if (skillsMap.has(skillKey)) {
          const existing = skillsMap.get(skillKey)!;
          // Add agent versions if not already present
          for (const agentId of agentIds) {
            if (!existing.installedVersions?.find(v => v.agent === agentId && v.scope === scopeKey)) {
              existing.installedVersions = existing.installedVersions || [];
              existing.installedVersions.push({
                agent: agentId,
                scope: scopeKey,
                path: skillDir,
                installMethod: 'symlink'
              });
            }
          }

          // Keep remote source metadata when available.
          if (sourceMetadata) {
            existing.source = {
              type: 'remote',
              repository: sourceMetadata.repository,
              sourceUrl: sourceMetadata.sourceUrl,
              sourceType: sourceMetadata.sourceType,
              ownerRepo: sourceMetadata.ownerRepo,
              skillPath: sourceMetadata.skillPath,
              skillId: sourceMetadata.skillId,
              sourceRef: sourceMetadata.sourceRef,
              installedHash: sourceMetadata.installedHash,
              lastRemoteHash: sourceMetadata.lastRemoteHash,
              skillFolderHash: sourceMetadata.skillFolderHash,
              skillMdPath
            };
            existing.hasUpdate = hasPendingUpdate;
          }
        } else {
          skillsMap.set(skillKey, {
            id: parsedSkill.name,
            name: parsedSkill.name,
            description: parsedSkill.description,
            source: sourceMetadata
              ? {
                type: 'remote',
                repository: sourceMetadata.repository,
                sourceUrl: sourceMetadata.sourceUrl,
                sourceType: sourceMetadata.sourceType,
                ownerRepo: sourceMetadata.ownerRepo,
                skillPath: sourceMetadata.skillPath,
                skillId: sourceMetadata.skillId,
                sourceRef: sourceMetadata.sourceRef,
                installedHash: sourceMetadata.installedHash,
                lastRemoteHash: sourceMetadata.lastRemoteHash,
                skillFolderHash: sourceMetadata.skillFolderHash,
                skillMdPath
              }
              : {
                type: 'local',
                skillMdPath: skillMdPath,
                localPath: parsedSkill.path
              },
            installedVersions: agentIds.map(agentId => ({
              agent: agentId,
              scope: scopeKey,
              path: skillDir,
              installMethod: 'symlink'
            })),
            hasUpdate: hasPendingUpdate
          });
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  /**
   * Install a skill from various sources
   * 支持的格式：
   * - 本地路径: /path/to/skill, ./skill
   * - GitHub 短名字: owner/repo
   * - GitHub URL: https://github.com/owner/repo
   * - GitLab: gitlab.com/owner/repo
   * - 其他 Git URL
   *
   * @param source - 技能来源（本地路径或 Git URL）
   * @param agents - 目标 agents
   * @param scope - 安装范围
   */
  async installSkill(
    source: string,
    agents: string[],
    scope: 'project' | 'global',
    sourceMetadata?: Partial<SkillSourceMetadata>
  ): Promise<void> {
    const cwd = this.workspaceRoot || process.cwd();

    // 解析 source
    const parsedSource = parseSource(source);

    let skillPath: string;
    let installMetadata: Partial<SkillSourceMetadata> | undefined = sourceMetadata;

    // 根据 source 类型获取技能路径
    if (parsedSource.type === 'local') {
      // 本地路径
      skillPath = parsedSource.localPath;
    } else {
      // 远程仓库 - 需要克隆
      const repoUrl = parsedSource.url;
      const ownerRepo = parsedSource.type === 'github'
        ? `${parsedSource.owner}/${parsedSource.repo}`
        : parsedSource.type === 'gitlab'
          ? parsedSource.repoPath
          : undefined;
      const sourceRef = parsedSource.type === 'github' || parsedSource.type === 'gitlab'
        ? parsedSource.ref
        : undefined;
      const sourceSubpath = parsedSource.type === 'github' || parsedSource.type === 'gitlab'
        ? parsedSource.subpath
        : undefined;

      const sourceType: SkillSourceMetadata['sourceType'] =
        parsedSource.type === 'github' || parsedSource.type === 'gitlab' || parsedSource.type === 'git'
          ? parsedSource.type
          : 'git';

      installMetadata = {
        sourceType,
        sourceUrl: repoUrl,
        repository: repoUrl,
        ownerRepo,
        sourceRef,
        skillPath: sourceSubpath ? `${sourceSubpath}/SKILL.md` : 'SKILL.md',
        ...sourceMetadata
      };

      let tempDir: string | null = null;
      try {
        tempDir = await cloneRepo(repoUrl);

        // 如果有子路径，加上子路径
        if (parsedSource.type === 'github' && parsedSource.subpath) {
          skillPath = path.join(tempDir, parsedSource.subpath);
        } else if (parsedSource.type === 'gitlab' && parsedSource.subpath) {
          skillPath = path.join(tempDir, parsedSource.subpath);
        } else {
          skillPath = tempDir;
        }

        // 执行安装
        await this.installFromPath(skillPath, agents, scope, cwd, installMetadata, tempDir || undefined);

        // 清理临时目录
        if (tempDir) {
          await cleanupTempDir(tempDir);
        }

        return;
      } catch (error) {
        // 清理临时目录
        if (tempDir) {
          await cleanupTempDir(tempDir).catch(() => {});
        }
        throw error;
      }
    }

    // 本地安装
    await this.installFromPath(skillPath, agents, scope, cwd, installMetadata);
  }

  /**
   * 从本地路径安装技能
   */
  private async installFromPath(
    skillPath: string,
    agents: string[],
    scope: 'project' | 'global',
    cwd: string,
    sourceMetadata?: Partial<SkillSourceMetadata>,
    sourceRootPath?: string
  ): Promise<void> {
    // Parse the skill to get its metadata
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    // Check if skillPath exists
    try {
      await fs.access(skillPath);
    } catch {
      console.error(`[SkillManager] skillPath does not exist: ${skillPath}`);
      throw new Error(`Skill path not found: ${skillPath}`);
    }

    // Check if SKILL.md exists
    try {
      await fs.access(skillMdPath);
    } catch {

      // Check for common skill subdirectories (like reference project does)
      const skillSubdirs = ['skills', '.agents/skills', '.claude/skills'];
      const foundSkills: Array<{ name: string; path: string }> = [];

      for (const subdir of skillSubdirs) {
        const subDirPath = path.join(skillPath, subdir);
        try {
          await fs.access(subDirPath);
          const entries = await fs.readdir(subDirPath, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.isDirectory()) {
              const subSkillMdPath = path.join(subDirPath, entry.name, 'SKILL.md');
              try {
                await fs.access(subSkillMdPath);

                // Parse to get the skill name
                const parsed = await parseSkillMd(subSkillMdPath);
                if (parsed) {
                  foundSkills.push({
                    name: parsed.name,
                    path: path.join(subDirPath, entry.name)
                  });
                }
              } catch {
                // Not a valid skill
              }
            }
          }

          if (foundSkills.length > 0) {
            break; // Found skills in this directory
          }
        } catch {
          // Directory doesn't exist, continue to next
        }
      }

      if (foundSkills.length > 0) {
        // Sort by name
        foundSkills.sort((a, b) => a.name.localeCompare(b.name));

        if (foundSkills.length === 1) {
          // Single discovered skill should install directly without prompting.
          const selectedPath = foundSkills[0].path;
          const nextMetadata = this.withResolvedSkillPath(sourceMetadata, selectedPath, sourceRootPath || skillPath);
          return this.installFromPath(selectedPath, agents, scope, cwd, nextMetadata, sourceRootPath || skillPath);
        }

        // Ask user which skill to install when multiple skills are discovered.
        const selected = await vscode.window.showQuickPick(
          foundSkills.map(s => ({
            label: s.name,
            description: path.relative(skillPath, s.path)
          })),
          {
            placeHolder: 'This repository contains multiple skills. Select one to install:',
            title: 'Multi-Skill Repository'
          }
        );

        if (!selected) {
          throw new Error('Installation cancelled');
        }

        // Find the selected skill's path
        const selectedSkill = foundSkills.find(s => s.name === selected.label);
        if (selectedSkill) {
          // Recursively call installFromPath with the sub-skill path
          const nextMetadata = this.withResolvedSkillPath(sourceMetadata, selectedSkill.path, sourceRootPath || skillPath);
          return this.installFromPath(
            selectedSkill.path,
            agents,
            scope,
            cwd,
            nextMetadata,
            sourceRootPath || skillPath
          );
        }
      }

      // If we get here, no SKILL.md was found
      console.error(`[SkillManager] SKILL.md not found at: ${skillMdPath}`);

      // List what's in skillPath to help debug
      try {
        const entries = await fs.readdir(skillPath, { withFileTypes: true });
        console.error(`[SkillManager] Contents of skillPath:`);
        for (const entry of entries.slice(0, 20)) { // Limit to first 20 items
          console.error(`  - ${entry.name} (${entry.isDirectory() ? 'dir' : 'file'})`);
        }
      } catch (err) {
        console.error(`[SkillManager] Could not list skillPath: ${err}`);
      }

      throw new Error(`SKILL.md not found at: ${skillMdPath}`);
    }

    const parsedSkill = await parseSkillMd(skillMdPath);

    if (!parsedSkill) {
      throw new Error('Invalid skill: SKILL.md not found or invalid');
    }

    const skillName = sanitizeName(parsedSkill.name);
    const canonicalDir = path.join(
      scope === 'global' ? homedir() : cwd,
      AGENTS_DIR,
      SKILLS_SUBDIR,
      skillName
    );

    // Create canonical directory
    await fs.mkdir(canonicalDir, { recursive: true });

    // Copy skill files to canonical directory
    await this.copyDirectory(skillPath, canonicalDir);

    // Persist source metadata for update checks when this skill is installed from remote.
    if (sourceMetadata?.sourceType && sourceMetadata.sourceUrl && sourceMetadata.repository) {
      const now = new Date().toISOString();
      const installedHash = await this.computeDirectoryHash(canonicalDir);
      const lastRemoteHash =
        sourceMetadata.lastRemoteHash ||
        sourceMetadata.skillFolderHash ||
        installedHash;
      const metadata: SkillSourceMetadata = {
        sourceType: sourceMetadata.sourceType,
        sourceUrl: sourceMetadata.sourceUrl,
        repository: sourceMetadata.repository,
        ownerRepo: sourceMetadata.ownerRepo,
        sourceRef: sourceMetadata.sourceRef,
        skillPath: sourceMetadata.skillPath || 'SKILL.md',
        skillId: sourceMetadata.skillId,
        installedHash,
        lastRemoteHash,
        skillFolderHash: lastRemoteHash,
        installedAt: sourceMetadata.installedAt || now,
        updatedAt: now
      };
      await this.writeSkillSourceMetadata(canonicalDir, metadata);
    }

    // Create symlinks for each agent
    for (const agentId of agents) {
      const agent = getSupportedAgents().find(a => a.id === agentId);
      if (!agent) continue;

      // Skip universal agents - they use the canonical directory
      if (agent.universal) continue;

      const agentDir = getAgentSkillsDir(agentId, scope === 'global', cwd);
      const agentSkillDir = path.join(agentDir, skillName);

      await fs.mkdir(path.dirname(agentSkillDir), { recursive: true });

      // Create symlink
      try {
        await fs.unlink(agentSkillDir).catch(() => {});
        await fs.symlink(canonicalDir, agentSkillDir);
      } catch (error) {
        console.error(`[SkillManager] Failed to create symlink for ${agent.displayName}: ${error}`);
        vscode.window.showWarningMessage(
          `Failed to create symlink for ${agent.displayName}: ${error}`
        );
      }
    }
  }

  /**
   * Check for updates for installed skills.
   * Supports generic git sources tracked via .skill-source.json metadata.
   */
  async checkUpdates(skills: Skill[]): Promise<Skill[]> {
    this.debug(`checkUpdates start: skills=${skills.length}`);
    const results = await Promise.all(
      skills.map(async (skill) => {
        try {
          this.debug(`checkUpdates skill=${skill.name} sourceType=${skill.source?.type || 'unknown'}`);
          const source = await this.resolveSkillSourceMetadata(skill);
          if (!source) {
            this.debug(`checkUpdates skill=${skill.name} skipped: no source metadata`);
            return { ...skill, hasUpdate: false };
          }

          const latestHash = await this.computeRemoteSkillFolderHash(source);

          if (!latestHash) {
            this.debug(`checkUpdates skill=${skill.name} skipped: latestHash unavailable`);
            return { ...skill, hasUpdate: false };
          }

          let currentHash = source.installedHash || source.skillFolderHash;
          if (!currentHash) {
            const localSkillPath = skill.installedVersions?.[0]?.path;
            if (localSkillPath) {
              currentHash = await this.computeDirectoryHash(localSkillPath);
            }
          }

          const hasUpdate = currentHash ? latestHash !== currentHash : false;
          const localSkillPath = skill.installedVersions?.[0]?.path;
          if (localSkillPath) {
            await this.writeSkillSourceMetadata(localSkillPath, {
              ...source,
              installedHash: currentHash,
              lastRemoteHash: latestHash,
              skillFolderHash: latestHash,
              updatedAt: new Date().toISOString()
            });
          }
          this.debug(
            `checkUpdates skill=${skill.name} sourceUrl=${source.sourceUrl} ` +
            `skillPath=${source.skillPath} latestHash=${latestHash} currentHash=${currentHash || 'none'} ` +
            `hasUpdate=${hasUpdate}`
          );

          return {
            ...skill,
            latestVersion: latestHash,
            hasUpdate
          };
        } catch {
          this.debug(`checkUpdates skill=${skill.name} failed: unexpected error`);
          return { ...skill, hasUpdate: false };
        }
      })
    );

    this.debug('checkUpdates complete');
    return results;
  }

  /**
   * Update a skill from its tracked source metadata.
   * Returns true when an update was applied; false when already up to date.
   */
  async updateSkill(skill: Skill | SkillSearchResult, agents: string[]): Promise<boolean> {
    const installedSkill = skill as Skill;
    const installedVersions = installedSkill.installedVersions || [];

    if (installedVersions.length === 0) {
      throw new Error('Cannot update skill without installation metadata');
    }

    const source = await this.resolveSkillSourceMetadata(installedSkill);
    if (!source) {
      throw new Error('This skill has no tracked remote source metadata');
    }
    this.debug(`updateSkill start: skill=${installedSkill.name} sourceUrl=${source.sourceUrl} skillPath=${source.skillPath}`);

    if (!source.sourceUrl) {
      throw new Error('This skill has no remote source URL');
    }

    const latestHash = await this.computeRemoteSkillFolderHash(source);

    if (!latestHash) {
      this.debug(`updateSkill skill=${installedSkill.name} failed: latestHash unavailable`);
      throw new Error('Failed to check latest skill version from remote git repository');
    }

    let currentHash = source.installedHash || source.skillFolderHash;
    if (!currentHash) {
      const localSkillPath = installedVersions[0]?.path;
      if (localSkillPath) {
        currentHash = await this.computeDirectoryHash(localSkillPath);
      }
    }

    if (currentHash && latestHash === currentHash) {
      this.debug(`updateSkill skill=${installedSkill.name} no-op: latestHash matches currentHash (${latestHash})`);
      return false;
    }

    const scope = installedVersions[0]?.scope || 'project';
    const targetAgents = Array.from(new Set(
      (agents && agents.length > 0)
        ? agents
        : installedVersions.map(v => v.agent)
    ));

    let tempDir: string | null = null;
    try {
      tempDir = await cloneRepo(source.sourceUrl, source.sourceRef);
      const repoFolder = this.getSkillFolderFromSkillPath(source.skillPath);
      const sourcePath = repoFolder ? path.join(tempDir, repoFolder) : tempDir;

      await this.installFromPath(
        sourcePath,
        targetAgents,
        scope,
        this.workspaceRoot || process.cwd(),
        {
          ...source,
          lastRemoteHash: latestHash,
          skillFolderHash: latestHash
        },
        tempDir || undefined
      );
      this.debug(`updateSkill skill=${installedSkill.name} updated: latestHash=${latestHash} scope=${scope}`);
    } finally {
      if (tempDir) {
        await cleanupTempDir(tempDir).catch(() => {});
      }
    }

    return true;
  }

  /**
   * Remove a skill
   * Follows the reference implementation from https://github.com/skills/library
   */
  async removeSkill(skillId: string, agents: string[], scope: 'project' | 'global'): Promise<void> {
    const cwd = this.workspaceRoot || process.cwd();
    const skillName = sanitizeName(skillId);

    // If no agents specified, remove from all known agents to clean up ghost symlinks
    let targetAgents = agents;
    if (agents.length === 0) {
      targetAgents = getSupportedAgents().map(a => a.id);
    }

    const canonicalPath = path.join(
      scope === 'global' ? homedir() : cwd,
      AGENTS_DIR,
      SKILLS_SUBDIR,
      skillName
    );

    // Step 1: Remove agent-specific symlinks (but not canonical yet)
    for (const agentId of targetAgents) {
      const agent = getSupportedAgents().find(a => a.id === agentId);
      if (!agent) continue;

      // For universal agents, the canonical path IS their path
      // Skip it here - we'll handle it after checking all agents
      if (agent.universal) {
        continue;
      }

      const agentSkillDir = path.join(
        getAgentSkillsDir(agentId, scope === 'global', cwd),
        skillName
      );

      try {
        // Check if path exists
        await fs.access(agentSkillDir);

        // Remove the agent-specific symlink/directory
        await fs.rm(agentSkillDir, { recursive: true, force: true });
      } catch (error) {
        // Path doesn't exist or can't be accessed - that's fine
      }
    }

    // Step 2: Remove canonical path only if no other agents are using it
    // This prevents breaking other agents when uninstalling from specific agents

    // If we're removing from ALL agents, we can always remove canonical
    const isRemovingFromAll = targetAgents.length === getSupportedAgents().length;

    if (isRemovingFromAll) {
      // Only check if we're removing from specific agents
      const targetAgentIds = new Set(targetAgents);
      let isStillUsed = false;

      for (const agent of getSupportedAgents()) {
        // Skip agents we're actively removing from
        if (targetAgentIds.has(agent.id)) {
          continue;
        }

        // Determine the path for this agent
        let checkPath: string;
        if (agent.universal) {
          // Universal agents use the canonical path
          checkPath = canonicalPath;
        } else {
          // Non-universal agents have their own symlink paths
          checkPath = path.join(
            getAgentSkillsDir(agent.id, scope === 'global', cwd),
            skillName
          );
        }

        try {
          // Check if this path exists (lstat doesn't follow symlinks)
          await fs.lstat(checkPath);

          // For non-universal agents, verify the symlink isn't broken
          // and points to the canonical path (which means it's a valid install)
          if (!agent.universal) {
            try {
              const targetPath = await fs.readlink(checkPath);
              const resolvedCanonical = path.resolve(canonicalPath);
              const resolvedTarget = path.resolve(path.dirname(checkPath), targetPath);

              // Check if the symlink points to the canonical directory
              if (resolvedTarget === resolvedCanonical) {
                // This agent has a valid symlink to canonical path
                // But we need to verify the canonical path will still exist after removal
                // Since we're planning to remove canonical, this agent would be broken
                isStillUsed = true;
                break;
              }
            } catch {
              // Not a symlink or can't read link, treat as regular directory
              // This agent has its own copy, not affected by canonical removal
            }
          } else {
            // Universal agent directly uses canonical path
            isStillUsed = true;
            break;
          }
        } catch {
          // Path doesn't exist, agent doesn't have this skill
        }
      }

      if (!isStillUsed) {
        try {
          await fs.rm(canonicalPath, { recursive: true, force: true });
        } catch (error) {
          // Canonical path might not exist, that's fine
        }
      } else {
        return; // Exit early, canonical is preserved
      }
    }

    // If we're removing from all agents, or no other agents are using it, remove canonical
    try {
      await fs.rm(canonicalPath, { recursive: true, force: true });
    } catch (error) {
      // Canonical path might not exist, that's fine
    }
  }

  private async readSkillSourceMetadata(skillDir: string): Promise<SkillSourceMetadata | null> {
    try {
      const filePath = path.join(skillDir, SOURCE_METADATA_FILE);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as SkillSourceMetadata;

      if (!parsed.sourceType || !parsed.sourceUrl || !parsed.repository || !parsed.skillPath) {
        return null;
      }

      if (!parsed.skillId) {
        parsed.skillId = this.extractSkillIdFromSkillPath(parsed.skillPath);
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private async writeSkillSourceMetadata(
    skillDir: string,
    metadata: SkillSourceMetadata
  ): Promise<void> {
    const filePath = path.join(skillDir, SOURCE_METADATA_FILE);
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  private async resolveSkillSourceMetadata(skill: Skill): Promise<SkillSourceMetadata | null> {
    const installedPath = skill.installedVersions?.[0]?.path;
    const existing = installedPath ? await this.readSkillSourceMetadata(installedPath) : null;

    if (
      skill.source.type === 'remote' &&
      skill.source.sourceType &&
      skill.source.sourceUrl &&
      skill.source.repository &&
      skill.source.skillPath
    ) {
      return {
        sourceType: skill.source.sourceType,
        sourceUrl: skill.source.sourceUrl,
        repository: skill.source.repository,
        ownerRepo: skill.source.ownerRepo,
        skillPath: skill.source.skillPath,
        skillId: skill.source.skillId || this.extractSkillIdFromSkillPath(skill.source.skillPath),
        sourceRef: skill.source.sourceRef,
        installedHash: skill.source.installedHash || existing?.installedHash,
        lastRemoteHash: skill.source.lastRemoteHash || existing?.lastRemoteHash,
        skillFolderHash: skill.source.skillFolderHash || existing?.skillFolderHash,
        installedAt: existing?.installedAt || new Date().toISOString(),
        updatedAt: existing?.updatedAt || new Date().toISOString()
      };
    }

    return existing;
  }

  private getSkillFolderFromSkillPath(skillPath: string): string {
    if (!skillPath) {
      return '';
    }

    const normalized = skillPath.replace(/\\/g, '/');
    if (normalized === 'SKILL.md') {
      return '';
    }

    if (normalized.endsWith('/SKILL.md')) {
      return normalized.slice(0, -9);
    }

    return normalized;
  }

  private extractSkillIdFromSkillPath(skillPath?: string): string | undefined {
    if (!skillPath) {
      return undefined;
    }

    const normalized = skillPath.replace(/\\/g, '/').trim();
    const withoutSkillFile = normalized.replace(/\/?SKILL\.md$/i, '').replace(/^\/+|\/+$/g, '');
    if (!withoutSkillFile || withoutSkillFile === '.') {
      return undefined;
    }

    const withoutSkillsPrefix = withoutSkillFile.startsWith('skills/')
      ? withoutSkillFile.slice('skills/'.length)
      : withoutSkillFile;

    const skillId = withoutSkillsPrefix.trim();
    return skillId.length > 0 ? skillId : undefined;
  }

  private getGitHubToken(): string | undefined {
    const configToken = vscode.workspace.getConfiguration('skills').get<string>('githubToken');
    if (configToken && configToken.trim()) {
      return configToken.trim();
    }

    return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined;
  }

  private async computeRemoteSkillFolderHash(source: SkillSourceMetadata): Promise<string | null> {
    let tempDir: string | null = null;
    try {
      this.debug(`computeRemoteHash clone start: url=${source.sourceUrl} ref=${source.sourceRef || 'default'}`);
      tempDir = await cloneRepo(source.sourceUrl, source.sourceRef);
      const repoFolder = this.getSkillFolderFromSkillPath(source.skillPath);
      const sourcePath = repoFolder ? path.join(tempDir, repoFolder) : tempDir;
      await fs.access(sourcePath);
      const hash = await this.computeDirectoryHash(sourcePath);
      this.debug(`computeRemoteHash success: path=${source.skillPath} hash=${hash}`);
      return hash;
    } catch (error) {
      this.debug(`computeRemoteHash failed: url=${source.sourceUrl} path=${source.skillPath} error=${String(error)}`);
      return null;
    } finally {
      if (tempDir) {
        await cleanupTempDir(tempDir).catch(() => {});
      }
    }
  }

  private async computeDirectoryHash(dir: string): Promise<string> {
    const hash = createHash('sha256');

    const walk = async (currentDir: string, baseDir: string): Promise<void> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === SOURCE_METADATA_FILE) {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          hash.update(`dir:${relativePath}\n`);
          await walk(fullPath, baseDir);
        } else if (entry.isFile()) {
          hash.update(`file:${relativePath}\n`);
          const content = await fs.readFile(fullPath);
          hash.update(content);
          hash.update('\n');
        }
      }
    };

    await walk(dir, dir);
    return hash.digest('hex');
  }

  private async fetchGitHubFolderHash(
    ownerRepo: string,
    skillPath: string,
    preferredBranch?: string
  ): Promise<string | null> {
    let folderPath = skillPath.replace(/\\/g, '/');
    if (folderPath.endsWith('/SKILL.md')) {
      folderPath = folderPath.slice(0, -9);
    } else if (folderPath === 'SKILL.md') {
      folderPath = '';
    }

    const branches = preferredBranch
      ? [preferredBranch, 'main', 'master']
      : ['main', 'master'];
    const token = this.getGitHubToken();

    for (const branch of branches) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${ownerRepo}/git/trees/${branch}?recursive=1`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'VSCode-Skills-Extension/1.0',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          }
        );

        if (!response.ok) {
          continue;
        }

        const data = await response.json() as {
          sha: string;
          tree: Array<{ path: string; type: string; sha: string }>;
        };

        if (!folderPath) {
          return data.sha;
        }

        const folderEntry = data.tree.find(
          (entry) => entry.type === 'tree' && entry.path === folderPath
        );

        if (folderEntry) {
          return folderEntry.sha;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Skip certain directories
        if (entry.name === '.git' || entry.name.startsWith('_')) continue;
        await this.copyDirectory(srcPath, destPath);
      } else if (entry.isFile()) {
        // Skip certain files
        if (entry.name === 'metadata.json') continue;
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private withResolvedSkillPath(
    sourceMetadata: Partial<SkillSourceMetadata> | undefined,
    selectedSkillPath: string,
    rootPath: string
  ): Partial<SkillSourceMetadata> | undefined {
    if (!sourceMetadata) {
      return sourceMetadata;
    }
    const relative = path.relative(rootPath, selectedSkillPath).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const skillPath = relative ? `${relative}/SKILL.md` : 'SKILL.md';
    return {
      ...sourceMetadata,
      skillPath
    };
  }
}
