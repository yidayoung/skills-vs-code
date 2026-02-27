/**
 * Provider types for multi-platform skill support
 * Based on npx skills provider architecture
 */

export interface ProviderMatch {
  /** Whether the URL matches this provider */
  matches: boolean;
  /** The source identifier for telemetry/storage (e.g., "github/owner/repo", "gitlab/owner/repo") */
  sourceIdentifier?: string;
}

/**
 * Remote skill representation
 */
export interface RemoteSkill {
  name: string;
  description: string;
  content: string;
  installName: string;
  sourceUrl: string;
  providerId: string;
  sourceIdentifier: string;
  metadata?: Record<string, any>;
}

/**
 * File/directory information from repository API
 */
export interface RepositoryFile {
  name: string;
  type: 'file' | 'dir' | 'submodule' | 'symlink';
  path: string;
  url?: string;
  download_url?: string;
}

/**
 * Parsed repository information
 */
export interface ParsedRepository {
  platform: 'github' | 'gitlab' | 'git';
  owner: string;
  repo: string;
  ref?: string;
  path: string;
}

/**
 * Interface for remote SKILL.md host providers.
 * Each provider knows how to:
 * - Detect if a URL belongs to it
 * - Fetch skill files from the repository
 * - Download complete folders
 * - Provide source identifiers for telemetry
 */
export interface HostProvider {
  /** Unique identifier for this provider (e.g., "github", "gitlab") */
  readonly id: string;

  /** Display name for this provider */
  readonly displayName: string;

  /**
   * Check if a URL matches this provider.
   * @param url - The URL to check
   * @returns Match result with optional source identifier
   */
  match(url: string): ProviderMatch;

  /**
   * Parse repository URL to extract components
   * @param url - Repository URL
   * @returns Parsed repository info or null
   */
  parseUrl(url: string): ParsedRepository | null;

  /**
   * Get API URL for fetching folder contents
   * @param repo - Parsed repository info
   * @returns API URL
   */
  getFolderApiUrl(repo: ParsedRepository): string;

  /**
   * Fetch contents of a directory
   * @param apiUrl - API URL for the directory
   * @returns Array of files/directories
   */
  fetchContents(apiUrl: string): Promise<RepositoryFile[]>;

  /**
   * Download a single file
   * @param file - File info
   * @param targetPath - Local path to save to
   */
  downloadFile(file: RepositoryFile, targetPath: string): Promise<void>;

  /**
   * Get the raw file URL for downloading
   * @param repo - Parsed repository info
   * @param filePath - Path to file in repository
   * @returns Raw file URL
   */
  getRawFileUrl(repo: ParsedRepository, filePath: string): string;
}

/**
 * Provider registry interface
 */
export interface ProviderRegistry {
  /**
   * Register a new provider.
   */
  register(provider: HostProvider): void;

  /**
   * Find a provider that matches the given URL.
   * @param url - The URL to match
   * @returns The matching provider or null
   */
  findProvider(url: string): HostProvider | null;

  /**
   * Get all registered providers.
   */
  getProviders(): HostProvider[];
}
