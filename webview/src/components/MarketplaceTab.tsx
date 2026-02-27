import React, { useState, useEffect, useCallback } from 'react';
import { vscode } from '../vscode';
import { SkillCard } from './SkillCard';
import { TabPanel } from './TabContainer';
import { t } from '../i18n';
import type { SupportedAgent } from '../types';

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  repository: string;
  skillMdUrl: string;
  version?: string;
  stars?: number;
  updatedAt?: string;
  marketName?: string;
}

export const MarketplaceTab: React.FC = () => {
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    vscode.postMessage({
      type: 'search',
      query: searchQuery.trim()
    });
  }, [searchQuery]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'searchStart':
          setLoading(true);
          setError(null);
          break;

        case 'searchResults':
          setSkills(message.data || []);
          setLoading(false);
          setHasSearched(true);
          break;

        case 'searchError':
          setError(message.error || t('market.error.default'));
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleInstall = (skill: MarketplaceSkill) => {
    vscode.postMessage({
      type: 'install',
      skill
    });
  };

  return (
    <TabPanel id="marketplace">
      {/* Search Header */}
      <div className="marketplace-header">
        <div className="search-container">
          <span className="codicon codicon-search search-icon" aria-hidden="true" />
          <input
            type="text"
            className="search-input"
            placeholder={t('market.search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            aria-label={t('market.search.aria')}
          />
          <button
            className="search-button"
            onClick={handleSearch}
            disabled={!searchQuery.trim() || loading}
            aria-label="Search"
          >
            {t('market.search.button')}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <p>{t('market.loading')}</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-state">
          <span className="codicon codicon-error" aria-hidden="true" />
          <p>{error}</p>
          <button
            className="action-button secondary"
            onClick={() => setError(null)}
          >
            {t('market.error.dismiss')}
          </button>
        </div>
      )}

      {/* Empty State (before search) */}
      {!hasSearched && !loading && !error && (
        <div className="empty-state">
          <span className="codicon codicon-marketplace" aria-hidden="true" />
          <h3>{t('market.empty.before.title')}</h3>
          <p>{t('market.empty.before.desc')}</p>
          <div className="suggested-searches">
            <p>{t('market.empty.before.popular')}</p>
            <div className="suggestion-tags">
              {['git', 'testing', 'debugging', 'api', 'database'].map(term => (
                <button
                  key={term}
                  className="suggestion-tag"
                  onClick={() => {
                    setSearchQuery(term);
                    // Auto-search after short delay
                    setTimeout(() => {
                      vscode.postMessage({
                        type: 'search',
                        query: term
                      });
                      setHasSearched(true);
                      setLoading(true);
                    }, 100);
                  }}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {hasSearched && !loading && !error && skills.length === 0 && (
        <div className="empty-state">
          <span className="codicon codicon-search" aria-hidden="true" />
          <h3>{t('market.empty.none.title')}</h3>
          <p>{t('market.empty.none.desc')}</p>
        </div>
      )}

      {/* Results Grid */}
      {hasSearched && !loading && !error && skills.length > 0 && (
        <div className="marketplace-results">
          <div className="skill-cards">
            {skills.map(skill => (
              <SkillCard
                key={skill.id}
                id={skill.id}
                name={skill.name}
                description={skill.description}
                repository={skill.repository}
                skillMdUrl={skill.skillMdUrl}
                stars={skill.stars}
                updatedAt={skill.updatedAt}
                marketName={skill.marketName}
                agentType="claude-code" // 市场默认为 claude-code，安装后可选择
                scope="project" // 市场技能默认为项目安装
                installed={false}
                onInstall={() => handleInstall(skill)}
              />
            ))}
          </div>
        </div>
      )}
    </TabPanel>
  );
};
