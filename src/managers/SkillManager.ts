import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { homedir } from 'os';
import { Skill, SkillSearchResult } from '../types';
import { getSupportedAgents, getAgentSkillsDir, detectInstalledAgents } from '../utils/agents';
import { parseSkillMd, sanitizeName } from '../utils/skills';
import { parseSource } from '../utils/source-parser';
import { cloneRepo, cleanupTempDir } from '../utils/git';

const AGENTS_DIR = '.agents';
const SKILLS_SUBDIR = 'skills';

/**
 * Manages skill operations (install, list, update, remove)
 */
export class SkillManager {
  constructor(
    private workspaceRoot: string | undefined,
    _globalStoragePath: string
  ) {}

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

        const scopeKey = global ? 'global' : 'project';
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
        } else {
          skillsMap.set(skillKey, {
            id: parsedSkill.name,
            name: parsedSkill.name,
            description: parsedSkill.description,
            source: {
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
            hasUpdate: false
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
    scope: 'project' | 'global'
  ): Promise<void> {
    const cwd = this.workspaceRoot || process.cwd();

    // 解析 source
    const parsedSource = parseSource(source);

    let skillPath: string;

    // 根据 source 类型获取技能路径
    if (parsedSource.type === 'local') {
      // 本地路径
      skillPath = parsedSource.localPath;
    } else {
      // 远程仓库 - 需要克隆
      const repoUrl = parsedSource.url;

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
        await this.installFromPath(skillPath, agents, scope, cwd);

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
    await this.installFromPath(skillPath, agents, scope, cwd);
  }

  /**
   * 从本地路径安装技能
   */
  private async installFromPath(
    skillPath: string,
    agents: string[],
    scope: 'project' | 'global',
    cwd: string
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

        // Ask user which skill to install
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
          return this.installFromPath(selectedSkill.path, agents, scope, cwd);
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
   * Check for updates (placeholder - will be implemented with git support)
   */
  async checkUpdates(skills: Skill[]): Promise<Skill[]> {
    // For now, return skills without updates
    // Git-based update checking will be implemented later
    return skills.map(skill => ({ ...skill, hasUpdate: false }));
  }

  /**
   * Update a skill (placeholder)
   */
  async updateSkill(_skill: Skill | SkillSearchResult, _agents: string[]): Promise<void> {
    // Git-based update will be implemented later
    vscode.window.showInformationMessage('Update functionality will be implemented with git support');
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
}
