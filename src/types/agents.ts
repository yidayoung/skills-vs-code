/**
 * Information about a supported agent/IDE
 */
export interface AgentInfo {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Project-relative install path */
  projectPath: string;
  /** Global install path */
  globalPath: string;
}

/**
 * All supported agents
 */
export type SupportedAgent =
  | 'claude-code'
  | 'cursor'
  | 'cline';

/**
 * Agent selection for installation
 */
export interface AgentSelection {
  /** Agent identifier */
  agent: SupportedAgent;
  /** Whether selected for installation */
  selected: boolean;
}
