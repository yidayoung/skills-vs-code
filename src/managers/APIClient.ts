import { SkillSearchResult, SkillAPIConfig } from '../types';

export class APIClient {
  constructor(private configs: SkillAPIConfig[]) {}

  async searchSkills(query: string): Promise<SkillSearchResult[]> {
    const enabledConfigs = this.configs
      .filter(c => c.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const results = await Promise.allSettled(
      enabledConfigs.map(config => this.fetchFromAPI(config, query))
    );

    const allSkills = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    return this.deduplicateSkills(allSkills);
  }

  private async fetchFromAPI(
    config: SkillAPIConfig,
    query: string
  ): Promise<SkillSearchResult[]> {
    // TODO: Implement actual API call
    return [];
  }

  private deduplicateSkills(skills: SkillSearchResult[]): SkillSearchResult[] {
    const map = new Map<string, SkillSearchResult>();
    for (const skill of skills) {
      const existing = map.get(skill.id);
      if (!existing) {
        map.set(skill.id, skill);
      }
    }
    return Array.from(map.values());
  }
}
