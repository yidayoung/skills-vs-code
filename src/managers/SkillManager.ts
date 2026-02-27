import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { homedir } from 'os';
import { Skill, InstalledVersion } from '../types';
import { getSupportedAgents, getAgentSkillsDir, detectInstalledAgents } from '../utils/agents';
import { parseSkillMd, sanitizeName } from '../utils/skills';

const AGENTS_DIR = '.agents';
const SKILLS_SUBDIR = 'skills';

/**
 * Manages skill operations (install, list, update, remove)
 */
export class SkillManager {
  constructor(
    private workspaceRoot: string | undefined,
    private globalStoragePath: string
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

    // Scan canonical and agent-specific directories
    for (const scope of scopes) {
      await this.scanDirectory(scope.path, scope.global, agentsToCheck, skillsMap);
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
   * Install a skill from a local path or remote repository
   */
  async installSkill(
    skillPath: string,
    agents: string[],
    scope: 'project' | 'global'
  ): Promise<void> {
    const cwd = this.workspaceRoot || process.cwd();

    // Parse the skill to get its metadata
    const skillMdPath = path.join(skillPath, 'SKILL.md');
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
  async updateSkill(skill: Skill, agents: string[]): Promise<void> {
    // Git-based update will be implemented later
    vscode.window.showInformationMessage('Update functionality will be implemented with git support');
  }

  /**
   * Remove a skill
   */
  async removeSkill(skillId: string, agents: string[], scope: 'project' | 'global'): Promise<void> {
    const cwd = this.workspaceRoot || process.cwd();
    const skillName = sanitizeName(skillId);

    for (const agentId of agents) {
      const agent = getSupportedAgents().find(a => a.id === agentId);
      if (!agent) continue;

      let skillDir: string;

      if (agent.universal) {
        skillDir = path.join(
          scope === 'global' ? homedir() : cwd,
          AGENTS_DIR,
          SKILLS_SUBDIR,
          skillName
        );
      } else {
        const agentBase = getAgentSkillsDir(agentId, scope === 'global', cwd);
        skillDir = path.join(agentBase, skillName);
      }

      try {
        await fs.rm(skillDir, { recursive: true, force: true });
      } catch (error) {
        vscode.window.showWarningMessage(
          `Failed to remove skill from ${agent.displayName}: ${error}`
        );
      }
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
