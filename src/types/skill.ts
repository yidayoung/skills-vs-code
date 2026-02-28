/**
 * Represents a skill that can be installed to various agents
 */
export interface Skill {
  /** Unique identifier: owner/repo/skill-name */
  id: string;
  /** Name from SKILL.md frontmatter */
  name: string;
  /** Description from SKILL.md frontmatter */
  description: string;
  /** Source information (local or remote) */
  source: SkillSource;
  /** Installed versions across agents */
  installedVersions?: InstalledVersion[];
  /** Latest version (commit hash or tag) */
  latestVersion?: string;
  /** Whether an update is available */
  hasUpdate: boolean;
  /** Additional metadata */
  metadata?: SkillMetadata;
}

/**
 * Information about where a skill comes from
 */
export interface SkillSource {
  /** Type of source */
  type: 'local' | 'remote';
  /** GitHub repository: owner/repo */
  repository?: string;
  /** Original source URL used for installation */
  sourceUrl?: string;
  /** Source provider type */
  sourceType?: 'github' | 'gitlab' | 'git';
  /** Source owner/repo for update checks */
  ownerRepo?: string;
  /** Relative path to SKILL.md in source repository */
  skillPath?: string;
  /** Marketplace skill identifier for matching installed skills */
  skillId?: string;
  /** Branch/ref used for source */
  sourceRef?: string;
  /** Last known source folder hash */
  skillFolderHash?: string;
  /** Local installed skill folder hash */
  installedHash?: string;
  /** Last fetched remote skill folder hash */
  lastRemoteHash?: string;
  /** API URL this came from */
  apiUrl?: string;
  /** Local file system path */
  localPath?: string;
  /** Path to the SKILL.md file */
  skillMdPath: string;
}

/**
 * Represents a skill installed to a specific agent
 */
export interface InstalledVersion {
  /** Agent identifier (claude-code, cursor, etc.) */
  agent: string;
  /** Installation scope */
  scope: 'project' | 'global';
  /** File system path */
  path: string;
  /** Installation method */
  installMethod: 'symlink' | 'copy';
  /** Version (commit hash or tag) */
  version?: string;
}

/**
 * Additional metadata about a skill
 */
export interface SkillMetadata {
  /** Whether this is an internal skill */
  internal?: boolean;
  /** Author name */
  author?: string;
  /** Homepage URL */
  homepage?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Installation scope
 */
export type Scope = 'project' | 'global';

/**
 * Installation method
 */
export type InstallMethod = 'symlink' | 'copy';
