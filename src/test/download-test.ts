/**
 * Test script for GitHub folder download functionality
 * Run with: npx ts-node src/test/download-test.ts
 */

import * as path from 'path';
import * as os from 'os';
import { downloadGitHubFolder, parseGitHubUrl, getGitHubApiUrl } from '../utils/github';

async function testDownload() {
  console.log('Testing GitHub folder download...\n');

  // Test 1: Download a single skill from anthropics/skills
  console.log('Test 1: Download pdf skill from anthropics/skills');
  const testDir1 = path.join(os.tmpdir(), 'skill-test-pdf');
  try {
    const apiUrl1 = getGitHubApiUrl('anthropics', 'skills', 'main', 'skills/pdf');
    console.log(`  API URL: ${apiUrl1}`);
    await downloadGitHubFolder(apiUrl1, testDir1);
    console.log(`  ✓ Downloaded to: ${testDir1}`);

    // List downloaded files
    const fs = await import('fs/promises');
    const files = await fs.readdir(testDir1, { recursive: true });
    console.log(`  Files: ${files.length} items`);
    files.slice(0, 10).forEach(f => console.log(`    - ${f}`));
  } catch (error) {
    console.error(`  ✗ Failed: ${error}`);
  }

  // Test 2: Parse GitHub URLs
  console.log('\nTest 2: Parse GitHub URLs');
  const urls = [
    'https://github.com/anthropics/skills',
    'https://github.com/anthropics/skills/tree/main/skills/pdf',
  ];

  for (const url of urls) {
    const parsed = parseGitHubUrl(url);
    console.log(`  URL: ${url}`);
    console.log(`    Result:`, parsed);
  }

  // Test 3: Check if SKILL.md exists
  console.log('\nTest 3: Verify SKILL.md was downloaded');
  const fs = await import('fs/promises');
  const skillMdPath = path.join(testDir1, 'SKILL.md');
  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    console.log(`  ✓ SKILL.md found (${content.length} bytes)`);
    console.log(`  First line: ${content.split('\n')[0]}`);
  } catch (error) {
    console.error(`  ✗ SKILL.md not found: ${error}`);
  }

  // Cleanup
  console.log('\nCleanup...');
  try {
    await fs.rm(testDir1, { recursive: true, force: true });
    console.log('  ✓ Cleaned up test directory');
  } catch (error) {
    console.error(`  ✗ Cleanup failed: ${error}`);
  }

  console.log('\n✓ Tests completed');
}

testDownload().catch(console.error);
