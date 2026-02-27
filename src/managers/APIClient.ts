import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { SkillSearchResult, SkillAPIConfig } from '../types';
import { SkillCache } from './SkillCache';
import { cloneRepo, cleanupTempDir } from '../utils/git';
import { discoverSkillsInPath } from '../utils/skills';

export class APIClient {
  private skillCache?: SkillCache;
  private memoryCache = new Map<string, Promise<string>>(); // Prevent concurrent requests

  constructor(
    private configs: SkillAPIConfig[],
    private context?: vscode.ExtensionContext
  ) {
    if (context) {
      this.skillCache = new SkillCache(context);
    }
  }

  async searchSkills(query: string): Promise<SkillSearchResult[]> {
    const enabledConfigs = this.configs
      .filter(c => c.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const results = await Promise.allSettled(
      enabledConfigs.map(config => this.fetchFromAPI(config, query))
    );

    const allSkills = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    return this.deduplicateSkills(allSkills);
  }

  /**
   * Get trending/popular skills from GitHub
   * Searches for repositories with "skill" or "agent-skills" in topics, sorted by stars
   */
  async getTrendingSkills(limit: number = 10): Promise<SkillSearchResult[]> {
    try {
      // Search GitHub for repositories related to AI agent skills
      const searchQuery = 'topic:agent-skills OR topic:ai-skill OR topic:claude-skill OR topic:copilot-skill';
      const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=${limit}`;

      const responseData = await this.makeHttpsRequest(apiUrl);

      if (responseData && responseData.items && Array.isArray(responseData.items)) {
        return responseData.items.map((repo: any) => ({
          id: repo.full_name,
          name: repo.name.replace(/-/g, ' ').replace(/^skill/i, '').trim() || repo.name,
          description: repo.description || 'A skill for AI coding assistants',
          repository: repo.html_url,
          skillMdUrl: `${repo.html_url.replace('github.com', 'raw.githubusercontent.com')}/HEAD/SKILL.md`,
          version: undefined,
          stars: repo.stargazers_count || 0,
          updatedAt: repo.updated_at
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch trending skills:', error);
      return [];
    }
  }

  private async fetchFromAPI(
    config: SkillAPIConfig,
    query: string
  ): Promise<SkillSearchResult[]> {
    try {
      // Build API URL: append /api/search if not already present
      let baseUrl = config.url;
      if (!baseUrl.endsWith('/api/search')) {
        // Remove trailing slash if present
        baseUrl = baseUrl.replace(/\/$/, '');
        baseUrl += '/api/search';
      }

      const apiUrl = new url.URL(baseUrl);
      // Add search params to URL
      // Note: skills.sh API uses 'q' as the query parameter name
      apiUrl.searchParams.set('q', query);
      apiUrl.searchParams.set('limit', '10');

      const responseData = await this.makeHttpsRequest(apiUrl.toString());

      // Parse response based on expected API format
      // skills.sh API returns: { skills: [{ id, name, installs, source }] }
      if (responseData && typeof responseData === 'object') {
        if (Array.isArray(responseData.skills)) {
          return responseData.skills.map((skill: any) => this.normalizeSkillResult(skill, config.url));
        } else if (Array.isArray(responseData)) {
          // Handle direct array response
          return responseData.map((skill: any) => this.normalizeSkillResult(skill, config.url));
        }
      }

      return [];
    } catch (error) {
      console.error(`Failed to fetch from ${config.url}:`, error);
      return [];
    }
  }

  private normalizeSkillResult(skill: any, _apiUrl: string): SkillSearchResult {
    // Handle skills.sh API format: { id, name, installs, source }
    if (skill.source) {
      return this.parseSourceField(skill);
    }

    // Handle generic API format (already has full URLs)
    return {
      id: skill.id || skill.repository || `${skill.name || 'unknown'}`,
      name: skill.name || 'Unknown',
      description: skill.description || '',
      repository: skill.repository || skill.repo || '',
      skillId: skill.skillId,  // Pass through skillId for multi-skill repos
      skillMdUrl: skill.skillMdUrl || skill.skill_md_url || skill.readme_url || '',
      version: skill.version || skill.commit || skill.tag,
      stars: skill.stars || skill.star_count || 0,
      installs: skill.installs,
      updatedAt: skill.updatedAt || skill.updated_at || skill.last_updated
    };
  }

  /**
   * 规范化仓库 URL
   * 支持多种格式：
   * - GitHub: "owner/repo" → "https://github.com/owner/repo"
   * - GitLab: "gitlab.com/owner/repo" → "https://gitlab.com/owner/repo"
   * - 完整 URL: 直接返回
   *
   * @param input - 仓库 URL（可能不完整）
   * @returns 规范化后的完整仓库 URL
   */
  static normalizeRepositoryUrl(input: string): string {
    // 如果已经是完整的 HTTP(S) URL，直接返回
    if (input.startsWith('http://') || input.startsWith('https://')) {
      try {
        new URL(input);
        return input;
      } catch {
        // Invalid URL, try to fix it
      }
    }

    // Remove https:// or http:// prefix if present for easier parsing
    let source = input;
    if (source.startsWith('https://') || source.startsWith('http://')) {
      source = source.replace(/^https?:\/\//, '');
    }

    const parts = source.split('/');
    if (parts.length < 2) {
      // Invalid format, return as is
      return input;
    }

    const [hostname, owner, ...rest] = parts;
    const repoPath = [owner, ...rest].join('/');

    // Remove .git suffix if present
    const cleanRepoPath = repoPath.replace(/\.git$/, '');

    // Build repository URL
    return `https://${hostname}/${cleanRepoPath}.git`;
  }

  /**
   * Parse the 'source' field from skill data and convert to normalized format
   * Supports multiple formats:
   * - GitHub: "owner/repo" or "https://github.com/owner/repo"
   * - GitLab: "gitlab.com/owner/repo" or "https://gitlab.com/owner/repo"
   * - Custom Git host: "git.example.com/owner/repo" or "https://git.example.com/owner/repo"
   */
  private parseSourceField(skill: any): SkillSearchResult {
    let source = skill.source;

    // Remove https:// prefix if present for easier parsing
    if (source.startsWith('https://') || source.startsWith('http://')) {
      source = source.replace(/^https?:\/\//, '');
    }

    const parts = source.split('/');
    if (parts.length < 2) {
      // Invalid format, return minimal result
      return {
        id: skill.id || skill.name || 'unknown',
        name: skill.name || 'Unknown',
        description: skill.description || '',
        repository: '',
        skillMdUrl: '',
        version: undefined,
        stars: 0,
        updatedAt: undefined
      };
    }

    const [hostname, owner, ...rest] = parts;
    const repoPath = [owner, ...rest].join('/');

    // Remove .git suffix if present
    const cleanRepoPath = repoPath.replace(/\.git$/, '');

    // Build repository URL
    const repository = `https://${hostname}/${cleanRepoPath}.git`;

    // Build skill.md URL based on host
    let skillMdUrl = '';
    if (hostname === 'github.com') {
      skillMdUrl = `https://raw.githubusercontent.com/${cleanRepoPath}/HEAD/SKILL.md`;
    } else if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
      // GitLab format: https://gitlab.com/owner/repo/-/raw/main/SKILL.md
      skillMdUrl = `https://${hostname}/${cleanRepoPath}/-/raw/main/SKILL.md`;
    } else {
      // Generic Git host - try common patterns
      skillMdUrl = `https://${hostname}/${cleanRepoPath}/-/raw/main/SKILL.md`;
    }

    return {
      id: skill.id || cleanRepoPath,
      name: skill.name || 'Unknown',
      description: skill.installs
        ? `${this.formatInstalls(skill.installs)}`
        : skill.description || 'A skill for AI coding assistants',
      repository,
      skillId: skill.skillId,  // Pass through skillId for multi-skill repos
      skillMdUrl,
      version: undefined,
      stars: 0,
      installs: skill.installs,
      updatedAt: undefined
    };
  }

  private formatInstalls(count: number): string {
    if (!count || count <= 0) return '';
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M installs`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K installs`;
    return `${count} install${count === 1 ? '' : 's'}`;
  }

  private makeHttpsRequest(urlString: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new url.URL(urlString);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VSCode-Skills-Extension/1.0'
        },
        // Set timeout to 10 seconds
        timeout: 10000
      };

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (error) {
              reject(new Error(`Failed to parse response: ${error}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  private deduplicateSkills(skills: SkillSearchResult[]): SkillSearchResult[] {
    const map = new Map<string, SkillSearchResult>();

    for (const skill of skills) {
      const existing = map.get(skill.id);

      // Keep the skill with more metadata (prefer results with stars, version, etc.)
      if (!existing) {
        map.set(skill.id, skill);
      } else {
        const existingScore = this.calculateCompletenessScore(existing);
        const newScore = this.calculateCompletenessScore(skill);

        if (newScore > existingScore) {
          map.set(skill.id, skill);
        }
      }
    }

    return Array.from(map.values());
  }

  private calculateCompletenessScore(skill: SkillSearchResult): number {
    let score = 0;
    if (skill.name) score++;
    if (skill.description) score++;
    if (skill.repository) score++;
    if (skill.version) score++;
    if (skill.stars) score++;
    if (skill.installs) score++;
    if (skill.updatedAt) score++;
    return score;
  }

  /**
   * 从远程仓库获取 skill.md 并缓存
   * @param repositoryUrl - Git 仓库 URL
   * @param skillId - 技能唯一标识
   * @returns 返回缓存文件的绝对路径
   */
  async fetchRemoteSkillMd(
    repositoryUrl: string,
    skillId: string
  ): Promise<string> {
    if (!this.skillCache) {
      throw new Error('APIClient not initialized with context');
    }

    // Normalize repository URL to ensure it's in a valid format
    const normalizedUrl = APIClient.normalizeRepositoryUrl(repositoryUrl);
    console.log(`[APIClient] Normalized URL: ${repositoryUrl} -> ${normalizedUrl}`);

    // Check cache first
    const cached = await this.skillCache.getCachedSkillMd(skillId);
    if (cached) {
      console.log(`[APIClient] Cache hit for ${skillId}: ${cached}`);
      return cached;
    }

    console.log(`[APIClient] Cache miss for ${skillId}, fetching from ${normalizedUrl}`);

    // Check if there's already an in-flight request
    const existing = this.memoryCache.get(skillId);
    if (existing) {
      console.log(`[APIClient] Using in-flight request for ${skillId}`);
      return existing;
    }

    // Create new request
    const promise = this.fetchWithClone(normalizedUrl, skillId);
    this.memoryCache.set(skillId, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up memory cache after completion
      this.memoryCache.delete(skillId);
    }
  }

  private async fetchWithClone(
    repositoryUrl: string,
    skillId: string
  ): Promise<string> {
    let tempDir: string | null = null;

    try {
      console.log(`[APIClient] Cloning ${repositoryUrl}`);
      tempDir = await cloneRepo(repositoryUrl);

      console.log(`[APIClient] Looking for SKILL.md in ${tempDir}`);
      const skills = await discoverSkillsInPath(tempDir);

      if (skills.length === 0) {
        throw new Error(
          `No SKILL.md found in repository.\n\n` +
          `Checked locations:\n` +
          `- Repository root\n` +
          `- skills/\n` +
          `- .agents/skills/\n` +
          `- .claude/skills/\n\n` +
          `Please ensure the repository contains a valid SKILL.md file.`
        );
      }

      // Use the first skill found
      const skill = skills[0];
      console.log(`[APIClient] Found SKILL.md at ${skill.path}`);

      // Read the content
      const content = await fs.readFile(skill.path, 'utf-8');

      // Cache it
      const cachedPath = await this.skillCache!.cacheSkillMd(
        skillId,
        content,
        repositoryUrl
      );

      console.log(`[APIClient] Cached to ${cachedPath}`);
      return cachedPath;

    } catch (error) {
      // Handle GitCloneError specifically
      if (error instanceof Error && error.name === 'GitCloneError') {
        const gitError = error as any;
        if (gitError.isTimeout) {
          throw new Error(
            `Repository clone timed out after 60 seconds.\n\n` +
            `This may happen with:\n` +
            `- Large repositories\n` +
            `- Slow network connections\n` +
            `- Private repositories requiring authentication\n\n` +
            `Repository: ${repositoryUrl}`
          );
        }
        if (gitError.isAuthError) {
          throw new Error(
            `Authentication failed for repository.\n\n` +
            `This repository may be private or require authentication.\n` +
            `Repository: ${repositoryUrl}\n\n` +
            `Please ensure you have access to this repository.`
          );
        }
      }

      // Re-throw with original message
      throw error;
    } finally {
      if (tempDir) {
        console.log(`[APIClient] Cleaning up temp directory ${tempDir}`);
        await cleanupTempDir(tempDir);
      }
    }
  }
}
