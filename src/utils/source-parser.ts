/**
 * Source 解析器
 * 统一处理各种技能来源格式
 *
 * 支持的格式：
 * - GitHub 短名字: owner/repo
 * - GitHub 带路径: owner/repo/path/to/skill
 * - GitHub @skill 语法: owner/repo@skill-name
 * - GitHub URL: https://github.com/owner/repo
 * - GitHub URL 带分支: https://github.com/owner/repo/tree/branch
 * - GitHub URL 带路径: https://github.com/owner/repo/tree/branch/path/to/skill
 * - GitLab: gitlab.com/owner/repo
 * - GitLab 带子组: gitlab.com/group/subgroup/repo
 * - GitLab URL: https://gitlab.com/owner/repo
 * - GitLab URL 带分支: https://gitlab.com/owner/repo/-/tree/branch
 * - GitLab 私有实例: gitlab.example.com/owner/repo
 * - 本地路径: /path/to/skill, ./skill, ../skill
 * - 直接 URL: https://example.com/skill.md
 * - 通用 Git URL: git@gitlab.com:owner/repo.git
 */

import * as path from 'path';
import { ParsedSource, LocalSource, GitHubSource, GitLabSource, DirectUrlSource } from './source-types';

/**
 * 源别名映射
 * 将常用的简写映射到规范化的仓库路径
 */
const SOURCE_ALIASES: Record<string, string> = {
  'coinbase/agentWallet': 'coinbase/agentic-wallet-skills',
};

/**
 * 解析 source 字符串
 * @param input - 用户输入的 source 字符串
 * @returns 解析后的 source 信息
 */
export function parseSource(input: string): ParsedSource {
  const trimmedInput = input.trim();

  // 1. 解析别名
  const alias = SOURCE_ALIASES[trimmedInput];
  const normalizedInput = alias || trimmedInput;

  // 2. 本地路径
  if (isLocalPath(normalizedInput)) {
    return parseLocalPath(normalizedInput);
  }

  // 3. 直接 SKILL.md URL
  if (isDirectSkillUrl(normalizedInput)) {
    return parseDirectUrl(normalizedInput);
  }

  // 4. GitHub URL 格式
  const githubSource = parseGitHubUrl(normalizedInput);
  if (githubSource) {
    return githubSource;
  }

  // 5. GitHub 短名字格式
  const githubShortSource = parseGitHubShort(normalizedInput);
  if (githubShortSource) {
    return githubShortSource;
  }

  // 6. GitLab URL 格式
  const gitlabSource = parseGitLabUrl(normalizedInput);
  if (gitlabSource) {
    return gitlabSource;
  }

  // 7. GitLab 短名字格式（仅 gitlab.com）
  const gitlabShortSource = parseGitLabShort(normalizedInput);
  if (gitlabShortSource) {
    return gitlabShortSource;
  }

  // 8. Well-known URL
  if (isWellKnownUrl(normalizedInput)) {
    return {
      type: 'well-known',
      input: normalizedInput,
      url: normalizedInput
    };
  }

  // 9. 通用 Git URL（fallback）
  return {
    type: 'git',
    input: normalizedInput,
    url: normalizedInput
  };
}

/**
 * 检查是否为本地路径
 */
function isLocalPath(input: string): boolean {
  return (
    path.isAbsolute(input) ||
    input.startsWith('./') ||
    input.startsWith('../') ||
    input === '.' ||
    input === '..' ||
    // Windows absolute paths like C:\ or D:\
    /^[a-zA-Z]:[/\\]/.test(input)
  );
}

/**
 * 解析本地路径
 */
function parseLocalPath(input: string): LocalSource {
  const resolvedPath = path.resolve(input);
  return {
    type: 'local',
    input,
    localPath: resolvedPath
  };
}

/**
 * 检查是否为直接 SKILL.md URL
 */
