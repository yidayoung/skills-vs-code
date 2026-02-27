/**
 * Supported agent configurations
 * Based on npx skills src/agents.ts
 */
export interface AgentInfo {
  id: string;
  name: string;
  projectPath: string;
  globalPath: string;
}

export const SUPPORTED_AGENTS: AgentInfo[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    projectPath: '.claude/skills',
    globalPath: '.claude/skills'
  },
  {
    id: 'cursor',
    name: 'Cursor',
    projectPath: '.agents/skills',
    globalPath: '.cursor/skills'
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    projectPath: '.agents/skills',
    globalPath: '.config/opencode/skills'
  }
];

export function getSupportedAgents(): AgentInfo[] {
  return SUPPORTED_AGENTS;
}
