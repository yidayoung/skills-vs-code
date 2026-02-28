import React, { useState, useEffect, useCallback, useRef } from 'react';
import { vscode } from '../vscode';
import { SkillCard } from './SkillCard';
import { TabPanel } from './TabContainer';
import { t } from '../i18n';

type LeaderboardView = 'all-time' | 'trending' | 'hot';

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  repository: string;
  skillMdUrl: string;
  skillId?: string;
  version?: string;
  stars?: number;
  installs?: number;
  updatedAt?: string;
  marketName?: string;
}

interface InstalledSkill {
  id: string;
  name: string;
  source?: {
    skillId?: string;
  };
}

const LEADERBOARD_VIEWS: LeaderboardView[] = ['all-time', 'trending', 'hot'];

function normalizeText(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function buildInstalledSkillIdLookup(installedSkills: InstalledSkill[]): Set<string> {
  const installedSkillIds = new Set<string>();
  installedSkills.forEach(skill => {
    const skillId = normalizeText(skill.source?.skillId);
    if (skillId) {
      installedSkillIds.add(skillId);
    }
  });
  return installedSkillIds;
}

function isMarketplaceSkillInstalled(skill: MarketplaceSkill, installedSkillIds: Set<string>): boolean {
  const skillId = normalizeText(skill.skillId);
  return Boolean(skillId && installedSkillIds.has(skillId));
}

export const MarketplaceTab: React.FC = () => {
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLeaderboardView, setActiveLeaderboardView] = useState<LeaderboardView>('all-time');
  const [leaderboardCache, setLeaderboardCache] = useState<Partial<Record<LeaderboardView, MarketplaceSkill[]>>>({});
  const [leaderboardTotals, setLeaderboardTotals] = useState<Partial<Record<LeaderboardView, number>>>({});
  const [leaderboardPages, setLeaderboardPages] = useState<Partial<Record<LeaderboardView, number>>>({});
  const [leaderboardHasMore, setLeaderboardHasMore] = useState<Partial<Record<LeaderboardView, boolean>>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [leaderboardPresence, setLeaderboardPresence] = useState<Record<LeaderboardView, boolean | null>>({
    'all-time': null,
    'trending': null,
    'hot': null
  });
  const [showFallbackHome, setShowFallbackHome] = useState(false);
  const visibleLeaderboardRequestRef = useRef<string | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const leaderboardRequestMetaRef = useRef<
    Record<string, { view: LeaderboardView; page: number; append: boolean }>
  >({});

  const formatCount = (count?: number): string => {
    if (typeof count !== 'number') return '';
    return count.toLocaleString();
  };

  const requestLeaderboard = useCallback(
    (view: LeaderboardView, options?: { page?: number; silent?: boolean; append?: boolean }) => {
      const page = options?.page ?? 0;
      const silent = options?.silent ?? false;
      const append = options?.append ?? false;
      const requestId = `${view}:${page}:${Date.now()}:${Math.random()}`;
      leaderboardRequestMetaRef.current[requestId] = { view, page, append };

      if (!silent) {
        visibleLeaderboardRequestRef.current = requestId;
        setLoading(true);
        setError(null);
      } else if (append) {
        setLoadingMore(true);
      }

      vscode.postMessage({
        type: 'getLeaderboard',
        view,
        page,
        requestId
      });
    },
    []
  );

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setShowFallbackHome(false);

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
    requestLeaderboard('all-time');
    vscode.postMessage({ type: 'requestInstalledSkills' });
  }, [requestLeaderboard]);

  useEffect(() => {
    if (hasSearched) return;

    if (leaderboardPresence['all-time'] === false && leaderboardPresence.trending === null) {
      requestLeaderboard('trending', { silent: true });
      return;
    }

    if (
      leaderboardPresence['all-time'] === false &&
      leaderboardPresence.trending === false &&
      leaderboardPresence.hot === null
    ) {
      requestLeaderboard('hot', { silent: true });
      return;
    }

    const allKnown = LEADERBOARD_VIEWS.every(view => leaderboardPresence[view] !== null);
    const allEmpty = LEADERBOARD_VIEWS.every(view => leaderboardPresence[view] === false);

    if (allKnown && allEmpty) {
      setShowFallbackHome(true);
      return;
    }

    const anyHasData = LEADERBOARD_VIEWS.some(view => leaderboardPresence[view] === true);
    if (anyHasData) {
      setShowFallbackHome(false);
    }
  }, [hasSearched, leaderboardPresence, requestLeaderboard]);

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
          setError(null);
          break;

        case 'installedSkills':
          setInstalledSkills(message.data || []);
          break;

        case 'searchError':
          setError(message.error || t('market.error.default'));
          setLoading(false);
          break;

        case 'leaderboardStart':
          if (!hasSearched && message.requestId && message.requestId === visibleLeaderboardRequestRef.current) {
            setLoading(true);
            setError(null);
          }
          break;

        case 'leaderboardResults': {
          const view = message.view as LeaderboardView;
          const data = (message.data || []) as MarketplaceSkill[];
          const total = typeof message.total === 'number' ? message.total : data.length;
          const page = typeof message.page === 'number' ? message.page : 0;
          const hasMore = Boolean(message.hasMore);
          const meta = message.requestId ? leaderboardRequestMetaRef.current[message.requestId] : undefined;
          if (message.requestId) {
            delete leaderboardRequestMetaRef.current[message.requestId];
          }

          setLeaderboardCache(prev => ({
            ...prev,
            [view]: meta?.append ? [...(prev[view] || []), ...data] : data
          }));

          setLeaderboardTotals(prev => ({
            ...prev,
            [view]: total
          }));
          setLeaderboardPages(prev => ({
            ...prev,
            [view]: page
          }));
          setLeaderboardHasMore(prev => ({
            ...prev,
            [view]: hasMore
          }));

          setLeaderboardPresence(prev => ({
            ...prev,
            [view]: meta?.append ? ((prev[view] === true) || data.length > 0) : data.length > 0
          }));

          if (!hasSearched && view === activeLeaderboardView) {
            setSkills(prev => (meta?.append ? [...prev, ...data] : data));
            setLoading(false);
            setError(null);
          }
          if (meta?.append) {
            setLoadingMore(false);
          }
          break;
        }

        case 'leaderboardError': {
          const view = message.view as LeaderboardView;
          const meta = message.requestId ? leaderboardRequestMetaRef.current[message.requestId] : undefined;
          if (message.requestId) {
            delete leaderboardRequestMetaRef.current[message.requestId];
          }
          setLeaderboardPresence(prev => ({
            ...prev,
            [view]: meta?.append ? prev[view] : false
          }));

          if (!hasSearched && view === activeLeaderboardView) {
            setError(message.error || t('market.error.default'));
            setLoading(false);
          }
          if (meta?.append) {
            setLoadingMore(false);
          }
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeLeaderboardView, hasSearched]);

  const handleSelectLeaderboard = (view: LeaderboardView) => {
    setHasSearched(false);
    setSearchQuery('');
    setError(null);
    setShowFallbackHome(false);
    setLoadingMore(false);
    setActiveLeaderboardView(view);

    const cached = leaderboardCache[view];
    if (cached) {
      setSkills(cached);
      setLoading(false);
      return;
    }

    requestLeaderboard(view);
  };

  const handleInstall = (skill: MarketplaceSkill) => {
    vscode.postMessage({
      type: 'install',
      skill
    });
  };

  const installedSkillIds = React.useMemo(
    () => buildInstalledSkillIdLookup(installedSkills),
    [installedSkills]
  );

  const handleLoadMore = () => {
    if (hasSearched) return;
    if (!leaderboardHasMore[activeLeaderboardView]) return;
    if (loadingMore) return;
    const nextPage = (leaderboardPages[activeLeaderboardView] ?? 0) + 1;
    requestLeaderboard(activeLeaderboardView, {
      page: nextPage,
      append: true,
      silent: true
    });
  };

  useEffect(() => {
    if (hasSearched || showFallbackHome) return;
    if (!leaderboardHasMore[activeLeaderboardView]) return;
    if (loading || loadingMore || error) return;
    if (skills.length === 0) return;

    const trigger = loadMoreTriggerRef.current;
    if (!trigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
          handleLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 200px 0px',
        threshold: 0
      }
    );

    observer.observe(trigger);
    return () => observer.disconnect();
  }, [
    activeLeaderboardView,
    hasSearched,
    showFallbackHome,
    leaderboardHasMore,
    loading,
    loadingMore,
    error,
    skills.length
  ]);

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
        <div className="leaderboard-tabs">
          {LEADERBOARD_VIEWS.map(view => (
            <button
              key={view}
              className={`leaderboard-tab ${activeLeaderboardView === view && !hasSearched ? 'active' : ''}`}
              onClick={() => handleSelectLeaderboard(view)}
              disabled={loading && !hasSearched}
            >
              {view === 'all-time' && (
                <span>
                  {t('market.leaderboard.allTime')}
                  {leaderboardTotals['all-time'] !== undefined && ` (${formatCount(leaderboardTotals['all-time'])})`}
                </span>
              )}
              {view === 'trending' && (
                <span>
                  {t('market.leaderboard.trending')}
                  {leaderboardTotals.trending !== undefined && ` (${formatCount(leaderboardTotals.trending)})`}
                </span>
              )}
              {view === 'hot' && (
                <span>
                  {t('market.leaderboard.hot')}
                  {leaderboardTotals.hot !== undefined && ` (${formatCount(leaderboardTotals.hot)})`}
                </span>
              )}
            </button>
          ))}
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
      {!hasSearched && !loading && !error && showFallbackHome && (
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

      {/* Leaderboard No Results */}
      {!hasSearched && !loading && !error && !showFallbackHome && skills.length === 0 && (
        <div className="empty-state">
          <span className="codicon codicon-search" aria-hidden="true" />
          <h3>{t('market.leaderboard.empty.title')}</h3>
          <p>{t('market.leaderboard.empty.desc')}</p>
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
      {!loading && !error && skills.length > 0 && (
        <div className="marketplace-results">
          <div className="skill-cards">
            {skills.map(skill => {
              const marketInstalled = isMarketplaceSkillInstalled(skill, installedSkillIds);
              return (
              <SkillCard
                key={skill.id}
                id={skill.id}
                name={skill.name}
                description={skill.description}
                repository={skill.repository}
                skillMdUrl={skill.skillMdUrl}
                stars={skill.stars}
                installs={skill.installs}
                updatedAt={skill.updatedAt}
                marketName={skill.marketName}
                agentType="claude-code" // 市场默认为 claude-code，安装后可选择
                scope="project" // 市场技能默认为项目安装
                installed={false}
                marketInstalled={marketInstalled}
                onInstall={() => handleInstall(skill)}
              />
              );
            })}
          </div>
          {!hasSearched && leaderboardHasMore[activeLeaderboardView] && (
            <div className="leaderboard-load-more" ref={loadMoreTriggerRef}>
              <span className="leaderboard-load-more-text">
                {loadingMore ? t('market.leaderboard.loadingMore') : t('market.leaderboard.loadMore')}
              </span>
            </div>
          )}
        </div>
      )}
    </TabPanel>
  );
};
