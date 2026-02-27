/**
 * Message types sent between extension and webview
 */
export type MessageType =
  | 'ready'
  | 'installedSkills'
  | 'search'
  | 'searchResults'
  | 'searchError'
  | 'install'
  | 'update'
  | 'remove'
  | 'viewSkill'
  | 'skillsUpdateStatus'
  | 'searchStart';

/**
 * Base message interface
 */
export interface VSCodeMessage {
  type: MessageType;
  [key: string]: any;
}