function isDirectSkillUrl(input: string): boolean {
  if (!input.startsWith('http://') && !input.startsWith('https://')) {
    return false;
  }

  // 必须以 /skill.md 结尾（不区分大小写）
  if (!input.toLowerCase().endsWith('/skill.md')) {
    return false;
  }

  // 排除 GitHub 和 GitLab 仓库 URL（它们有自己专门的处理方式）
  if (input.includes('github.com/') && !input.includes('raw.githubusercontent.com')) {
    // 检查是否是 blob/raw URL（这些应该由 provider 处理）
    if (!input.includes('/blob/') && !input.includes('/raw/')) {
      return false;
    }
  }
  if (input.includes('gitlab.com/') && !input.includes('/-/raw/')) {
    return false;
  }

  return true;
}

/**
 * 解析直接 URL
 */
function parseDirectUrl(input: string): DirectUrlSource {
  return {
    type: 'direct-url',
    input,
    url: input
  };
}

/**
 * 解析 GitHub URL
 */
function parseGitHubUrl(input: string): GitHubSource | null {
  // GitHub URL 带路径: https://github.com/owner/repo/tree/branch/path/to/skill
  const githubTreeWithPathMatch = input.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
  if (githubTreeWithPathMatch) {
    const [, owner, repo, ref, subpath] = githubTreeWithPathMatch;
    return {
      type: 'github',
      input,
      url: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      ref,
      subpath
    };
  }

  // GitHub URL 带分支: https://github.com/owner/repo/tree/branch
  const githubTreeMatch = input.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)$/);
  if (githubTreeMatch) {
    const [, owner, repo, ref] = githubTreeMatch;
    return {
      type: 'github',
      input,
      url: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      ref
    };
  }

  // GitHub URL: https://github.com/owner/repo
  const githubRepoMatch = input.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (githubRepoMatch) {
    const [, owner, repo] = githubRepoMatch;
    const cleanRepo = repo.replace(/\.git$/, '');
    return {
      type: 'github',
      input,
      url: `https://github.com/${owner}/${cleanRepo}.git`,
      owner,
      repo: cleanRepo
    };
  }

  return null;
}

/**
 * 解析 GitHub 短名字
 */
function parseGitHubShort(input: string): GitHubSource | null {
  // 排除看起来像本地路径的输入
  if (input.includes(':') || input.startsWith('.') || input.startsWith('/')) {
    return null;
  }

  // @skill 语法: owner/repo@skill-name
  const atSkillMatch = input.match(/^([^/]+)\/([^/@]+)@(.+)$/);
  if (atSkillMatch) {
    const [, owner, repo, skillFilter] = atSkillMatch;
    return {
      type: 'github',
      input,
      url: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      skillFilter
    };
  }

  // 带路径的短名字: owner/repo/path/to/skill
  const pathMatch = input.match(/^([^/]+)\/([^/]+)\/(.+)$/);
  if (pathMatch) {
    const [, owner, repo, subpath] = pathMatch;
    return {
      type: 'github',
      input,
      url: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      subpath
    };
  }

  // 基本短名字: owner/repo
  const basicMatch = input.match(/^([^/]+)\/([^/]+)$/);
  if (basicMatch) {
    const [, owner, repo] = basicMatch;
    return {
      type: 'github',
      input,
      url: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo
    };
  }

  return null;
}

/**
 * 解析 GitLab URL
 */
