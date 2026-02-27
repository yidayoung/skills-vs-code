import * as vscode from 'vscode';

const CACHE_VERSION = '1';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const CACHE_EXPIRY_DAYS = 7;

export class SkillCache {
  constructor(private context: vscode.ExtensionContext) {}

  async getCachedSkill(url: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(url);
    const cached = this.context.globalState.get<any>(cacheKey);

    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      await this.invalidateCache(url);
      return null;
    }

    return cached.content;
  }

  async setCachedSkill(url: string, content: string): Promise<void> {
    const cacheKey = this.getCacheKey(url);
    const cached = {
      url,
      content,
      timestamp: Date.now(),
      size: content.length
    };
    await this.context.globalState.update(cacheKey, cached);
  }

  private getCacheKey(url: string): string {
    return `skill_cache_${CACHE_VERSION}_${Buffer.from(url).toString('base64').replace(/[/+=]/g, '')}`;
  }

  async invalidateCache(url: string): Promise<void> {
    await this.context.globalState.update(this.getCacheKey(url), undefined);
  }
}
