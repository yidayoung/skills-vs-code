import { Scope } from './skill';

/**
 * VSCode configuration for the extension
 */
export interface SkillsConfig {
  /** API URLs for marketplace */
  apiUrls: SkillAPIConfig[];
  /** Maximum cache size in bytes */
  cacheMaxSize: number;
  /** Cache expiry time in days */
  cacheExpiryDays: number;
  /** Default selected agents */
  defaultAgents: string[];
  /** Default installation scope */
  defaultScope: Scope;
}

/**
 * User preferences (stored in globalState)
 */
export interface UserPreferences {
  /** Default selected agents */
  defaultAgents: string[];
  /** Default installation scope */
  defaultScope: Scope;
  /** Recently used API URLs */
  recentAPIs: string[];
}

export { Scope };
export type { SkillAPIConfig } from './api';
