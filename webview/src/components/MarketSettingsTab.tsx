import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TabPanel } from './TabContainer';
import { vscode } from '../vscode';
import { t } from '../i18n';

interface MarketConfig {
  url: string;
  enabled: boolean;
  name?: string;
  priority?: number;
}

interface MarketConfigRow extends MarketConfig {
  rowId: string;
}

interface TestResult {
  searchOk: boolean;
  leaderboardOk: boolean;
  latencyMs?: number;
  searchError?: string;
  leaderboardError?: string;
}

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

function normalizeRows(rows: MarketConfigRow[]): Array<{
  url: string;
  enabled: boolean;
  name?: string;
  priority?: number;
}> {
  return rows.map(row => ({
    url: row.url.trim(),
    enabled: row.enabled,
    name: row.name?.trim() || undefined,
    priority: row.priority
  }));
}

function normalizeConfigs(configs: MarketConfig[]): Array<{
  url: string;
  enabled: boolean;
  name?: string;
  priority?: number;
}> {
  return configs.map(config => ({
    url: (config.url || '').trim(),
    enabled: config.enabled !== false,
    name: config.name?.trim() || undefined,
    priority: config.priority
  }));
}

function serializeConfigs(configs: Array<{
  url: string;
  enabled: boolean;
  name?: string;
  priority?: number;
}>): string {
  return JSON.stringify(configs);
}

function toRow(config: MarketConfig, index: number): MarketConfigRow {
  return {
    rowId: `${Date.now()}-${Math.random()}-${index}`,
    url: config.url || '',
    enabled: config.enabled !== false,
    name: config.name || '',
    priority: typeof config.priority === 'number' ? config.priority : (100 - index)
  };
}

