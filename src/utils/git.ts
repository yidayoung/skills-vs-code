/**
 * Git utilities for cloning repositories
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';
import { resolve, normalize, sep } from 'path';

const CLONE_TIMEOUT_MS = 60000; // 60 seconds

export class GitCloneError extends Error {
  readonly url: string;
  readonly isTimeout: boolean;
  readonly isAuthError: boolean;

  constructor(message: string, url: string, isTimeout = false, isAuthError = false) {
    super(message);
    this.name = 'GitCloneError';
    this.url = url;
    this.isTimeout = isTimeout;
    this.isAuthError = isAuthError;
  }
}

/**
 * Clone a repository to a temporary directory
 * Uses shallow clone to minimize bandwidth and disk usage
 *
 * @param url - Repository URL (HTTPS or SSH)
 * @param ref - Optional branch or tag to checkout
 * @returns Path to the cloned repository
 */
export async function cloneRepo(url: string, ref?: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'skills-'));

  console.log(`[Git] Cloning ${url} to ${tempDir}`);
  if (ref) {
    console.log(`[Git] Using ref: ${ref}`);
  }

  // Set environment variable to prevent interactive prompts
  process.env.GIT_TERMINAL_PROMPT = '0';

  const git: SimpleGit = simpleGit({
    timeout: {
      block: CLONE_TIMEOUT_MS,
    },
  });

  // Try to clone with automatic branch detection first
  // If no ref specified, Git will automatically detect the default branch
  const cloneOptions = ref ? ['--depth', '1', '--branch', ref] : ['--depth', '1'];

  try {
    await git.clone(url, tempDir, cloneOptions);
    console.log(`[Git] Clone successful: ${tempDir}`);
    return tempDir;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Git] Clone failed: ${errorMessage}`);

    // If the error is about branch not found and no ref was specified, try common branch names
    if (!ref && (errorMessage.includes('remote branch') || errorMessage.includes('main') || errorMessage.includes('未发现'))) {
      console.log(`[Git] Trying fallback branches...`);

      // Try common branch names
      const branchesToTry = ['master', 'main', 'develop', 'dev'];

      for (const branch of branchesToTry) {
        try {
          console.log(`[Git] Trying branch: ${branch}`);
          const options = ['--depth', '1', '--branch', branch];
          await git.clone(url, tempDir, options);
          console.log(`[Git] Clone successful with branch ${branch}: ${tempDir}`);
          return tempDir;
        } catch (branchError) {
          console.log(`[Git] Branch ${branch} failed, trying next...`);
          // Clean up failed attempt
          await cleanupTempDir(tempDir).catch(() => {});
          continue;
        }
      }
    }

    // Clean up temp dir on failure
    await cleanupTempDir(tempDir).catch(() => {});

    const isTimeout = errorMessage.includes('block timeout') || errorMessage.includes('timed out');
    const isAuthError =
      errorMessage.includes('Authentication failed') ||
      errorMessage.includes('could not read Username') ||
      errorMessage.includes('Permission denied') ||
      errorMessage.includes('Repository not found');

    if (isTimeout) {
      throw new GitCloneError(
        `Clone timed out after 60s. This often happens with private repos that require authentication.\n` +
          `  Ensure you have access and your SSH keys or credentials are configured:\n` +
          `  - For SSH: ssh-add -l (to check loaded keys)\n` +
          `  - For HTTPS: gh auth status (if using GitHub CLI)`,
        url,
        true,
        false
      );
    }

    if (isAuthError) {
      throw new GitCloneError(
        `Authentication failed for ${url}.\n` +
          `  - For private repos, ensure you have access\n` +
          `  - For SSH: Check your keys with 'ssh -T git@github.com'\n` +
          `  - For HTTPS: Run 'gh auth login' or configure git credentials`,
        url,
        false,
        true
      );
    }

    throw new GitCloneError(`Failed to clone ${url}: ${errorMessage}`, url, false, false);
  }
}

/**
 * Clean up a temporary directory
 * Validates that the directory is within tmpdir to prevent deletion of arbitrary paths
 *
 * @param dir - Directory to clean up
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  console.log(`[Git] Cleaning up temp directory: ${dir}`);

  // Validate that the directory path is within tmpdir to prevent deletion of arbitrary paths
  const normalizedDir = normalize(resolve(dir));
  const normalizedTmpDir = normalize(resolve(tmpdir()));

  if (!normalizedDir.startsWith(normalizedTmpDir + sep) && normalizedDir !== normalizedTmpDir) {
    throw new Error('Attempted to clean up directory outside of temp directory');
  }

  await fs.rm(dir, { recursive: true, force: true });
  console.log(`[Git] Cleanup complete`);
}
