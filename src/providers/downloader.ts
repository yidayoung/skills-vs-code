/**
 * Universal folder downloader using Provider system
 * Supports GitHub, GitLab, and future platforms
 *
 * Now uses git clone for better performance and to avoid API rate limits
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { findProvider } from './registry';
import type { ParsedRepository } from './types';
import { cloneRepo, cleanupTempDir } from '../utils/git';

/**
 * Download a complete folder from any supported platform
 * Uses git clone for better performance and to avoid API rate limits
 *
 * @param repositoryUrl - Repository URL (GitHub or GitLab)
 * @param targetDir - Local directory to download to
 * @param skillPath - Optional path to skill folder within repo
 */
export async function downloadSkillFolder(
  repositoryUrl: string,
  targetDir: string,
  skillPath?: string
): Promise<void> {
  // Find the appropriate provider
  const provider = findProvider(repositoryUrl);

  if (!provider) {
    throw new Error(`Unsupported repository platform: ${repositoryUrl}`);
  }

  // Parse the repository URL
  let repo = provider.parseUrl(repositoryUrl);

  if (!repo) {
    throw new Error(`Invalid repository URL: ${repositoryUrl}`);
  }

  // Override path if provided
  if (skillPath) {
    repo = { ...repo, path: skillPath };
  }

  let tempDir: string | null = null;

  try {
    // Clone repository to temporary directory
    tempDir = await cloneRepo(repositoryUrl, repo.ref);

    // Determine source path (skill folder within cloned repo)
    let sourcePath = repo.path
      ? path.join(tempDir, repo.path)
      : tempDir;

    // Check if source path exists
    let pathExists = false;
    try {
      await fs.access(sourcePath);
      pathExists = true;
    } catch {
      console.warn(`[Downloader] Source path does not exist: ${sourcePath}`);

      // If skillPath was specified but doesn't exist, fall back to repo root
      if (repo.path) {
        sourcePath = tempDir;

        try {
          await fs.access(sourcePath);
          pathExists = true;
        } catch {
          console.error(`[Downloader] Repository root also doesn't exist!`);
        }
      }
    }

    if (!pathExists) {
      throw new Error(`Source path not found: ${sourcePath}`);
    }

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // Copy skill folder to target directory
    await copyDirectory(sourcePath, targetDir);
  } finally {
    // Always clean up temporary directory
    if (tempDir) {
      await cleanupTempDir(tempDir).catch(() => {});
    }
  }
}

/**
 * Copy a directory recursively
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Skip .git directory
      if (entry.name === '.git') {
        continue;
      }
      await copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      try {
        await fs.copyFile(srcPath, destPath);
      } catch (error) {
        console.error(`[Downloader] Failed to copy ${entry.name}:`, error);
      }
    }
  }

  // Verify SKILL.md was copied
  try {
    const skillMdPath = path.join(dest, 'SKILL.md');
    await fs.access(skillMdPath);
  } catch {
    console.error(`[Downloader] ERROR: SKILL.md NOT found in ${dest} after copy!`);
  }
}

/**
 * Parse repository URL to extract components
 * Works with both GitHub and GitLab URLs
 */
export function parseRepositoryUrl(repositoryUrl: string): ParsedRepository | null {
  const provider = findProvider(repositoryUrl);

  if (!provider) {
    return null;
  }

  return provider.parseUrl(repositoryUrl);
}

/**
 * Get the raw file URL for downloading
 */
export function getRawFileUrl(repositoryUrl: string, filePath: string, ref?: string): string {
  const provider = findProvider(repositoryUrl);

  if (!provider) {
    throw new Error(`Unsupported repository platform: ${repositoryUrl}`);
  }

  let repo = provider.parseUrl(repositoryUrl);

  if (!repo) {
    throw new Error(`Invalid repository URL: ${repositoryUrl}`);
  }

  if (ref) {
    repo = { ...repo, ref };
  }

  return provider.getRawFileUrl(repo, filePath);
}
