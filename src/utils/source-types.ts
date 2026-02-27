/**
 * Source 类型定义
 * 用于技能来源的统一解析和处理
 */

/**
 * 解析后的 source 类型
 */
export type ParsedSource =
  | LocalSource
  | GitHubSource
  | GitLabSource
  | GitSource
  | DirectUrlSource
  | WellKnownSource;

/**
 * 本地路径源
 */
export interface LocalSource {
  type: 'local';
  /** 原始输入 */
  input: string;
  /** 解析后的本地路径（绝对路径） */
  localPath: string;
}

/**
 * GitHub 仓库源
 */
export interface GitHubSource {
  type: 'github';
  /** 原始输入 */
  input: string;
  /** GitHub 仓库 URL (带 .git 后缀) */
  url: string;
  /** owner */
  owner: string;
  /** repo */
  repo: string;
  /** 可选的分支/tag */
  ref?: string;
  /** 可选的子路径 */
  subpath?: string;
  /** 可选的技能过滤（用于 @skill 语法） */
  skillFilter?: string;
}

/**
 * GitLab 仓库源
 */
export interface GitLabSource {
  type: 'gitlab';
  /** 原始输入 */
  input: string;
  /** GitLab 仓库 URL (带 .git 后缀) */
  url: string;
  /** 仓库路径（可能包含子组：group/subgroup/repo） */
  repoPath: string;
  /** 主机名（gitlab.com 或私有实例） */
  hostname: string;
  /** 可选的分支/tag */
  ref?: string;
  /** 可选的子路径 */
  subpath?: string;
}

/**
 * 通用 Git 仓库源
 */
export interface GitSource {
  type: 'git';
  /** 原始输入 */
  input: string;
  /** Git 仓库 URL */
  url: string;
}

/**
 * 直接 URL 源（指向 SKILL.md 文件）
 */
export interface DirectUrlSource {
  type: 'direct-url';
  /** 原始输入 */
  input: string;
  /** SKILL.md 文件的 URL */
  url: string;
}

/**
 * Well-known URI 源
 */
export interface WellKnownSource {
  type: 'well-known';
  /** 原始输入 */
  input: string;
  /** Base URL */
  url: string;
}

/**
 * skillId 格式
 * 统一格式：{type}/{path}[@skill]
 * - GitHub: github/owner/repo[/path][@skill]
 * - GitLab: gitlab/hostname/repoPath[/path][@skill]
 * - Local: local/absolute/path
 */
export type SkillId = string;

/**
 * 解析后的 skillId 信息
 */
export interface ParsedSkillId {
  /** 类型 */
  type: 'github' | 'gitlab' | 'local';
  /** 仓库路径（对于 GitHub 是 owner/repo，对于 GitLab 是 repoPath） */
  repoPath: string;
  /** 技能名称（如果指定了 @skill） */
  skillName?: string;
  /** 子路径（如果有） */
  subpath?: string;
  /** 主机名（主要用于 GitLab 私有实例） */
  hostname?: string;
}