export const MarketSettingsTab: React.FC = () => {
  const [rows, setRows] = useState<MarketConfigRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [testingRowId, setTestingRowId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [baselineSnapshot, setBaselineSnapshot] = useState<string>('[]');
  const pendingSaveSnapshotRef = useRef<string>('[]');

  useEffect(() => {
    vscode.postMessage({ type: 'requestMarketConfigs' });

    const onMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'marketConfigs': {
          const data = Array.isArray(message.data) ? message.data : [];
          const normalized = normalizeConfigs(data);
          setRows(normalized.map((item, index) => toRow(item, index)));
          const snapshot = serializeConfigs(normalized);
          setBaselineSnapshot(snapshot);
          pendingSaveSnapshotRef.current = snapshot;
          break;
        }
        case 'marketConfigsSaved':
          setSaving(false);
          setBaselineSnapshot(pendingSaveSnapshotRef.current);
          setMessage(t('market.settings.saveSuccess'));
          break;
        case 'marketConfigsSaveError':
          setSaving(false);
          setMessage(`${t('market.settings.saveError')}: ${message.error || 'unknown'}`);
          break;
        case 'testMarketConfigResult': {
          setTestingRowId(null);
          const result: TestResult = {
            searchOk: Boolean(message.searchOk),
            leaderboardOk: Boolean(message.leaderboardOk),
            latencyMs: typeof message.latencyMs === 'number' ? message.latencyMs : undefined,
            searchError: message.searchError,
            leaderboardError: message.leaderboardError
          };
          setTestResults(prev => ({
            ...prev,
            [normalizeUrl(message.configUrl || '')]: result
          }));
          break;
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const canSave = useMemo(() => {
    if (rows.length === 0) return false;
    return rows.every(row => row.url.trim().length > 0);
  }, [rows]);

  const isDirty = useMemo(() => {
    const current = serializeConfigs(normalizeRows(rows));
    return current !== baselineSnapshot;
  }, [rows, baselineSnapshot]);

  const hasDuplicateUrl = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      const key = normalizeUrl(row.url);
      if (!key) continue;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const enabled = rows.filter(row => row.enabled).length;
    const tested = rows.filter(row => testResults[normalizeUrl(row.url)]).length;
    const healthy = rows.filter(row => {
      const result = testResults[normalizeUrl(row.url)];
      return result?.searchOk && result?.leaderboardOk;
    }).length;
    return { total, enabled, tested, healthy };
  }, [rows, testResults]);

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        rowId: `${Date.now()}-${Math.random()}`,
        url: '',
        enabled: true,
        name: '',
        priority: prev.length > 0 ? Math.min(...prev.map(r => r.priority ?? 0)) - 1 : 100
      }
    ]);
  };

  const updateRow = (rowId: string, patch: Partial<MarketConfigRow>) => {
    setRows(prev => prev.map(row => (row.rowId === rowId ? { ...row, ...patch } : row)));
  };

  const deleteRow = (rowId: string) => {
    setRows(prev => prev.filter(row => row.rowId !== rowId));
  };

  const moveRow = (rowId: string, direction: -1 | 1) => {
    setRows(prev => {
      const index = prev.findIndex(row => row.rowId === rowId);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy.map((row, idx) => ({ ...row, priority: 100 - idx }));
    });
  };

  const saveButtonLabel = useMemo(() => {
    if (saving) return t('market.settings.saving');
    if (!isDirty) return t('market.settings.savedState');
    return t('market.settings.save');
  }, [saving, isDirty]);

  const addButtonClass = 'action-button market-action market-action-add secondary';
  const saveButtonClass = 'action-button market-action market-action-save primary';
  const rowButtonClass = 'action-button market-action market-action-row secondary';
  const deleteButtonClass = 'action-button market-action market-action-delete danger';

  const saveDisabled = !canSave || saving || hasDuplicateUrl || !isDirty;

  const saveConfigsAndMessage = () => {
    if (saveDisabled) {
      return;
    }
    setSaving(true);
    setMessage('');
    const payload = normalizeRows(rows);
    pendingSaveSnapshotRef.current = serializeConfigs(payload);
    vscode.postMessage({
      type: 'saveMarketConfigs',
      configs: payload
    });
  };

  const testConfig = (row: MarketConfigRow) => {
    if (!row.url.trim()) {
      setMessage(t('market.settings.testNeedUrl'));
      return;
    }
    setMessage('');
    setTestingRowId(row.rowId);
    vscode.postMessage({
      type: 'testMarketConfig',
      config: {
        url: row.url.trim(),
        enabled: row.enabled,
        name: row.name?.trim() || undefined,
        priority: row.priority
      }
    });
  };

  return (
    <TabPanel id="market-settings">
      <div className="market-settings-header">
        <h3>{t('market.settings.title')}</h3>
        <p>{t('market.settings.desc')}</p>
      </div>

      <div className="market-overview-grid">
        <div className="market-overview-card">
          <span className="market-overview-label">{t('market.settings.overview.total')}</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="market-overview-card">
          <span className="market-overview-label">{t('market.settings.overview.enabled')}</span>
          <strong>{stats.enabled}</strong>
        </div>
        <div className="market-overview-card">
          <span className="market-overview-label">{t('market.settings.overview.healthy')}</span>
          <strong>{stats.healthy}</strong>
        </div>
        <div className="market-overview-card">
          <span className="market-overview-label">{t('market.settings.overview.tested')}</span>
          <strong>{stats.tested}</strong>
        </div>
      </div>

      <div className="market-settings-actions">
        <button className={addButtonClass} onClick={addRow}>
          {t('market.settings.add')}
        </button>
        <button
          className={saveButtonClass}
          onClick={saveConfigsAndMessage}
          disabled={saveDisabled}
        >
          {saveButtonLabel}
        </button>
      </div>

      {hasDuplicateUrl && (
        <p className="market-settings-warning">{t('market.settings.duplicateWarning')}</p>
      )}

      {message && <p className="market-settings-message">{message}</p>}

      <div className="market-card-list">
        {rows.map((row, index) => {
          const rowUrlKey = normalizeUrl(row.url);
          const result = testResults[rowUrlKey];
          const isHealthy = Boolean(result?.searchOk && result?.leaderboardOk);
          const isTesting = testingRowId === row.rowId;
          const isDuplicate =
            rowUrlKey.length > 0 &&
            rows.filter(item => normalizeUrl(item.url) === rowUrlKey).length > 1;

          return (
            <article key={row.rowId} className="market-card">
              <header className="market-card-header">
                <div className="market-card-title-wrap">
                  <h4>{row.name?.trim() || `${t('market.settings.unnamed')} #${index + 1}`}</h4>
                  <span className={`market-health-badge ${isHealthy ? 'ok' : 'pending'}`}>
                    {isHealthy ? t('market.settings.health.ok') : t('market.settings.health.pending')}
                  </span>
                </div>
                <label className="market-toggle">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateRow(row.rowId, { enabled: e.target.checked })}
                  />
                  <span>{row.enabled ? t('market.settings.status.enabled') : t('market.settings.status.disabled')}</span>
                </label>
              </header>

              <div className="market-card-grid">
                <div className="market-field">
                  <label>{t('market.settings.col.name')}</label>
                  <input
                    className="market-input"
                    value={row.name || ''}
                    onChange={(e) => updateRow(row.rowId, { name: e.target.value })}
                    placeholder={t('market.settings.namePlaceholder')}
                  />
                </div>

                <div className="market-field">
                  <label>{t('market.settings.col.priority')}</label>
                  <input
                    className="market-input market-priority-input"
                    type="number"
                    value={row.priority ?? 0}
                    onChange={(e) => updateRow(row.rowId, { priority: Number(e.target.value) })}
                  />
                </div>

                <div className="market-field market-field-url">
                  <label>{t('market.settings.col.url')}</label>
                  <input
                    className={`market-input ${isDuplicate ? 'invalid' : ''}`}
                    value={row.url}
                    onChange={(e) => updateRow(row.rowId, { url: e.target.value })}
                    placeholder="https://your-market.example.com"
                  />
                  {isDuplicate && (
                    <p className="market-inline-error">{t('market.settings.duplicateInline')}</p>
                  )}
                </div>
              </div>

              {result && (
                <div className="market-test-result">
                  <span className={result.searchOk ? 'ok' : 'fail'}>
                    {result.searchOk ? 'Search OK' : 'Search FAIL'}
                  </span>
                  <span className={result.leaderboardOk ? 'ok' : 'fail'}>
                    {result.leaderboardOk ? 'Leaderboard OK' : 'Leaderboard FAIL'}
                  </span>
                  {result.latencyMs != null && <span>{result.latencyMs}ms</span>}
                </div>
              )}

              <div className="market-row-actions">
                <button
                  className={rowButtonClass}
                  onClick={() => moveRow(row.rowId, -1)}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  className={rowButtonClass}
                  onClick={() => moveRow(row.rowId, 1)}
                  disabled={index === rows.length - 1}
                >
                  ↓
                </button>
                <button
                  className={rowButtonClass}
                  onClick={() => testConfig(row)}
                  disabled={isTesting}
                >
                  {isTesting ? t('market.settings.testing') : t('market.settings.test')}
                </button>
                <button
                  className={deleteButtonClass}
                  onClick={() => deleteRow(row.rowId)}
                >
                  {t('market.settings.delete')}
                </button>
              </div>
            </article>
          );
        })}

        {rows.length === 0 && (
          <div className="market-table-empty">
            {t('market.settings.empty')}
          </div>
        )}
      </div>
    </TabPanel>
  );
};
