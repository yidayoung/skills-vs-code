/**
 * Message types sent between extension and webview
 */
export type MessageType =
  | 'ready'
  | 'installedSkills'
  | 'requestInstalledSkills'
  | 'search'
  | 'searchResults'
  | 'searchError'
  | 'searchStart'
  | 'getTrending'
  | 'trendingResults'
  | 'install'
  | 'update'
  | 'remove'
  | 'viewSkill'
  | 'openRepository'
  | 'skillsUpdateStatus'
  | 'switchTab'
  | 'fetchRemoteSkillMd'
  | 'skillMdFetched'
  | 'skillMdError'
  | 'openSkillMd';

/**
 * Base message interface
 */
export interface VSCodeMessage {
  type: MessageType;
  [key: string]: any;
}
