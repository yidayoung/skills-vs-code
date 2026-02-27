import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';

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
