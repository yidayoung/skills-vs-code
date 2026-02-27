import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import { SkillSearchResult, SkillAPIConfig } from '../types';

export class APIClient {
  constructor(private configs: SkillAPIConfig[]) {}

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

  private async fetchFromAPI(
    config: SkillAPIConfig,
    query: string
  ): Promise<SkillSearchResult[]> {
    try {
      const apiUrl = new url.URL(config.url);
      const searchParams = new URLSearchParams({
        q: query,
        limit: '50'
      });

      // Add search params to URL
      apiUrl.searchParams.set('q', query);
      apiUrl.searchParams.set('limit', '50');

      const responseData = await this.makeHttpsRequest(apiUrl.toString());

      // Parse response based on expected API format
      // This assumes the API returns a format similar to:
      // { skills: [{ id, name, description, repository, skillMdUrl, version, stars, updatedAt }] }
      if (responseData && typeof responseData === 'object') {
        if (Array.isArray(responseData.skills)) {
          return responseData.skills.map((skill: any) => this.normalizeSkillResult(skill, config.url));
        } else if (Array.isArray(responseData)) {
          return responseData.map((skill: any) => this.normalizeSkillResult(skill, config.url));
        }
      }

      return [];
    } catch (error) {
      console.error(`Failed to fetch from ${config.url}:`, error);
      return [];
    }
  }

  private normalizeSkillResult(skill: any, apiUrl: string): SkillSearchResult {
    return {
      id: skill.id || skill.repository || `${skill.name || 'unknown'}`,
      name: skill.name || 'Unknown',
      description: skill.description || '',
      repository: skill.repository || skill.repo || '',
      skillMdUrl: skill.skillMdUrl || skill.skill_md_url || skill.readme_url || '',
      version: skill.version || skill.commit || skill.tag,
      stars: skill.stars || skill.star_count || 0,
      updatedAt: skill.updatedAt || skill.updated_at || skill.last_updated
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
    if (skill.skillMdUrl) score++;
    if (skill.version) score++;
    if (skill.stars) score++;
    if (skill.updatedAt) score++;
    return score;
  }

  /**
   * Fetch raw skill.md content from URL
   */
  async fetchSkillMd(skillMdUrl: string): Promise<string | null> {
    try {
      const content = await this.makeHttpsRequest(skillMdUrl);

      // Handle different response formats
      if (typeof content === 'string') {
        return content;
      } else if (content && typeof content === 'object') {
        // Some APIs return { content: "..." } or { data: "..." }
        return content.content || content.data || content.body || JSON.stringify(content);
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch skill.md from ${skillMdUrl}:`, error);
      return null;
    }
  }
}
