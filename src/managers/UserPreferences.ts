import * as vscode from 'vscode';
import { Scope } from '../types';

const DEFAULT_AGENTS = ['claude-code'];
const DEFAULT_SCOPE: Scope = 'global';

export class UserPreferences {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getDefaultAgents(): string[] {
    return this.context.globalState.get<string[]>('defaultAgents', DEFAULT_AGENTS);
  }

  async setDefaultAgents(agents: string[]): Promise<void> {
    await this.context.globalState.update('defaultAgents', agents);
  }

  getDefaultScope(): Scope {
    return this.context.globalState.get<Scope>('defaultScope', DEFAULT_SCOPE);
  }

  async setDefaultScope(scope: Scope): Promise<void> {
    await this.context.globalState.update('defaultScope', scope);
  }

  getRecentAPIs(): string[] {
    return this.context.globalState.get<string[]>('recentAPIs', []);
  }

  async addRecentAPI(apiUrl: string): Promise<void> {
    const recent = this.getRecentAPIs().filter(u => u !== apiUrl);
    recent.unshift(apiUrl);
    await this.context.globalState.update('recentAPIs', recent.slice(0, 5));
  }

  getSkipInstallPrompts(): boolean {
    const config = vscode.workspace.getConfiguration('skills');
    return config.get<boolean>('skipInstallPrompts', false);
  }

  async clearAll(): Promise<void> {
    await this.context.globalState.update('defaultAgents', undefined);
    await this.context.globalState.update('defaultScope', undefined);
    await this.context.globalState.update('recentAPIs', undefined);
  }
}
