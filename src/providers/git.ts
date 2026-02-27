/**
 * Generic Git Provider
 * Handles any Git repository URL (fallback provider)
 * Uses git clone for all operations
 */

import type { HostProvider, ProviderMatch, ParsedRepository } from './types';

export class GitProvider implements HostProvider {
  readonly id = 'git';
  readonly displayName = 'Git';

  match(repoUrl: string): ProviderMatch {
    // Match any valid git URL (https://, git://, or ssh)
    // This is a fallback provider, so it should match anything that looks like a git URL
    const gitUrlPatterns = [
      /^https?:\/\/.+/i,           // http:// or https://
      /^git:\/\/.+/i,              // git://
      /^ssh:\/\/.+/i,              // ssh://
      /^git@.+:.+/i,               // git@host:user/repo.git
      /.+\.git$/i,                 // anything ending in .git
    ];

    for (const pattern of gitUrlPatterns) {
      if (pattern.test(repoUrl)) {
        return {
          matches: true,
          sourceIdentifier: this.extractIdentifier(repoUrl),
        };
      }
    }

    return { matches: false };
  }

  private extractIdentifier(repoUrl: string): string {
    try {
      // Try to parse as URL
      const url = new URL(repoUrl);
      // Remove .git suffix and leading slash
      let path = url.pathname.slice(1).replace(/\.git$/, '');
      return `${url.hostname}/${path}`;
    } catch {
      // Not a URL, try to extract from git@ or ssh format
      const match = repoUrl.match(/@([^:]+):(.+)\.git/);
      if (match) {
        return `${match[1]}/${match[2]}`;
      }
      // Fallback: return the URL itself
      return repoUrl;
    }
  }

  parseUrl(repoUrl: string): ParsedRepository | null {
    // Parse generic Git URLs
    // Supports:
    // - https://git.example.com/owner/repo.git
    // - https://git.example.com/owner/repo/tree/ref/path
    // - git://git.example.com/owner/repo.git
    // - git@git.example.com:owner/repo.git

    let url: URL;
    try {
      // Remove git@ prefix and convert to URL format
      let normalizedUrl = repoUrl;
      if (repoUrl.startsWith('git@')) {
        // git@host:owner/repo.git -> https://host/owner/repo.git
        normalizedUrl = repoUrl.replace(/^git@([^:]+):/, 'https://$1/');
      }

      url = new URL(normalizedUrl);
    } catch {
      // If URL parsing fails, try to parse git@ format
      const match = repoUrl.match(/@([^:]+):(.+)/);
      if (match) {
        const host = match[1];
        const path = match[2].replace(/\.git$/, '');
        const parts = path.split('/');
        if (parts.length >= 2) {
          // Last segment is the repo name
          const repo = parts.pop()!;
          // Second-to-last segment is the owner
          const owner = parts.pop()!;
          // Any remaining segments form the parent path
          const parentPath = parts.join('/');

          return {
            platform: 'git',
            owner: parentPath ? `${parentPath}/${owner}` : owner,
            repo,
            ref: undefined,  // Let git clone auto-detect the default branch
            path: '',  // No sub-path unless explicitly specified
          };
        }
      }
      return null;
    }

    // Remove .git suffix
    let pathname = url.pathname.replace(/\.git$/, '');

    // Check for tree/path pattern (e.g., /owner/repo/tree/ref/path)
    const treeMatch = pathname.match(/\/(.+?)\/(.+?)\/tree\/([^/]+)\/?(.*)?$/);
    if (treeMatch) {
      const [, owner, repo, ref, path = ''] = treeMatch;
      return {
        platform: 'git',
        owner,
        repo,
        ref,
        path,
      };
    }

    // Standard Git URL pattern: last two segments are owner/repo
    // e.g., /owner/repo, /org/owner/repo, /group/org/owner/repo
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    // Last segment is the repo name
    const repo = parts.pop()!;
    // Second-to-last segment is the owner (might include org/group)
    const owner = parts.pop()!;
    // Any remaining segments form the parent path (e.g., 'org' or 'group/org')
    const parentPath = parts.join('/');

    return {
      platform: 'git',
      owner: parentPath ? `${parentPath}/${owner}` : owner,
      repo,
      ref: undefined,  // Let git clone auto-detect the default branch
      path: '',  // No sub-path unless explicitly specified with /tree/
    };
  }

  getFolderApiUrl(_repo: ParsedRepository): string {
    // Generic git provider doesn't support folder API
    // Uses git clone instead
    throw new Error('Folder API not supported for generic Git repositories. Use git clone instead.');
  }

  async fetchContents(_apiUrl: string): Promise<never> {
    // Generic git provider doesn't support API-based content fetching
    throw new Error('API content fetching not supported for generic Git repositories. Use git clone instead.');
  }

  async downloadFile(_file: any, _targetPath: string): Promise<never> {
    // Generic git provider doesn't support individual file downloads via API
    throw new Error('API file download not supported for generic Git repositories. Use git clone instead.');
  }

  getRawFileUrl(_repo: ParsedRepository, _filePath: string): string {
    // Generic git provider doesn't support raw file URLs
    // Uses git clone instead
    throw new Error('Raw file URL not supported for generic Git repositories. Use git clone instead.');
  }
}

/**
 * Global instance
 */
export const gitProvider = new GitProvider();
