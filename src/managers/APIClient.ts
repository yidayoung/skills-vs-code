import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { SkillSearchResult, SkillAPIConfig, APISkillData, LeaderboardView, SkillLeaderboardResponse } from '../types';
import { SkillCache } from './SkillCache';
import { cloneRepo, cleanupTempDir } from '../utils/git';
import { discoverSkillsInPath } from '../utils/skills';
import { parseSource, buildSkillId, normalizeRepositoryUrl as normalizeRepoUrl } from '../utils/source-parser';

// API constants
const DEFAULT_SEARCH_LIMIT = 10;
const API_TIMEOUT_MS = 10000; // 10 seconds
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
const API_SEARCH_ENDPOINT = '/api/search';
const API_LEADERBOARD_ENDPOINT = '/api/skills';
const SEARCH_PARAM_QUERY = 'q';
const SEARCH_PARAM_LIMIT = 'limit';

export class APIClient {
  private skillCache?: SkillCache;
  private memoryCache = new Map<string, Promise<string>>(); // Prevent concurrent requests

  constructor(
    private configs: SkillAPIConfig[],
    context?: vscode.ExtensionContext
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

  async getLeaderboardSkills(
    view: LeaderboardView,
    page: number = 0
  ): Promise<SkillLeaderboardResponse> {
    const enabledConfigs = this.configs
      .filter(c => c.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const results = await Promise.allSettled(
      enabledConfigs.map(config => this.fetchLeaderboardFromAPI(config, view, page))
    );

    const fulfilled = results
      .filter((result): result is PromiseFulfilledResult<SkillLeaderboardResponse> => result.status === 'fulfilled')
      .map(result => result.value);

    const mergedSkills = this.deduplicateSkills(
      fulfilled.flatMap(result => result.skills)
    );

    return {
      skills: mergedSkills,
      total: fulfilled.length > 0
        ? Math.max(...fulfilled.map(result => result.total), mergedSkills.length)
        : 0,
      page,
      hasMore: fulfilled.some(result => result.hasMore)
    };
  }

  async testMarketConfig(config: SkillAPIConfig): Promise<{
    searchOk: boolean;
    leaderboardOk: boolean;
    searchError?: string;
    leaderboardError?: string;
  }> {
    const parsedBase = new url.URL(config.url);
    const baseOrigin = parsedBase.origin;

    const searchUrl = new url.URL(`${baseOrigin}${API_SEARCH_ENDPOINT}`);
    searchUrl.searchParams.set(SEARCH_PARAM_QUERY, 'test');
    searchUrl.searchParams.set(SEARCH_PARAM_LIMIT, '1');

    const leaderboardUrl = `${baseOrigin}${API_LEADERBOARD_ENDPOINT}/all-time/0`;

    const result: {
      searchOk: boolean;
      leaderboardOk: boolean;
      searchError?: string;
      leaderboardError?: string;
    } = {
      searchOk: false,
      leaderboardOk: false
    };

    try {
      const searchData = await this.makeHttpsRequest(searchUrl.toString());
      result.searchOk = Array.isArray(searchData?.skills) || Array.isArray(searchData);
      if (!result.searchOk) {
        result.searchError = 'Invalid search response shape';
      }
    } catch (error) {
      result.searchOk = false;
      result.searchError = error instanceof Error ? error.message : String(error);
    }

    try {
      const leaderboardData = await this.makeHttpsRequest(leaderboardUrl);
      result.leaderboardOk = Array.isArray(leaderboardData?.skills);
      if (!result.leaderboardOk) {
        result.leaderboardError = 'Invalid leaderboard response shape';
      }
    } catch (error) {
      result.leaderboardOk = false;
      result.leaderboardError = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Get trending/popular skills from GitHub
   * Searches for repositories with "skill" or "agent-skills" in topics, sorted by stars
   */
  async getTrendingSkills(limit: number = DEFAULT_SEARCH_LIMIT): Promise<SkillSearchResult[]> {
    try {
      // Search GitHub for repositories related to AI agent skills
      const searchQuery = 'topic:agent-skills OR topic:ai-skill OR topic:claude-skill OR topic:copilot-skill';
      const apiUrl = `${GITHUB_API_BASE}/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=${limit}`;

      const responseData = await this.makeHttpsRequest(apiUrl);

      if (responseData && responseData.items && Array.isArray(responseData.items)) {
        return responseData.items.map((repo: APISkillData) => ({
          id: repo.full_name || repo.id || 'unknown',
          name: (repo.name || '').replace(/-/g, ' ').replace(/^skill/i, '').trim() || repo.name || 'Unknown',
          description: repo.description || 'A skill for AI coding assistants',
          repository: repo.html_url || repo.repository || '',
          skillMdUrl: repo.html_url ? `${repo.html_url.replace('github.com', 'raw.githubusercontent.com')}/HEAD/SKILL.md` : undefined,
          version: undefined,
          stars: repo.stargazers_count || repo.stars || 0,
          updatedAt: repo.updated_at || repo.updatedAt,
          marketName: 'GitHub Trending'
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
      // 提前计算 marketName，避免重复和潜在的 URL 解析错误
      let marketName: string | undefined;
      try {
        marketName = config.name || new URL(config.url).hostname;
      } catch {
        marketName = config.name;  // URL 解析失败时使用 config.name 或 undefined
      }

      // Keep config simple: URL should be a base host without path, then append /api/search.
      const parsedBase = new url.URL(config.url);
      const apiUrl = new url.URL(`${parsedBase.origin}${API_SEARCH_ENDPOINT}`);
      // Add search params to URL
      // Note: skills.sh API uses 'q' as the query parameter name
      apiUrl.searchParams.set(SEARCH_PARAM_QUERY, query);
      apiUrl.searchParams.set(SEARCH_PARAM_LIMIT, String(DEFAULT_SEARCH_LIMIT));

      const responseData = await this.makeHttpsRequest(apiUrl.toString());

      // Parse response based on expected API format
      // skills.sh API returns: { skills: [{ id, name, installs, source }] }
      if (responseData && typeof responseData === 'object') {
        if (Array.isArray(responseData.skills)) {
          return responseData.skills.map((skill: APISkillData) =>
            this.normalizeSkillResult(skill, config.url, marketName)
          );
        } else if (Array.isArray(responseData)) {
          // Handle direct array response
          return responseData.map((skill: APISkillData) =>
            this.normalizeSkillResult(skill, config.url, marketName)
          );
        }
      }

      return [];
    } catch (error) {
      console.error(`Failed to fetch from ${config.url}:`, error);
      return [];
    }
  }

  private async fetchLeaderboardFromAPI(
    config: SkillAPIConfig,
    view: LeaderboardView,
    page: number
  ): Promise<SkillLeaderboardResponse> {
    try {
      let marketName: string | undefined;
      try {
        marketName = config.name || new URL(config.url).hostname;
      } catch {
        marketName = config.name;
      }

      const parsedBase = new url.URL(config.url);
      const apiUrl = new url.URL(`${parsedBase.origin}${API_LEADERBOARD_ENDPOINT}/${view}/${page}`);
      const responseData = await this.makeHttpsRequest(apiUrl.toString());

      if (!responseData || typeof responseData !== 'object') {
        return { skills: [], total: 0, page, hasMore: false };
      }

      const rawSkills = Array.isArray(responseData.skills) ? responseData.skills : [];
      const normalizedSkills = rawSkills.map((skill: APISkillData) =>
        this.normalizeSkillResult(skill, config.url, marketName)
      );

      return {
        skills: normalizedSkills,
        total: typeof responseData.total === 'number' ? responseData.total : normalizedSkills.length,
        page: typeof responseData.page === 'number' ? responseData.page : page,
        hasMore: Boolean(responseData.hasMore)
      };
    } catch (error) {
      console.error(`Failed to fetch leaderboard from ${config.url}:`, error);
      return { skills: [], total: 0, page, hasMore: false };
    }
  }

  private normalizeSkillResult(skill: APISkillData, _apiUrl: string, marketName?: string): SkillSearchResult {
    // Handle skills.sh API format: { id, name, installs, source }
    if (skill.source) {
      return this.parseSourceField(skill, marketName);
    }

    // Handle generic API format (already has full URLs)
    const baseId = skill.id || skill.repository || `${skill.name || 'unknown'}`;
    const resolvedSkillId = this.resolveSkillId(skill);

    return {
      id: this.buildUniqueResultId(baseId, resolvedSkillId),
      name: skill.name || 'Unknown',
      description: skill.description || '',
      repository: skill.repository || skill.repo || '',
      skillId: resolvedSkillId,
      skillMdUrl: skill.skillMdUrl || skill.skill_md_url || skill.readme_url || '',
      version: skill.version || skill.commit || skill.tag,
      stars: skill.stars || skill.star_count || 0,
      installs: skill.installs,
      updatedAt: skill.updatedAt || skill.updated_at || skill.last_updated,
      marketName  // 添加 marketName 字段
    };
  }

  /**
   * 规范化仓库 URL
   * 支持多种格式：
   * - GitHub: "owner/repo" → "https://github.com/owner/repo.git"
   * - GitLab: "gitlab.com/owner/repo" → "https://gitlab.com/owner/repo.git"
   * - 完整 URL: 直接返回（如果有效）
   *
   * @param input - 仓库 URL（可能不完整）
   * @returns 规范化后的完整仓库 URL
   */
  static normalizeRepositoryUrl(input: string): string {
    return normalizeRepoUrl(input);
  }

  /**
   * Parse the 'source' field from skill data and convert to normalized format
   * 使用新的 source-parser 模块
   *
   * 支持多种格式：
   * - GitHub: "owner/repo" or "https://github.com/owner/repo"
   * - GitLab: "gitlab.com/owner/repo" or "https://gitlab.com/owner/repo"
   * - Custom Git host: "git.example.com/owner/repo" or "https://git.example.com/owner/repo"
   */
  private parseSourceField(skill: APISkillData, marketName?: string): SkillSearchResult {
    const source = skill.source;

    if (!source) {
      throw new Error('Skill source is required');
    }

    // 使用新的 source parser
    const parsed = parseSource(source);

    let repository = '';
    let skillMdUrl = '';
    let id = skill.id || source;
    let sourceBaseId = '';
    let sourceSubpath = '';

    // 根据解析结果构建 repository URL 和 skill.md URL
    switch (parsed.type) {
      case 'github': {
        repository = parsed.url;
        // 构建原始内容 URL
        const path = parsed.subpath ? `${parsed.subpath}/` : '';
        skillMdUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/HEAD/${path}SKILL.md`;
        sourceBaseId = `${parsed.owner}/${parsed.repo}`;
        sourceSubpath = parsed.subpath || '';
        id = sourceBaseId;
        break;
      }
      case 'gitlab': {
        repository = parsed.url;
        const path = parsed.subpath ? `${parsed.subpath}/` : '';
        skillMdUrl = `https://${parsed.hostname}/${parsed.repoPath}/-/raw/HEAD/${path}SKILL.md`;
        sourceBaseId = `${parsed.hostname}/${parsed.repoPath}`;
        sourceSubpath = parsed.subpath || '';
        id = sourceBaseId;
        break;
      }
      case 'local': {
        // 本地路径不应该出现在 API 返回中，但作为后备处理
        repository = parsed.localPath;
        skillMdUrl = '';
        id = parsed.localPath;
        break;
      }
      default:
        // 对于其他类型（git, direct-url, well-known），使用解析后的 URL
        repository = parsed.url;
        // 尝试构建 skill.md URL（仅对于 git 类型）
        if (parsed.type === 'git') {
          try {
            const url = new URL(repository);
            const hostname = url.hostname;
            let cleanRepoPath = url.pathname.replace(/\.git$/, '');
            if (cleanRepoPath.startsWith('/')) {
              cleanRepoPath = cleanRepoPath.slice(1);
            }

            if (hostname === 'github.com') {
              skillMdUrl = `https://raw.githubusercontent.com/${cleanRepoPath}/HEAD/SKILL.md`;
            } else if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
              skillMdUrl = `https://${hostname}/${cleanRepoPath}/-/raw/HEAD/SKILL.md`;
            } else {
              skillMdUrl = `https://${hostname}/${cleanRepoPath}/-/raw/HEAD/SKILL.md`;
            }
          } catch {
            // URL 解析失败
            skillMdUrl = '';
          }
        }
        break;
    }

    const resolvedSkillId = this.resolveSkillId(skill, sourceBaseId, sourceSubpath);

    return {
      id: this.buildUniqueResultId(id, resolvedSkillId),
      name: skill.name || 'Unknown',
      description: skill.description || '',
      repository,
      skillId: resolvedSkillId,
      skillMdUrl,
      version: undefined,
      stars: 0,
      installs: skill.installs,
      updatedAt: undefined,
      marketName  // 添加 marketName 字段
    };
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
        // Set timeout
        timeout: API_TIMEOUT_MS
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
      const uniqueKey = this.getDeduplicationKey(skill);
      const existing = map.get(uniqueKey);

      // Keep the skill with more metadata (prefer results with stars, version, etc.)
      if (!existing) {
        map.set(uniqueKey, skill);
      } else {
        const existingScore = this.calculateCompletenessScore(existing);
        const newScore = this.calculateCompletenessScore(skill);

        if (newScore > existingScore) {
          map.set(uniqueKey, skill);
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

  private buildUniqueResultId(baseId: string, skillId?: string): string {
    if (!skillId || !skillId.trim()) {
      return baseId;
    }
    return `${baseId}#${skillId}`;
  }

  private resolveSkillId(skill: APISkillData, sourceBaseId?: string, sourceSubpath?: string): string | undefined {
    const explicit = this.normalizeSkillIdValue(skill.skillId);
    if (explicit) {
      return explicit;
    }

    const fromSubpath = this.extractSkillIdFromPathLike(sourceSubpath);
    if (fromSubpath) {
      return fromSubpath;
    }

    const fromSource = this.extractSkillIdFromValueWithBase(skill.id, sourceBaseId)
      || this.extractSkillIdFromPathLike(skill.id)
      || this.extractSkillIdFromPathLike(skill.full_name)
      || this.extractSkillIdFromPathLike(skill.repository)
      || this.extractSkillIdFromPathLike(skill.repo);

    return this.normalizeSkillIdValue(fromSource);
  }

  private normalizeSkillIdValue(value?: string): string | undefined {
    const normalized = (value || '').trim().replace(/^\/+|\/+$/g, '');
    return normalized.length > 0 ? normalized : undefined;
  }

  private extractSkillIdFromValueWithBase(value?: string, base?: string): string | undefined {
    if (!value || !base) {
      return undefined;
    }
    const normalizedValue = value.trim().replace(/^\/+|\/+$/g, '');
    const normalizedBase = base.trim().replace(/^\/+|\/+$/g, '');
    const prefix = `${normalizedBase}/`;
    if (normalizedValue.startsWith(prefix)) {
      return normalizedValue.slice(prefix.length);
    }
    return undefined;
  }

  private extractSkillIdFromPathLike(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    let text = value.trim();
    if (!text) {
      return undefined;
    }

    if (text.includes('#')) {
      const hashPart = text.split('#').pop();
      return this.normalizeSkillIdValue(hashPart);
    }

    try {
      const parsed = new URL(text);
      text = parsed.pathname;
    } catch {
      // Keep original text when not a URL.
    }

    text = text.replace(/^\/+|\/+$/g, '');
    if (!text) {
      return undefined;
    }

    const segments = text.split('/').filter(Boolean);
    const skillsIndex = segments.findIndex(seg => seg.toLowerCase() === 'skills');
    if (skillsIndex >= 0 && skillsIndex < segments.length - 1) {
      return this.normalizeSkillIdValue(segments.slice(skillsIndex + 1).join('/'));
    }

    if (segments.length >= 3) {
      return this.normalizeSkillIdValue(segments.slice(2).join('/'));
    }

    return undefined;
  }

  private getDeduplicationKey(skill: SkillSearchResult): string {
    return `${skill.id}::${skill.skillId || ''}`;
  }

  /**
   * 从远程仓库获取 skill.md 并缓存
   * @param repositoryUrl - Git 仓库 URL
   * @param skillId - 技能唯一标识
   * @param subSkillName - 子技能名称（用于多技能仓库，如 "postgres"）
   * @returns 返回缓存文件的绝对路径
   */
  async fetchRemoteSkillMd(
    repositoryUrl: string,
    skillId: string,
    subSkillName?: string
  ): Promise<string> {
    if (!this.skillCache) {
      throw new Error('APIClient not initialized with context');
    }

    // 使用新的 source parser 规范化 URL
    const normalizedUrl = normalizeRepoUrl(repositoryUrl);

    // 构建完整的缓存 key（包含子技能名称）
    const fullSkillId = subSkillName ? `${skillId}@${subSkillName}` : skillId;
    const safeSkillId = fullSkillId.replace(/\//g, '-');

    const cached = await this.skillCache.getCachedSkillMd(safeSkillId);
    if (cached) {
      return cached;
    }

    // Check if there's already an in-flight request
    const existing = this.memoryCache.get(fullSkillId);
    if (existing) {
      return existing;
    }

    // Create new request
    const promise = this.fetchWithClone(normalizedUrl, skillId, subSkillName);
    this.memoryCache.set(fullSkillId, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up memory cache after completion
      this.memoryCache.delete(fullSkillId);
    }
  }

  private async fetchWithClone(
    repositoryUrl: string,
    skillId: string,
    subSkillName?: string
  ): Promise<string> {
    // 提取仓库名称用于显示
    const repoName = repositoryUrl.replace(/\.git$/, '').split('/').pop() || skillId;
    const displayName = subSkillName ? `${subSkillName}` : repoName;

    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Loading skill: ${displayName}`,
      cancellable: false
    }, async (progress) => {
      let tempDir: string | null = null;

      try {
        progress.report({ increment: 0, message: 'Cloning repository...' });
        tempDir = await cloneRepo(repositoryUrl);

        progress.report({ increment: 40, message: 'Discovering skills...' });
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

        progress.report({ increment: 20, message: `Found ${skills.length} skill${skills.length > 1 ? 's' : ''}` });

        // 选择正确的技能
        let selectedSkill = skills[0];
        let actualSkillId = skillId;

        if (skills.length > 1) {
          // 多技能仓库：需要根据 subSkillName 或 skillId 选择正确的技能
          progress.report({ increment: 10, message: 'Matching skill...' });

          // 优先使用 subSkillName 进行匹配
          let matchingSkill: typeof skills[0] | undefined;

          if (subSkillName) {
            matchingSkill = skills.find(s => {
              // 匹配技能名称
              if (s.name === subSkillName) return true;
              // 匹配路径中的目录名
              const dirName = s.path.split('/').pop()?.replace(/\/SKILL\.md$/, '');
              return dirName === subSkillName;
            });
          }

          // 如果没有通过 subSkillName 找到，尝试通过 skillId 匹配
          if (!matchingSkill) {
            matchingSkill = skills.find(s => {
              // 从路径中提取技能名称（相对于 tempDir）
              const relativePath = s.path.replace(tempDir + '/', '').replace(/\/SKILL\.md$/, '');
              // 检查是否匹配 skillId 中的任何部分
              return skillId.includes(s.name) || skillId.includes(relativePath.replace(/\//g, '/'));
            });
          }

          if (matchingSkill) {
            selectedSkill = matchingSkill;
            progress.report({ increment: 10, message: `Selected: ${selectedSkill.name}` });
          }

          // 根据选中的技能路径构建新的 skillId
          const relativePath = selectedSkill.path.replace(tempDir + '/', '').replace(/\/SKILL\.md$/, '');
          const parsed = parseSource(repositoryUrl);
          if (parsed.type === 'github' || parsed.type === 'gitlab') {
            actualSkillId = buildSkillId(parsed, selectedSkill.name);
            // 添加子路径信息
            if (relativePath !== 'SKILL.md') {
              actualSkillId = `${actualSkillId}/${relativePath.replace(/\/SKILL\.md$/, '')}`;
            }
          }
        }

        progress.report({ increment: 15, message: 'Reading skill content...' });

        // Read the content
        const content = await fs.readFile(selectedSkill.path, 'utf-8');

        progress.report({ increment: 10, message: 'Caching skill...' });

        // 构建完整的缓存 key（包含子技能名称）
        const fullSkillId = subSkillName ? `${skillId}@${subSkillName}` : actualSkillId;
        const safeSkillId = fullSkillId.replace(/\//g, '-');

        const cachedPath = await this.skillCache!.cacheSkillMd(
          safeSkillId,
          content,
          repositoryUrl
        );

        progress.report({ increment: 5, message: 'Done!' });

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
        await cleanupTempDir(tempDir);
      }
    }
    });
  }
}
