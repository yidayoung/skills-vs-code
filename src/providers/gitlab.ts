/**
 * GitLab Provider
 * Handles GitLab repositories
 */

import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs/promises';
import type { HostProvider, ProviderMatch, ParsedRepository, RepositoryFile } from './types';

export class GitLabProvider implements HostProvider {
  readonly id = 'gitlab';
  readonly displayName = 'GitLab';

  private readonly API_BASE = 'https://gitlab.com/api/v4';
  private readonly RAW_BASE = 'https://gitlab.com';

  match(repoUrl: string): ProviderMatch {
    // Match gitlab.com URLs
    const gitlabRegex = /(?:^|\/\/)(?:www\.)?gitlab\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(gitlabRegex);

    if (!match) {
      return { matches: false };
    }

    const owner = match[1];
    const repo = match[2];

    return {
      matches: true,
      sourceIdentifier: `${owner}/${repo}`,
    };
  }

  parseUrl(repoUrl: string): ParsedRepository | null {
    // Parse: https://gitlab.com/owner/repo/-/tree/ref/path
    // Or: https://gitlab.com/owner/repo

    const match = repoUrl.match(
      /gitlab\.com\/([^\/]+)\/([^\/]+)(?:\/-\/tree\/([^\/]+)(?:\/(.+))?)?/
    );

    if (!match) {
      return null;
    }

    const [, owner, repo, ref = 'main', path = ''] = match;

    return {
      platform: 'gitlab',
      owner,
      repo,
      ref,
      path,
    };
  }

  getFolderApiUrl(repo: ParsedRepository): string {
    // GitLab API: GET /projects/:id/repository/tree
    // Need to URL encode the project path (owner/repo)
    const projectPath = encodeURIComponent(`${repo.owner}/${repo.repo}`);
    const encodedPath = repo.path ? encodeURIComponent(repo.path) : '';

    const queryParams = new URLSearchParams({
      ref: repo.ref || 'HEAD',
      recursive: 'true',
      path: encodedPath,
    });

    return `${this.API_BASE}/projects/${projectPath}/repository/tree?${queryParams}`;
  }

  getRawFileUrl(repo: ParsedRepository, filePath: string): string {
    // GitLab raw file URL format
    const fullPath = repo.path
      ? `${repo.path}/${filePath}`
      : filePath;

    return `${this.RAW_BASE}/${repo.owner}/${repo.repo}/-/raw/${repo.ref || 'HEAD'}/${fullPath}`;
  }

  async fetchContents(apiUrl: string): Promise<RepositoryFile[]> {
    const data = await this.makeRequest<any>(apiUrl);

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => ({
      name: item.name,
      type: item.type === 'tree' ? 'dir' : item.type === 'blob' ? 'file' : item.type,
      path: item.path,
      url: undefined, // GitLab doesn't provide this in tree API
      download_url: this.getRawFileUrlFromPath(item.path, apiUrl),
    }));
  }

  async downloadFile(file: RepositoryFile, targetPath: string): Promise<void> {
    if (!file.download_url) {
      throw new Error(`No download URL for file: ${file.name}`);
    }

    // Download file content directly
    const content = await this.makeRawRequest(file.download_url);
    await fs.mkdir(require('path').dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf-8');
  }

  private getRawFileUrlFromPath(filePath: string, treeApiUrl: string): string {
    // Extract project info from API URL
    const parsedUrl = new url.URL(treeApiUrl);
    const pathMatch = parsedUrl.pathname.match(/\/projects\/([^/]+)\/repository\/tree\//);

    if (!pathMatch) {
      throw new Error('Invalid GitLab API URL');
    }

    const projectPath = decodeURIComponent(pathMatch[1]);
    const ref = parsedUrl.searchParams.get('ref') || 'main';

    return `${this.RAW_BASE}/${projectPath}/-/raw/${ref}/${filePath}`;
  }

  private async makeRequest<T>(urlString: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new url.URL(urlString);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VSCode-Skills-Extension/1.0',
        },
        timeout: 30000,
      };

      const req = client.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              // Concatenate all chunks and convert to string
              const buffer = Buffer.concat(chunks);
              const data = buffer.toString('utf-8');
              const parsed = JSON.parse(data);
              resolve(parsed as T);
            } catch (err) {
              reject(new Error(`Failed to parse JSON: ${err}`));
            }
          } else if (res.statusCode === 404) {
            reject(new Error(`Not found: ${urlString}`));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  private async makeRawRequest(urlString: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new url.URL(urlString);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'VSCode-Skills-Extension/1.0',
        },
        timeout: 30000,
      };

      const req = client.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            // Concatenate all chunks and convert to string
            const buffer = Buffer.concat(chunks);
            resolve(buffer.toString('utf-8'));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }
}

export const gitlabProvider = new GitLabProvider();
