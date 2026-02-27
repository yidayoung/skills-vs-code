/**
 * Provider exports
 * Export all providers and registry functions
 */

export type { HostProvider, ProviderMatch, ParsedRepository, RemoteSkill, RepositoryFile, ProviderRegistry } from './types';
export { registry, registerProvider, findProvider, getProviders } from './registry';
export { GitHubProvider, githubProvider } from './github';
export { GitLabProvider, gitlabProvider } from './gitlab';
export { GitProvider, gitProvider } from './git';
export { downloadSkillFolder, parseRepositoryUrl, getRawFileUrl } from './downloader';

// Register built-in providers
import { registerProvider } from './registry';
import { githubProvider } from './github';
import { gitlabProvider } from './gitlab';
import { gitProvider } from './git';

registerProvider(githubProvider);
registerProvider(gitlabProvider);
registerProvider(gitProvider);  // Register last as fallback
