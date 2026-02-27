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
  | 'install'
  | 'update'
  | 'remove'
  | 'viewSkill'
  | 'skillsUpdateStatus'
  | 'switchTab';

/**
 * Base message interface
 */
export interface VSCodeMessage {
  type: MessageType;
  [key: string]: any;
}