function parseGitLabUrl(input: string): GitLabSource | null {
  // GitLab URL 带路径: https://gitlab.com/owner/repo/-/tree/branch/path
  // 也支持私有实例: https://gitlab.example.com/group/subgroup/repo/-/tree/branch/path
  const gitlabTreeWithPathMatch = input.match(/^(https?):\/\/([^/]+)\/(.+?)\/-\/tree\/([^/]+)\/(.+)/);
  if (gitlabTreeWithPathMatch) {
    const [, protocol, hostname, repoPath, ref, subpath] = gitlabTreeWithPathMatch;
    if (hostname === 'github.com') {
      return null;
    }
    return {
      type: 'gitlab',
      input,
      url: `${protocol}://${hostname}/${repoPath.replace(/\.git$/, '')}.git`,
      hostname,
      repoPath: repoPath.replace(/\.git$/, ''),
      ref,
      subpath
    };
  }

  // GitLab URL 带分支: https://gitlab.com/owner/repo/-/tree/branch
  const gitlabTreeMatch = input.match(/^(https?):\/\/([^/]+)\/(.+?)\/-\/tree\/([^/]+)$/);
  if (gitlabTreeMatch) {
    const [, protocol, hostname, repoPath, ref] = gitlabTreeMatch;
    if (hostname === 'github.com') {
      return null;
    }
    return {
      type: 'gitlab',
      input,
      url: `${protocol}://${hostname}/${repoPath.replace(/\.git$/, '')}.git`,
      hostname,
      repoPath: repoPath.replace(/\.git$/, ''),
      ref
    };
  }

  // GitLab 基本URL: https://gitlab.com/owner/repo
  // 也支持子组: https://gitlab.com/group/subgroup/repo
  // 也支持私有实例: https://gitlab.example.com/owner/repo
  const gitlabRepoMatch = input.match(/^(https?):\/\/([^/]+)\/(.+)$/);
  if (gitlabRepoMatch) {
    const [, protocol, hostname, repoPath] = gitlabRepoMatch;
    // 只处理 gitlab.com 或看起来像 gitlab 实例的域名
    if (hostname === 'github.com') {
      return null;
    }
    if (hostname === 'gitlab.com' || repoPath.includes('/')) {
      return {
        type: 'gitlab',
        input,
        url: `${protocol}://${hostname}/${repoPath.replace(/\.git$/, '')}.git`,
        hostname,
        repoPath: repoPath.replace(/\.git$/, '')
      };
    }
  }

  return null;
}

/**
 * 解析 GitLab 短名字（仅 gitlab.com）
 */
function parseGitLabShort(input: string): GitLabSource | null {
  // 排除看起来像本地路径的输入
  if (input.includes(':') || input.startsWith('.') || input.startsWith('/')) {
    return null;
  }

  // GitLab.com 短名字: gitlab.com/owner/repo 或 gitlab.com/group/subgroup/repo
  const gitlabComMatch = input.match(/^gitlab\.com\/(.+?)(?:\.git)?\/?$/);
  if (gitlabComMatch) {
    const repoPath = gitlabComMatch[1];
    // 必须至少有 owner/repo（至少一个斜杠）
    if (repoPath.includes('/')) {
      return {
        type: 'gitlab',
        input,
        url: `https://gitlab.com/${repoPath}.git`,
        hostname: 'gitlab.com',
        repoPath
      };
    }
  }

  return null;
}

/**
 * 检查是否为 Well-known URL
 */
