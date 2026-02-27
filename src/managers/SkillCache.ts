import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CacheIndex, CacheEntry, CacheConfig } from '../types/cache';

const CACHE_VERSION = '1';
const DEFAULT_MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_CACHE_EXPIRY_DAYS = 7;

// File-based cache configuration
const FILE_CACHE_CONFIG: CacheConfig = {
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  maxCount: 100,
};

export class SkillCache {
  private maxSize: number;
  private expiryDays: number;
  private cacheDir: string;
  private indexPath: string;

  constructor(
    private context: vscode.ExtensionContext,
    maxSize?: number,
    expiryDays?: number
  ) {
    // Read from configuration or use defaults
    const config = vscode.workspace.getConfiguration('skills');
    this.maxSize = config.get('cacheMaxSize', maxSize || DEFAULT_MAX_CACHE_SIZE);
    this.expiryDays = config.get('cacheExpiryDays', expiryDays || DEFAULT_CACHE_EXPIRY_DAYS);

    // Setup file-based cache directories
    this.cacheDir = path.join(this.context.globalStorageUri.fsPath, 'skill-cache');
    this.indexPath = path.join(this.cacheDir, 'index.json');
  }

  async getCachedSkill(url: string): Promise<string | null> {
    try {
      const cacheKey = this.getCacheKey(url);
      const cached = this.context.globalState.get<any>(cacheKey);

      if (!cached) return null;

      const age = Date.now() - cached.timestamp;
      if (age > this.expiryDays * 24 * 60 * 60 * 1000) {
        await this.invalidateCache(url);
        return null;
      }

      return cached.content;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  async setCachedSkill(url: string, content: string): Promise<void> {
    try {
      // Check cache size before adding
      await this.checkCacheSize();

      const cacheKey = this.getCacheKey(url);
      const cached = {
        url,
        content,
        timestamp: Date.now(),
        size: content.length
      };
      await this.context.globalState.update(cacheKey, cached);
    } catch (error) {
      console.error('Error writing to cache:', error);
      // Don't throw - cache failures shouldn't break the extension
    }
  }

  private getCacheKey(url: string): string {
    try {
      return `skill_cache_${CACHE_VERSION}_${Buffer.from(url).toString('base64').replace(/[/+=]/g, '')}`;
    } catch (error) {
      console.error('Error generating cache key:', error);
      return `skill_cache_${CACHE_VERSION}_${Math.random().toString(36)}`;
    }
  }

  async invalidateCache(url: string): Promise<void> {
    try {
      await this.context.globalState.update(this.getCacheKey(url), undefined);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      // Get all keys that start with our cache prefix
      const allKeys = this.context.globalState.keys();
      const cacheKeys = allKeys.filter(key => key.startsWith(`skill_cache_${CACHE_VERSION}_`));

      // Clear all cache entries
      for (const key of cacheKeys) {
        await this.context.globalState.update(key, undefined);
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  private async checkCacheSize(): Promise<void> {
    try {
      const allKeys = this.context.globalState.keys();
      const cacheKeys = allKeys.filter(key => key.startsWith(`skill_cache_${CACHE_VERSION}_`));

      let totalSize = 0;
      const entries: Array<{ key: string; timestamp: number }> = [];

      for (const key of cacheKeys) {
        const cached = this.context.globalState.get<any>(key);
        if (cached) {
          totalSize += cached.size || 0;
          entries.push({ key, timestamp: cached.timestamp || 0 });
        }
      }

      // If over limit, remove oldest entries
      if (totalSize > this.maxSize) {
        entries.sort((a, b) => a.timestamp - b.timestamp);

        for (const entry of entries) {
          if (totalSize <= this.maxSize * 0.8) break; // Stop when we're at 80% of limit

          const cached = this.context.globalState.get<any>(entry.key);
          if (cached) {
            totalSize -= cached.size || 0;
            await this.context.globalState.update(entry.key, undefined);
          }
        }
      }
    } catch (error) {
      console.error('Error checking cache size:', error);
    }
  }

  async getCacheStats(): Promise<{ count: number; totalSize: number }> {
    try {
      const allKeys = this.context.globalState.keys();
      const cacheKeys = allKeys.filter(key => key.startsWith(`skill_cache_${CACHE_VERSION}_`));

      let totalSize = 0;
      for (const key of cacheKeys) {
        const cached = this.context.globalState.get<any>(key);
        if (cached) {
          totalSize += cached.size || 0;
        }
      }

      return { count: cacheKeys.length, totalSize };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { count: 0, totalSize: 0 };
    }
  }

  /**
   * 获取缓存的 skill.md 路径，如果存在且未过期
   * @param skillId - 技能唯一标识
   * @returns 返回文件路径或 null
   */
  async getCachedSkillMd(skillId: string): Promise<string | null> {
    try {
      const index = await this.readIndex();
      const entry = index.skills[skillId];

      if (!entry) {
        return null;
      }

      // Check if expired
      const cachedAt = new Date(entry.cachedAt).getTime();
      const now = Date.now();
      if (now - cachedAt > FILE_CACHE_CONFIG.ttl) {
        // Expired, remove from index
        delete index.skills[skillId];
        await this.writeIndex(index);
        return null;
      }

      // Check if file still exists
      const skillPath = path.join(this.cacheDir, `${skillId}.md`);
      try {
        await fs.access(skillPath);
        return skillPath;
      } catch {
        // File doesn't exist, remove from index
        delete index.skills[skillId];
        await this.writeIndex(index);
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * 缓存 skill.md 内容到文件系统
   * @param skillId - 技能唯一标识
   * @param content - skill.md 文件内容
   * @param repositoryUrl - 仓库 URL
   * @returns 返回缓存文件的绝对路径
   */
  async cacheSkillMd(
    skillId: string,
    content: string,
    repositoryUrl: string
  ): Promise<string> {
    // Ensure cache directory exists
    await fs.mkdir(this.cacheDir, { recursive: true });

    // Write skill.md content
    const skillPath = path.join(this.cacheDir, `${skillId}.md`);
    await fs.writeFile(skillPath, content, 'utf-8');

    // Update index
    const index = await this.readIndex();
    index.skills[skillId] = {
      cachedAt: new Date().toISOString(),
      repositoryUrl,
    };
    await this.writeIndex(index);

    // Cleanup if needed
    await this.cleanupCache();

    return skillPath;
  }

  /**
   * 清理过期和过多的缓存
   */
  async cleanupCache(): Promise<void> {
    const index = await this.readIndex();
    const now = Date.now();
    const skillIds = Object.keys(index.skills);

    // Remove expired entries
    for (const skillId of skillIds) {
      const entry = index.skills[skillId];
      const cachedAt = new Date(entry.cachedAt).getTime();
      if (now - cachedAt > FILE_CACHE_CONFIG.ttl) {
        delete index.skills[skillId];
        // Also remove the file
        const skillPath = path.join(this.cacheDir, `${skillId}.md`);
        await fs.rm(skillPath, { force: true }).catch(() => {});
      }
    }

    // If still too many, remove oldest (LRU)
    const remaining = Object.entries(index.skills);
    if (remaining.length > FILE_CACHE_CONFIG.maxCount) {
      // Sort by cachedAt, oldest first
      remaining.sort((a, b) => {
        const aTime = new Date(a[1].cachedAt).getTime();
        const bTime = new Date(b[1].cachedAt).getTime();
        return aTime - bTime;
      });

      // Remove oldest entries
      const toRemove = remaining.slice(0, remaining.length - FILE_CACHE_CONFIG.maxCount);
      for (const [skillId] of toRemove) {
        delete index.skills[skillId];
        const skillPath = path.join(this.cacheDir, `${skillId}.md`);
        await fs.rm(skillPath, { force: true }).catch(() => {});
      }
    }

    await this.writeIndex(index);
  }

  private async readIndex(): Promise<CacheIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Index doesn't exist or is invalid
      return { skills: {} };
    }
  }

  private async writeIndex(index: CacheIndex): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }
}
