import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs/promises';
import * as path from 'path';

interface GitHubFile {
  name: string;
  type: 'file' | 'dir';
  path: string;
  url: string;
  download_url?: string;
}

interface GitHubDirContent {
  name: string;
  type: 'file' | 'dir';
  path: string;
  url: string;
  download_url?: string;
}

/**
 * Download a complete folder from GitHub
 * @param folderUrl - GitHub API URL for the folder (e.g., https://api.github.com/repos/owner/repo/contents/skills/pdf)
 * @param targetDir - Local directory to download to
 */
export async function downloadGitHubFolder(folderUrl: string, targetDir: string): Promise<void> {
  // Ensure target directory exists
  await fs.mkdir(targetDir, { recursive: true });

  // Fetch folder contents from GitHub API
  const contents = await fetchGitHubContents(folderUrl);

  // Download all files and subdirectories
  await Promise.all(
    contents.map(async (item) => {
      const localPath = path.join(targetDir, item.name);

      if (item.type === 'file') {
        // Download file
        if (item.download_url) {
          await downloadFile(item.download_url, localPath);
        }
      } else if (item.type === 'dir') {
        // Recursively download subdirectory
        await downloadGitHubFolder(item.url, localPath);
      }
    })
  );
}

/**
 * Fetch contents of a GitHub directory
 */
async function fetchGitHubContents(apiUrl: string): Promise<GitHubDirContent[]> {
  const data = await makeHttpsRequest<any>(apiUrl);

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

/**
 * Download a single file from URL
 */
async function downloadFile(fileUrl: string, localPath: string): Promise<void> {
  const content = await makeHttpsRequest<string>(fileUrl);

  if (typeof content === 'string') {
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, content, 'utf-8');
  }
}

/**
 * Make HTTPS request and return response data
 */
function makeHttpsRequest<T>(urlString: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(urlString);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'VSCode-Skills-Extension/1.0'
      },
      timeout: 30000
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
            resolve(parsed as T);
          } catch {
            // If not JSON, return raw data (for file downloads)
            resolve(data as T);
          }
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

/**
 * Parse GitHub repository URL and skill path
 * Examples:
 * - https://github.com/anthropics/skills
 * - https://github.com/anthropics/skills/tree/main/skills/pdf
 */
export function parseGitHubUrl(repoUrl: string): {
  owner: string;
  repo: string;
  ref: string;
  path: string;
} | null {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(\/tree\/([^\/]+)\/(.+))?/);

  if (!match) {
    return null;
  }

  const [, owner, repo, , ref, path] = match;

  return {
    owner,
    repo,
    ref: ref || 'main',
    path: path || '',
  };
}

/**
 * Get GitHub API URL for a folder
 */
export function getGitHubApiUrl(owner: string, repo: string, ref: string, folderPath: string): string {
  const encodedPath = folderPath ? folderPath.split('/').map(encodeURIComponent).join('/') : '';
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${ref}`;
}
