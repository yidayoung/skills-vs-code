/**
 * Type definitions for webview components
 */

// Agent ids are resolved at runtime from extension data; keep webview type flexible.
export type SupportedAgent = string;

export interface AgentInfo {
  id: string;
  name: string;
  displayName: string;
  projectPath: string;
  globalPath: string;
  universal: boolean;
}

// Skill types
export interface Skill {
  id: string;
  name: string;
  description: string;
  source?: {
    type: 'local' | 'remote';
    repository?: string;
    skillId?: string;
    sourceUrl?: string;
    localPath?: string;
    skillMdPath: string;
  };
  installedVersions?: InstalledVersion[];
  hasUpdate?: boolean;
  stars?: number;
  installs?: number;
  updatedAt?: string;
}

export interface InstalledVersion {
  agent: SupportedAgent;
  scope: 'project' | 'global';
  path: string;
  installMethod?: 'symlink' | 'copy';
  version?: string;
}

// Card props
export interface SkillCardProps {
  id: string;
  name: string;
  description: string;
  agentType: SupportedAgent;
  scope: 'project' | 'global';
  installed?: boolean;
  hasUpdate?: boolean;
  repository?: string;
  skillMdUrl?: string;
  source?: {
    type: 'local' | 'remote';
    skillMdPath?: string;
    skillId?: string;
    sourceUrl?: string;
    localPath?: string;
  };
  stars?: number;
  installs?: number;
  updatedAt?: string;
  /** Marketplace name (for uninstalled skills) */
  marketName?: string;
  /** Whether marketplace skill is already installed locally */
  marketInstalled?: boolean;
  onInstall?: () => void;
  onRemove?: () => void;
  onUpdate?: () => void;
  onViewDetails?: () => void;
}

// IDE Tag configuration for common agents
export const IDE_TAG_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
}> = {
  'universal': {
    label: '通用',
    color: '#6B7280',
    bg: 'rgba(107, 114, 128, 0.15)',
    borderColor: 'rgba(107, 114, 128, 0.3)',
  },
  'claude-code': {
    label: 'Claude',
    color: '#D97706', // 橙色
    bg: 'rgba(217, 119, 6, 0.15)',
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  'cursor': {
    label: 'Cursor',
    color: '#8B5CF6', // 紫色
    bg: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  'cline': {
    label: 'Cline',
    color: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  'github-copilot': {
    label: 'Copilot',
    color: '#000000',
    bg: 'rgba(0, 0, 0, 0.1)',
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  'continue': {
    label: 'Continue',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  'windsurf': {
    label: 'Windsurf',
    color: '#06B6D4',
    bg: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  'codex': {
    label: 'Codex',
    color: '#EC4899',
    bg: 'rgba(236, 72, 153, 0.15)',
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  'roo': {
    label: 'Roo',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  'kilo': {
    label: 'Kilo',
    color: '#A855F7', // 紫色
    bg: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  'replit': {
    label: 'Replit',
    color: '#6366F1', // 靛蓝色
    bg: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  'junie': {
    label: 'Junie',
    color: '#14B8A6', // 青色
    bg: 'rgba(20, 184, 166, 0.15)',
    borderColor: 'rgba(20, 184, 166, 0.3)',
  },
  'aider': {
    label: 'Aider',
    color: '#F97316', // 橙色
    bg: 'rgba(249, 115, 22, 0.15)',
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  'cursor-small': {
    label: 'Cursor',
    color: '#8B5CF6', // 紫色
    bg: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
};

/**
 * Get tag configuration for an agent, with fallback for unknown agents
 */
export function getAgentTagConfig(agentId: string): {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
} {
  if (IDE_TAG_CONFIG[agentId]) {
    return IDE_TAG_CONFIG[agentId];
  }

  // Generate default configuration for unknown agents
  return {
    label: agentId.replace('-', ' ').replace(/^\w/, c => c.toUpperCase()),
    color: '#6B7280',
    bg: 'rgba(107, 114, 128, 0.1)',
    borderColor: 'rgba(107, 114, 128, 0.2)',
  };
}
