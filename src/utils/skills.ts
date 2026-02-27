import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Skill discovery utilities
 * SKELETON - To be implemented from npx skills/src/skills.ts
 */
export async function discoverSkills(directory: string): Promise<string[]> {
  // Skeleton: find all SKILL.md files
  return [];
}

/**
 * Parse SKILL.md frontmatter
 * SKELETON - To be implemented
 */
export async function parseSkillMd(filePath: string): Promise<{
  name: string;
  description: string;
}> {
  // Skeleton: parse YAML frontmatter
  return { name: '', description: '' };
}
