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
  /** Marketplace name (e.g., "Skills.sh", "Community Hub") */
  marketName?: string;
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

/**
 * Generic API skill data from various sources
 * Used for parsing responses from different marketplace APIs
 */
export interface APISkillData {
  /** Skill identifier */
  id?: string;
  /** Full name (GitHub API: owner/repo) */
  full_name?: string;
  /** Skill name */
  name?: string;
  /** Skill description */
  description?: string;
  /** Repository URL or owner/repo format */
  repository?: string;
  /** Repository in owner/repo format */
  repo?: string;
  /** HTML URL to repository (GitHub API) */
  html_url?: string;
  /** Install count */
  installs?: number;
  /** Star count */
  stars?: number;
  /** Star count (alternative field) */
  star_count?: number;
  /** Stargazers count (GitHub API) */
  stargazers_count?: number;
  /** Version/commit/tag */
  version?: string;
  /** Commit hash */
  commit?: string;
  /** Tag name */
  tag?: string;
  /** Last updated timestamp */
  updatedAt?: string;
  updated_at?: string;
  last_updated?: string;
  /** Source field (owner/repo format) */
  source?: string;
  /** Multi-skill repository identifier */
  skillId?: string;
  /** Direct skill.md URL */
  skillMdUrl?: string;
  skill_md_url?: string;
  readme_url?: string;
}
