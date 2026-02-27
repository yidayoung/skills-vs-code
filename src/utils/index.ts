/**
 * 技能工具函数统一导出
 *
 * 提供了以下功能：
 * 1. Source 解析：解析各种格式的技能来源（GitHub、GitLab、本地路径等）
 * 2. skillId 构建/解析：创建和解析技能的唯一标识符
 * 3. 技能发现：在本地文件系统中查找 SKILL.md 文件
 */

// Source 解析相关
export {
  parseSource,
  normalizeRepositoryUrl,
  getOwnerRepo,
  parseOwnerRepo,
  buildSkillId,
  parseSkillId,
  buildRepositoryUrlFromSkillId
} from './source-parser';

// 类型定义
export type {
  ParsedSource,
  LocalSource,
  GitHubSource,
  GitLabSource,
  GitSource,
  DirectUrlSource,
  WellKnownSource,
  SkillId,
  ParsedSkillId
} from './source-types';

// 技能发现和解析相关
export {
  parseSkillMd,
  sanitizeName,
  discoverSkillsInPath
} from './skills';

// 类型定义
export type { SkillMdLocation } from './skills';