function isWellKnownUrl(input: string): boolean {
  if (!input.startsWith('http://') && !input.startsWith('https://')) {
    return false;
  }

  try {
    const url = new URL(input);

    // 排除已知的 git hosts（它们有专门的处理）
    const excludedHosts = [
      'github.com',
      'gitlab.com',
      'huggingface.co',
      'raw.githubusercontent.com'
    ];
    if (excludedHosts.includes(url.hostname)) {
      return false;
    }

    // 不匹配直接 skill.md 链接（由 direct-url 类型处理）
    if (input.toLowerCase().endsWith('/skill.md')) {
      return false;
    }

    // 不匹配看起来像 git 仓库的 URL（应该由 git 类型处理）
    if (input.endsWith('.git')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 规范化仓库 URL
 * 将各种格式的仓库 URL 转换为标准的 Git URL（带 .git 后缀）
 *
 * 支持的格式：
 * - GitHub 短名字: owner/repo → https://github.com/owner/repo.git
 * - GitLab 短名字: gitlab.com/owner/repo → https://gitlab.com/owner/repo.git
 * - 完整 URL: https://github.com/owner/repo → https://github.com/owner/repo.git
 * - 本地路径: /path/to/repo → /path/to/repo (保持不变)
 *
 * @param input - 仓库 URL 或路径
 * @returns 规范化后的仓库 URL
 */
export function normalizeRepositoryUrl(input: string): string {
  const parsed = parseSource(input);

  switch (parsed.type) {
    case 'github':
    case 'gitlab':
    case 'git':
      return parsed.url;
    case 'local':
      return parsed.localPath;
    case 'direct-url':
    case 'well-known':
      return parsed.url;
    default:
      return input;
  }
}

/**
 * 从解析后的 source 提取 owner/repo（用于锁定文件和遥测）
 * 对于本地路径返回 null
 */
export function getOwnerRepo(parsed: ParsedSource): string | null {
  switch (parsed.type) {
    case 'local':
      return null;
    case 'github':
      return `${parsed.owner}/${parsed.repo}`;
    case 'gitlab':
      return parsed.repoPath;
    case 'git':
    case 'direct-url':
    case 'well-known':
      // 尝试从 URL 中提取
      try {
        const url = new URL(parsed.url);
        let pathname = url.pathname.replace(/\.git$/, '');
        if (pathname.startsWith('/')) {
          pathname = pathname.slice(1);
        }
        if (pathname.includes('/')) {
          return pathname;
        }
      } catch {
        // URL 解析失败
      }
      return null;
    default:
      return null;
  }
}

/**
 * 解析 owner/repo 字符串
 */
export function parseOwnerRepo(ownerRepo: string): { owner: string; repo: string } | null {
  const match = ownerRepo.match(/^([^/]+)\/([^/]+)$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

/**
 * 构建 skillId
 * 格式：{type}/{path}[@skill]
 *
 * @param source - 解析后的 source
 * @param skillName - 可选的技能名称（用于 @skill 语法）
 * @returns skillId 字符串
 */
export function buildSkillId(source: ParsedSource, skillName?: string): string {
  switch (source.type) {
    case 'github': {
      // 格式: github/owner/repo[/subpath][@skill]
      let id = `github/${source.owner}/${source.repo}`;
      if (source.subpath) {
        id += `/${source.subpath}`;
      }
      if (skillName || source.skillFilter) {
        id += `@${skillName || source.skillFilter}`;
      }
      return id;
    }
    case 'gitlab': {
      // 格式: gitlab/hostname/repoPath[/subpath][@skill]
      let id = `gitlab/${source.hostname}/${source.repoPath}`;
      if (source.subpath) {
        id += `/${source.subpath}`;
      }
      if (skillName) {
        id += `@${skillName}`;
      }
      return id;
    }
    case 'local': {
      // 格式: local/absolute/path
      // 将绝对路径中的斜杠替换为下划线，避免混淆
      const normalizedPath = source.localPath.replace(/[\/\\]/g, '_');
      return `local/${normalizedPath}`;
    }
    case 'direct-url':
    case 'well-known': {
      // 对于 URL，使用 URL 的 hash 作为标识
      const urlHash = Buffer.from(source.url).toString('base64').substring(0, 16);
      return source.type === 'direct-url' ? `direct-url/${urlHash}` : `well-known/${urlHash}`;
    }
    case 'git': {
      // 对于通用 Git URL，尝试提取路径信息
      try {
        const url = new URL(source.url);
        let pathname = url.pathname.replace(/\.git$/, '');
        if (pathname.startsWith('/')) {
          pathname = pathname.slice(1);
        }
        return `git/${url.hostname}/${pathname}`;
      } catch {
        // URL 解析失败，使用 hash
        const urlHash = Buffer.from(source.url).toString('base64').substring(0, 16);
        return `git/${urlHash}`;
      }
    }
    default: {
      // Fallback
      return `unknown/${Buffer.from(JSON.stringify(source)).toString('base64')}`;
    }
  }
}

/**
 * 解析 skillId
 * 将 skillId 字符串解析为其组成部分
 *
 * @param skillId - skillId 字符串
 * @returns 解析后的 skillId 信息，如果格式无效则返回 null
 */
export function parseSkillId(skillId: string): {
  type: 'github' | 'gitlab' | 'local';
  repoPath: string;
  skillName?: string;
  subpath?: string;
  hostname?: string;
} | null {
  if (!skillId || !skillId.includes('/')) {
    return null;
  }

  const [type, ...rest] = skillId.split('/');

  switch (type) {
    case 'github': {
      // 格式: github/owner/repo[/subpath][@skill]
      if (rest.length < 2) return null;

      const owner = rest[0];
      const repoWithSuffix = rest[1];
      const subpathParts = rest.slice(2);

      // 提取 @skill 部分
      let repo = repoWithSuffix;
      let skillName: string | undefined;
      let subpath: string | undefined;

      const atMatch = repo.match(/^(.+?)@(.+)$/);
      if (atMatch) {
        repo = atMatch[1];
        skillName = atMatch[2];
      }

      // 如果有额外的路径部分，合并为 subpath
      if (subpathParts.length > 0) {
        subpath = subpathParts.join('/');
        // 检查 subpath 是否包含 @skill
        const subpathAtMatch = subpath.match(/^(.+?)@(.+)$/);
        if (subpathAtMatch) {
          subpath = subpathAtMatch[1];
          skillName = subpathAtMatch[2];
        }
      }

      return {
        type: 'github',
        repoPath: `${owner}/${repo}`,
        skillName,
        subpath
      };
    }
    case 'gitlab': {
      // 格式: gitlab/hostname/repoPath[/subpath][@skill]
      if (rest.length < 2) return null;

      const hostname = rest[0];
      const repoPathParts: string[] = [];
      const subpathParts: string[] = [];
      let skillName: string | undefined;

      let foundRepoEnd = false;
      for (const part of rest.slice(1)) {
        if (!foundRepoEnd) {
          // 检查是否包含 @skill
          const atMatch = part.match(/^(.+?)@(.+)$/);
          if (atMatch) {
            repoPathParts.push(atMatch[1]);
            skillName = atMatch[2];
            foundRepoEnd = true;
          } else {
            repoPathParts.push(part);
          }
        } else {
          subpathParts.push(part);
        }
      }

      const repoPath = repoPathParts.join('/');
      const subpath = subpathParts.length > 0 ? subpathParts.join('/') : undefined;

      return {
        type: 'gitlab',
        hostname,
        repoPath,
        skillName,
        subpath
      };
    }
    case 'local': {
      // 格式: local/normalized_path
      // 将下划线还原为路径分隔符（在支持的操作系统上）
      const normalizedPath = rest.join('/');
      return {
        type: 'local',
        repoPath: normalizedPath
      };
    }
    default:
      return null;
  }
}

/**
 * 从 skillId 构建仓库 URL
 *
 * @param skillId - skillId 字符串
 * @returns 仓库 URL，如果无法构建则返回 null
 */
export function buildRepositoryUrlFromSkillId(skillId: string): string | null {
  const parsed = parseSkillId(skillId);
  if (!parsed) return null;

  switch (parsed.type) {
    case 'github': {
      // GitHub: https://github.com/owner/repo.git
      const [owner, repo] = parsed.repoPath.split('/');
      if (!owner || !repo) return null;
      return `https://github.com/${owner}/${repo}.git`;
    }
    case 'gitlab': {
      // GitLab: https://hostname/repoPath.git
      if (!parsed.hostname) return null;
      return `https://${parsed.hostname}/${parsed.repoPath}.git`;
    }
    case 'local':
      // 本地路径不返回 URL
      return null;
    default:
      return null;
  }
}
