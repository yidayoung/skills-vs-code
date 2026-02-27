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
  console.log(`[Downloader] Downloading from ${repositoryUrl}`);
  console.log(`[Downloader] Target directory: ${targetDir}`);
  console.log(`[Downloader] Skill path: ${skillPath || '(root)'}`);

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

  console.log(`[Downloader] Parsed repo:`, repo);

  // Override path if provided
  if (skillPath) {
    repo = { ...repo, path: skillPath };
    console.log(`[Downloader] Override path to: ${skillPath}`);
  }

  let tempDir: string | null = null;

  try {
    // Clone repository to temporary directory
    tempDir = await cloneRepo(repositoryUrl, repo.ref);

    // Determine source path (skill folder within cloned repo)
    let sourcePath = repo.path
      ? path.join(tempDir, repo.path)
      : tempDir;

    console.log(`[Downloader] Source path: ${sourcePath}`);
    console.log(`[Downloader] Target path: ${targetDir}`);

    // Check if source path exists
    let pathExists = false;
    try {
      await fs.access(sourcePath);
      pathExists = true;
      console.log(`[Downloader] Source path exists`);
    } catch {
      console.warn(`[Downloader] Source path does not exist: ${sourcePath}`);

      // If skillPath was specified but doesn't exist, fall back to repo root
      if (repo.path) {
        console.log(`[Downloader] Falling back to repository root`);
        sourcePath = tempDir;

        try {
          await fs.access(sourcePath);
          pathExists = true;
          console.log(`[Downloader] Repository root exists`);
        } catch {
          console.error(`[Downloader] Repository root also doesn't exist!`);
        }
      }

      // List what's in tempDir to help debug
      try {
        const entries = await fs.readdir(tempDir, { withFileTypes: true });
        console.log(`[Downloader] Contents of tempDir:`);
        for (const entry of entries.slice(0, 20)) {
          console.log(`  - ${entry.name} (${entry.isDirectory() ? 'dir' : 'file'})`);
        }
      } catch (err) {
        console.error(`[Downloader] Could not list tempDir: ${err}`);
      }
    }

    if (!pathExists) {
      throw new Error(`Source path not found: ${sourcePath}`);
    }

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // Copy skill folder to target directory
    console.log(`[Downloader] Copying files...`);
    await copyDirectory(sourcePath, targetDir);
    console.log(`[Downloader] Copy complete`);
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

  console.log(`[Downloader] Copying ${entries.length} items from ${src} to ${dest}`);
  console.log(`[Downloader] Directory contents before copy:`, entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })));

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    console.log(`[Downloader] Processing: ${entry.name} (${entry.isDirectory() ? 'dir' : 'file'})`);

    if (entry.isDirectory()) {
      // Skip .git directory
      if (entry.name === '.git') {
        console.log(`[Downloader] Skipping .git directory`);
        continue;
      }
      await copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      try {
        await fs.copyFile(srcPath, destPath);
        console.log(`[Downloader] ✓ Copied file: ${entry.name}`);
      } catch (error) {
        console.error(`[Downloader] ✗ Failed to copy ${entry.name}:`, error);
      }
    }
  }

  // Verify SKILL.md was copied
  try {
    const skillMdPath = path.join(dest, 'SKILL.md');
    await fs.access(skillMdPath);
    console.log(`[Downloader] ✓ Verified: SKILL.md exists in ${dest}`);
  } catch {
    console.error(`[Downloader] ✗ ERROR: SKILL.md NOT found in ${dest} after copy!`);
  }

  console.log(`[Downloader] Copy complete: ${dest}`);
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
