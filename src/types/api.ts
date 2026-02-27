/**
 * Configuration for a skill marketplace API
 */
export interface SkillAPIConfig {
  /** API URL */
  url: string;
  /** Whether this API is enabled */
  enabled: boolean;
  /** Display name */
  name?: string;
  /** Priority for sorting (higher first) */
  priority?: number;
}

/**
 * Response from skill search API
 */
export interface SkillSearchResponse {
  /** Search results */
  skills: SkillSearchResult[];
  /** Total number of results */
  total: number;
  /** Page number (if paginated) */
  page?: number;
}

/**
 * A skill from marketplace search results
 */
export interface SkillSearchResult {
  /** Unique identifier */
  id: string;
  /** Skill name */
  name: string;
  /** Skill description */
  description: string;
  /** Git repository URL (used for cloning) */
  repository: string;
  /**
   * Skill subdirectory name for multi-skill repositories
   * e.g., "my-skill" for a repository with skills/my-skill/SKILL.md
   */
  skillId?: string;
  /**
   * @deprecated Use `repository` with `fetchRemoteSkillMd()` instead.
   * Direct URL to fetch SKILL.md (legacy, may not work for private repos)
   */
  skillMdUrl?: string;
  /** Version (commit or tag) */
  version?: string;
  /** GitHub stars count */
  stars?: number;
  /** Installation count (from skills.sh) */
  installs?: number;
  /** Last updated timestamp */
  updatedAt?: string;
}

/**
 * Cached skill content
 */
export interface CachedSkill {
  /** Original URL */
  url: string;
  /** File content */
  content: string;
  /** Cache timestamp */
  timestamp: number;
  /** Content size in bytes */
  size: number;
}
