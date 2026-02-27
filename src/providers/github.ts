/**
 * GitHub Provider
 * Handles GitHub repositories
 */

import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import type { HostProvider, ProviderMatch, ParsedRepository, RepositoryFile } from './types';

export class GitHubProvider implements HostProvider {
  readonly id = 'github';
  readonly displayName = 'GitHub';

  private readonly API_BASE = 'https://api.github.com';
  private readonly RAW_BASE = 'https://raw.githubusercontent.com';

  private getAuthToken(): string | undefined {
    const config = vscode.workspace.getConfiguration('skills');
    const token = config.get<string>('githubToken');
    return token && token.trim() ? token.trim() : undefined;
  }

  match(repoUrl: string): ProviderMatch {
    // Match github.com URLs
    const githubRegex = /(?:^|\/\/)(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(githubRegex);

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
    // Parse: https://github.com/owner/repo.git/tree/ref/path
    // Or: https://github.com/owner/repo.git

    const match = repoUrl.match(
      /github\.com\/([^\/]+)\/([^\/\?]+)(?:\/tree\/([^\/]+)(?:\/(.+))?)?/
    );

    if (!match) {
      return null;
    }

    const [, owner, repoWithGit, ref = 'main', path = ''] = match;
    // Remove .git suffix if present
    const repo = repoWithGit.replace(/\.git$/, '');

    return {
      platform: 'github',
      owner,
      repo,
      ref,
      path,
    };
  }

  getFolderApiUrl(repo: ParsedRepository): string {
    const encodedPath = repo.path
      ? repo.path.split('/').map(encodeURIComponent).join('/')
      : '';
    return `${this.API_BASE}/repos/${repo.owner}/${repo.repo}/contents/${encodedPath}?ref=${repo.ref || 'HEAD'}`;
  }

  getRawFileUrl(repo: ParsedRepository, filePath: string): string {
    const encodedPath = filePath
      ? [repo.path, filePath].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/')
      : repo.path.split('/').map(encodeURIComponent).join('/');
    return `${this.RAW_BASE}/${repo.owner}/${repo.repo}/${repo.ref || 'HEAD'}/${encodedPath}`;
  }

  async fetchContents(apiUrl: string): Promise<RepositoryFile[]> {
    const data = await this.makeRequest<any>(apiUrl);

    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        name: item.name,
        type: item.type,
        path: item.path,
        url: item.url,
        download_url: item.download_url,
      }));
    }

    // Single file (not a directory)
    return [{
      name: data.name,
      type: data.type,
      path: data.path,
      url: data.url,
      download_url: data.download_url,
    }];
  }

  async downloadFile(file: RepositoryFile, targetPath: string): Promise<void> {
    if (!file.download_url) {
      throw new Error(`No download URL for file: ${file.name}`);
    }

    const content = await this.makeRequest<string>(file.download_url);
    await fs.mkdir(require('path').dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf-8');
  }

  private async makeRequest<T>(urlString: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new url.URL(urlString);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const token = this.getAuthToken();
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'VSCode-Skills-Extension/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers,
        timeout: 30000,
      };

      const req = client.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            const buffer = Buffer.concat(chunks);
            const contentType = res.headers['content-type'] || '';

            // Parse as JSON if content-type indicates JSON response
            if (contentType.includes('application/json')) {
              try {
                const data = buffer.toString('utf-8');
                const parsed = JSON.parse(data);
                resolve(parsed as T);
              } catch (error) {
                reject(new Error(`Failed to parse JSON response: ${error}`));
              }
            } else {
              // Return raw text for non-JSON responses (file downloads)
              resolve(buffer.toString('utf-8') as T);
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
}

export const githubProvider = new GitHubProvider();
