/**
 * Message types sent between extension and webview
 */
export type MessageType =
  | 'ready'
  | 'installedSkills'
  | 'requestInstalledSkills'
  | 'checkInstalledSkillUpdates'
  | 'requestMarketConfigs'
  | 'marketConfigs'
  | 'saveMarketConfigs'
  | 'marketConfigsSaved'
  | 'marketConfigsSaveError'
  | 'testMarketConfig'
  | 'testMarketConfigResult'
  | 'search'
  | 'searchResults'
  | 'searchError'
  | 'searchStart'
  | 'getLeaderboard'
  | 'leaderboardStart'
  | 'leaderboardResults'
  | 'leaderboardError'
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
