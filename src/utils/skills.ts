import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';

export interface SkillMdLocation {
  path: string;        // SKILL.md 文件的绝对路径
  name: string;        // 从 frontmatter 解析的 name
  skillDir: string;    // SKILL.md 所在目录
}

const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '__pycache__'];

/**
 * Parse SKILL.md frontmatter
 */
export async function parseSkillMd(filePath: string): Promise<{
  name: string;
  description: string;
  path: string;
} | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data } = matter(content);

    if (!data.name || !data.description) {
      return null;
    }

    // Ensure name and description are strings
    if (typeof data.name !== 'string' || typeof data.description !== 'string') {
      return null;
    }

    return {
      name: data.name,
      description: data.description,
      path: path.dirname(filePath),
    };
  } catch {
    return null;
  }
}

/**
 * Sanitize a skill name for use in file paths
 */
export function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')
    .substring(0, 255) || 'unnamed-skill';
}

async function hasSkillMd(dir: string): Promise<boolean> {
  try {
    const skillPath = path.join(dir, 'SKILL.md');
    const stats = await fs.stat(skillPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function parseSkillName(skillMdPath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');

    // Simple frontmatter parser for name
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    if (nameMatch) {
      return nameMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    return path.basename(skillMdPath, '.md');
  } catch {
    return null;
  }
}

async function findSkillDirs(dir: string, depth = 0, maxDepth = 5): Promise<string[]> {
  if (depth > maxDepth) return [];

  try {
    const [hasSkill, entries] = await Promise.all([
      hasSkillMd(dir),
      fs.readdir(dir, { withFileTypes: true }).catch(() => []),
    ]);

    const currentDir = hasSkill ? [dir] : [];

    // Search subdirectories
    const subDirResults = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !SKIP_DIRS.includes(entry.name))
        .map((entry) => findSkillDirs(path.join(dir, entry.name), depth + 1, maxDepth))
    );

    return [...currentDir, ...subDirResults.flat()];
  } catch {
    return [];
  }
}

/**
 * 在指定目录中查找 SKILL.md 文件
 * @param basePath - 基础目录路径
 * @param subpath - 可选的子路径
 * @returns 找到的 SKILL.md 位置列表
 */
export async function discoverSkillsInPath(
  basePath: string,
  subpath?: string
): Promise<SkillMdLocation[]> {
  const results: SkillMdLocation[] = [];
  const searchPath = subpath ? path.join(basePath, subpath) : basePath;

  // Priority search directories (same as reference project)
  const prioritySearchDirs = [
    searchPath,
    path.join(searchPath, 'skills'),
    path.join(searchPath, 'skills/.curated'),
    path.join(searchPath, 'skills/.experimental'),
    path.join(searchPath, 'skills/.system'),
    path.join(searchPath, '.agent/skills'),
    path.join(searchPath, '.agents/skills'),
    path.join(searchPath, '.claude/skills'),
    path.join(searchPath, '.cline/skills'),
    path.join(searchPath, '.codebuddy/skills'),
    path.join(searchPath, '.codex/skills'),
    path.join(searchPath, '.commandcode/skills'),
    path.join(searchPath, '.continue/skills'),
    path.join(searchPath, '.github/skills'),
    path.join(searchPath, '.goose/skills'),
    path.join(searchPath, '.iflow/skills'),
    path.join(searchPath, '.junie/skills'),
    path.join(searchPath, '.kilocode/skills'),
    path.join(searchPath, '.kiro/skills'),
    path.join(searchPath, '.mux/skills'),
    path.join(searchPath, '.neovate/skills'),
    path.join(searchPath, '.opencode/skills'),
    path.join(searchPath, '.openhands/skills'),
    path.join(searchPath, '.pi/skills'),
    path.join(searchPath, '.qoder/skills'),
    path.join(searchPath, '.roo/skills'),
    path.join(searchPath, '.trae/skills'),
    path.join(searchPath, '.windsurf/skills'),
    path.join(searchPath, '.zencoder/skills'),
  ];

  // Search priority directories first
  for (const dir of prioritySearchDirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = path.join(dir, entry.name);
          if (await hasSkillMd(skillDir)) {
            const skillMdPath = path.join(skillDir, 'SKILL.md');
            const name = await parseSkillName(skillMdPath);
            if (name) {
              results.push({ path: skillMdPath, name, skillDir });
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  // Fallback to recursive search if nothing found
  if (results.length === 0) {
    const allSkillDirs = await findSkillDirs(searchPath);

    for (const skillDir of allSkillDirs) {
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      const name = await parseSkillName(skillMdPath);
      if (name) {
        results.push({ path: skillMdPath, name, skillDir });
      }
    }
  }

  return results;
}
