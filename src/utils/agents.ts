import * as path from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

const home = homedir();
const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
const codexHome = process.env.CODEX_HOME?.trim() || path.join(home, '.codex');
const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(home, '.claude');

export interface AgentInfo {
  id: string;
  name: string;
  displayName: string;
  projectPath: string;
  globalPath: string;
  universal: boolean;
  detectInstalled?: () => boolean | Promise<boolean>;
}

/**
 * Agent configurations for all supported IDEs/AI coding tools
 * Copied from https://github.com/skills/library reference implementation
 */
export const SUPPORTED_AGENTS = [
  {
    id: 'amp',
    name: 'amp',
    displayName: 'Amp',
    projectPath: '.agents/skills',
    globalPath: path.join(configHome, 'agents/skills'),
    universal: true,
    detectInstalled: () => existsSync(path.join(configHome, 'amp')),
  },
  {
    id: 'antigravity',
    name: 'antigravity',
    displayName: 'Antigravity',
    projectPath: '.agent/skills',
    globalPath: path.join(home, '.gemini/antigravity/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.gemini/antigravity')),
  },
  {
    id: 'augment',
    name: 'augment',
    displayName: 'Augment',
    projectPath: '.augment/skills',
    globalPath: path.join(home, '.augment/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.augment')),
  },
  {
    id: 'claude-code',
    name: 'claude-code',
    displayName: 'Claude Code',
    projectPath: '.claude/skills',
    globalPath: path.join(claudeHome, 'skills'),
    universal: false,
    detectInstalled: () => existsSync(claudeHome),
  },
  {
    id: 'openclaw',
    name: 'openclaw',
    displayName: 'OpenClaw',
    projectPath: 'skills',
    globalPath: getOpenClawGlobalSkillsDir(),
    universal: false,
    detectInstalled: () =>
      existsSync(path.join(home, '.openclaw')) ||
      existsSync(path.join(home, '.clawdbot')) ||
      existsSync(path.join(home, '.moltbot')),
  },
  {
    id: 'cline',
    name: 'cline',
    displayName: 'Cline',
    projectPath: '.agents/skills',
    globalPath: path.join(home, '.agents', 'skills'),
    universal: true,
    detectInstalled: () => existsSync(path.join(home, '.cline')),
  },
  {
    id: 'codebuddy',
    name: 'codebuddy',
    displayName: 'CodeBuddy',
    projectPath: '.codebuddy/skills',
    globalPath: path.join(home, '.codebuddy/skills'),
    universal: false,
    detectInstalled: () => {
      const cwd = process.cwd();
      return existsSync(path.join(cwd, '.codebuddy')) || existsSync(path.join(home, '.codebuddy'));
    },
  },
  {
    id: 'codex',
    name: 'codex',
    displayName: 'Codex',
    projectPath: '.agents/skills',
    globalPath: path.join(codexHome, 'skills'),
    universal: true,
    detectInstalled: () => existsSync(codexHome) || existsSync('/etc/codex'),
  },
  {
    id: 'command-code',
    name: 'command-code',
    displayName: 'Command Code',
    projectPath: '.commandcode/skills',
    globalPath: path.join(home, '.commandcode/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.commandcode')),
  },
  {
    id: 'continue',
    name: 'continue',
    displayName: 'Continue',
    projectPath: '.continue/skills',
    globalPath: path.join(home, '.continue/skills'),
    universal: false,
    detectInstalled: () => {
      const cwd = process.cwd();
      return existsSync(path.join(cwd, '.continue')) || existsSync(path.join(home, '.continue'));
    },
  },
  {
    id: 'cortex',
    name: 'cortex',
    displayName: 'Cortex Code',
    projectPath: '.cortex/skills',
    globalPath: path.join(home, '.snowflake/cortex/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.snowflake/cortex')),
  },
  {
    id: 'crush',
    name: 'crush',
    displayName: 'Crush',
    projectPath: '.crush/skills',
    globalPath: path.join(home, '.config/crush/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.config/crush')),
  },
  {
    id: 'cursor',
    name: 'cursor',
    displayName: 'Cursor',
    projectPath: '.agents/skills',
    globalPath: path.join(home, '.cursor/skills'),
    universal: true,
    detectInstalled: () => existsSync(path.join(home, '.cursor')),
  },
  {
    id: 'droid',
    name: 'droid',
    displayName: 'Droid',
    projectPath: '.factory/skills',
    globalPath: path.join(home, '.factory/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.factory')),
  },
  {
    id: 'gemini-cli',
    name: 'gemini-cli',
    displayName: 'Gemini CLI',
    projectPath: '.agents/skills',
    globalPath: path.join(home, '.gemini/skills'),
    universal: true,
    detectInstalled: () => existsSync(path.join(home, '.gemini')),
  },
  {
    id: 'github-copilot',
    name: 'github-copilot',
    displayName: 'GitHub Copilot',
    projectPath: '.agents/skills',
    globalPath: path.join(home, '.copilot/skills'),
    universal: true,
    detectInstalled: () => existsSync(path.join(home, '.copilot')),
  },
  {
    id: 'goose',
    name: 'goose',
    displayName: 'Goose',
    projectPath: '.goose/skills',
    globalPath: path.join(configHome, 'goose/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(configHome, 'goose')),
  },
  {
    id: 'junie',
    name: 'junie',
    displayName: 'Junie',
    projectPath: '.junie/skills',
    globalPath: path.join(home, '.junie/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.junie')),
  },
  {
    id: 'iflow-cli',
    name: 'iflow-cli',
    displayName: 'iFlow CLI',
    projectPath: '.iflow/skills',
    globalPath: path.join(home, '.iflow/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.iflow')),
  },
  {
    id: 'kilo',
    name: 'kilo',
    displayName: 'Kilo Code',
    projectPath: '.kilocode/skills',
    globalPath: path.join(home, '.kilocode/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.kilocode')),
  },
  {
    id: 'kimi-cli',
    name: 'kimi-cli',
    displayName: 'Kimi Code CLI',
    projectPath: '.agents/skills',
    globalPath: path.join(home, '.config/agents/skills'),
    universal: true,
    detectInstalled: () => existsSync(path.join(home, '.kimi')),
  },
  {
    id: 'kiro-cli',
    name: 'kiro-cli',
    displayName: 'Kiro CLI',
    projectPath: '.kiro/skills',
    globalPath: path.join(home, '.kiro/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.kiro')),
  },
  {
    id: 'kode',
    name: 'kode',
    displayName: 'Kode',
    projectPath: '.kode/skills',
    globalPath: path.join(home, '.kode/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.kode')),
  },
  {
    id: 'mcpjam',
    name: 'mcpjam',
    displayName: 'MCPJam',
    projectPath: '.mcpjam/skills',
    globalPath: path.join(home, '.mcpjam/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.mcpjam')),
  },
  {
    id: 'mistral-vibe',
    name: 'mistral-vibe',
    displayName: 'Mistral Vibe',
    projectPath: '.vibe/skills',
    globalPath: path.join(home, '.vibe/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.vibe')),
  },
  {
    id: 'mux',
    name: 'mux',
    displayName: 'Mux',
    projectPath: '.mux/skills',
    globalPath: path.join(home, '.mux/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.mux')),
  },
  {
    id: 'opencode',
    name: 'opencode',
    displayName: 'OpenCode',
    projectPath: '.agents/skills',
    globalPath: path.join(configHome, 'opencode/skills'),
    universal: true,
    detectInstalled: () => existsSync(path.join(configHome, 'opencode')),
  },
  {
    id: 'openhands',
    name: 'openhands',
    displayName: 'OpenHands',
    projectPath: '.openhands/skills',
    globalPath: path.join(home, '.openhands/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.openhands')),
  },
  {
    id: 'pi',
    name: 'pi',
    displayName: 'Pi',
    projectPath: '.pi/skills',
    globalPath: path.join(home, '.pi/agent/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.pi/agent')),
  },
  {
    id: 'qoder',
    name: 'qoder',
    displayName: 'Qoder',
    projectPath: '.qoder/skills',
    globalPath: path.join(home, '.qoder/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.qoder')),
  },
  {
    id: 'qwen-code',
    name: 'qwen-code',
    displayName: 'Qwen Code',
    projectPath: '.qwen/skills',
    globalPath: path.join(home, '.qwen/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.qwen')),
  },
  {
    id: 'replit',
    name: 'replit',
    displayName: 'Replit',
    projectPath: '.agents/skills',
    globalPath: path.join(configHome, 'agents/skills'),
    universal: true,
    detectInstalled: () => existsSync(path.join(process.cwd(), '.replit')),
  },
  {
    id: 'roo',
    name: 'roo',
    displayName: 'Roo Code',
    projectPath: '.roo/skills',
    globalPath: path.join(home, '.roo/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.roo')),
  },
  {
    id: 'trae',
    name: 'trae',
    displayName: 'Trae',
    projectPath: '.trae/skills',
    globalPath: path.join(home, '.trae/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.trae')),
  },
  {
    id: 'trae-cn',
    name: 'trae-cn',
    displayName: 'Trae CN',
    projectPath: '.trae/skills',
    globalPath: path.join(home, '.trae-cn/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.trae-cn')),
  },
  {
    id: 'windsurf',
    name: 'windsurf',
    displayName: 'Windsurf',
    projectPath: '.windsurf/skills',
    globalPath: path.join(home, '.codeium/windsurf/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.codeium/windsurf')),
  },
  {
    id: 'zencoder',
    name: 'zencoder',
    displayName: 'Zencoder',
    projectPath: '.zencoder/skills',
    globalPath: path.join(home, '.zencoder/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.zencoder')),
  },
  {
    id: 'neovate',
    name: 'neovate',
    displayName: 'Neovate',
    projectPath: '.neovate/skills',
    globalPath: path.join(home, '.neovate/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.neovate')),
  },
  {
    id: 'pochi',
    name: 'pochi',
    displayName: 'Pochi',
    projectPath: '.pochi/skills',
    globalPath: path.join(home, '.pochi/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.pochi')),
  },
  {
    id: 'adal',
    name: 'adal',
    displayName: 'AdaL',
    projectPath: '.adal/skills',
    globalPath: path.join(home, '.adal/skills'),
    universal: false,
    detectInstalled: () => existsSync(path.join(home, '.adal')),
  },
] as const satisfies readonly AgentInfo[];

