import * as path from 'path';
import * as fs from 'fs/promises';
import { homedir } from 'os';
import { existsSync } from 'fs';

const home = homedir();
const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(home, '.claude');

export interface AgentInfo {
  id: string;
  name: string;
  displayName: string;
  projectPath: string;
  globalPath: string;
  universal: boolean;
}

export const SUPPORTED_AGENTS: AgentInfo[] = [
  {
    id: 'claude-code',
    name: 'claude-code',
    displayName: 'Claude Code',
    projectPath: '.agents/skills',
    globalPath: path.join(home, '.agents', 'skills'),
    universal: true
  },
  {
    id: 'cursor',
    name: 'cursor',
    displayName: 'Cursor',
    projectPath: '.cursor/skills',
    globalPath: path.join(home, '.cursor', 'skills'),
    universal: false
  },
  {
    id: 'cline',
    name: 'cline',
    displayName: 'Cline',
    projectPath: '.agents/skills',
    globalPath: path.join(home, '.agents', 'skills'),
    universal: true
  }
];

export function getSupportedAgents(): AgentInfo[] {
  return SUPPORTED_AGENTS;
}

export function getAgentById(id: string): AgentInfo | undefined {
  return SUPPORTED_AGENTS.find(a => a.id === id);
}

/**
 * Detect which agents are installed on the system
 */
export async function detectInstalledAgents(): Promise<string[]> {
  const detected: string[] = [];

  for (const agent of SUPPORTED_AGENTS) {
    try {
      const globalDir = agent.universal
        ? path.join(homedir(), '.agents', 'skills')
        : agent.globalPath;

      // Check if global directory exists or parent directory exists
      const checkPath = agent.universal
        ? path.join(homedir(), '.agents')
        : path.dirname(agent.globalPath);

      const exists = existsSync(checkPath);
      if (exists) {
        detected.push(agent.id);
      }
    } catch {
      // Skip if detection fails
    }
  }

  return detected;
}

/**
 * Get the canonical skills directory (.agents/skills or ~/.agents/skills)
 */
export function getCanonicalSkillsDir(global: boolean, cwd?: string): string {
  const base = global ? homedir() : (cwd || process.cwd());
  return path.join(base, '.agents', 'skills');
}

/**
 * Get the skills directory for a specific agent
 */
export function getAgentSkillsDir(
  agentId: string,
  global: boolean,
  cwd?: string
): string {
  const agent = getAgentById(agentId);
  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  // Universal agents always use canonical directory
  if (agent.universal) {
    return getCanonicalSkillsDir(global, cwd);
  }

  const base = global ? homedir() : (cwd || process.cwd());
  return path.join(base, agent.projectPath);
}