export type SupportedAgentId = (typeof SUPPORTED_AGENTS)[number]['id'];
export const SUPPORTED_AGENT_IDS = SUPPORTED_AGENTS.map((agent) => agent.id) as ReadonlyArray<SupportedAgentId>;

function getOpenClawGlobalSkillsDir(homeDir = home): string {
  if (existsSync(path.join(homeDir, '.openclaw'))) {
    return path.join(homeDir, '.openclaw/skills');
  }
  if (existsSync(path.join(homeDir, '.clawdbot'))) {
    return path.join(homeDir, '.clawdbot/skills');
  }
  if (existsSync(path.join(homeDir, '.moltbot'))) {
    return path.join(homeDir, '.moltbot/skills');
  }
  return path.join(homeDir, '.openclaw/skills');
}

export function getSupportedAgents(): AgentInfo[] {
  return [...SUPPORTED_AGENTS];
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
      if (agent.detectInstalled) {
        const installed = await agent.detectInstalled();
        if (installed) {
          detected.push(agent.id);
        }
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

/**
 * Get agents that use the universal .agents/skills directory
 */
export function getUniversalAgents(): string[] {
  return SUPPORTED_AGENTS
    .filter((agent) => agent.universal)
    .map((agent) => agent.id);
}

/**
 * Get agents that use agent-specific skill directories
 */
export function getNonUniversalAgents(): string[] {
  return SUPPORTED_AGENTS
    .filter((agent) => !agent.universal)
    .map((agent) => agent.id);
}
