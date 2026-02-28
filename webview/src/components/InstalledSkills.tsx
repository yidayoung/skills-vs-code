import React, { useState, useEffect } from 'react';
import { vscode } from '../vscode';
import { SkillCard } from './SkillCard';
import { TabPanel } from './TabContainer';
import { t } from '../i18n';
import type { InstalledVersion } from '../types';

interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  source?: {
    type: 'local' | 'remote';
    skillMdPath?: string;
    repository?: string;
    sourceUrl?: string;
    localPath?: string;
  };
  repository?: string;
  installedVersions: InstalledVersion[];
  hasUpdate: boolean;
}

export const InstalledSkills: React.FC = () => {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [showGlobal, setShowGlobal] = useState(true); // 默认显示全局

  useEffect(() => {
    // Request installed skills from extension
    vscode.postMessage({ type: 'requestInstalledSkills' });

    // Listen for response
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'installedSkills') {
        setSkills(message.data || []);
        setLoading(false);
        setCheckingUpdates(false);
      } else if (message.type === 'skillsUpdateStatus') {
        const status = message.data?.status;
        if (status === 'checking') {
          setCheckingUpdates(true);
        } else if (status === 'done' || status === 'error') {
          setCheckingUpdates(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    setCheckingUpdates(false);
  }, [showGlobal]);

  const handleUpdate = (skill: InstalledSkill) => {
    const agents = skill.installedVersions.map(v => v.agent);
    vscode.postMessage({
      type: 'update',
      skill,
      agents
    });
  };

  const handleReinstall = (skill: InstalledSkill) => {
    // Reuse update pipeline for installed skills; backend source metadata decides actual fetch/install.
    const agents = skill.installedVersions.map(v => v.agent);
    vscode.postMessage({
      type: 'update',
      skill,
      agents
    });
  };

  const handleRemove = (skill: InstalledSkill) => {
    // Pass empty array to remove from ALL agents
    // This ensures all symlinks and ghost links are cleaned up
    const scope = skill.installedVersions[0]?.scope || 'project';
    vscode.postMessage({
      type: 'remove',
      skillId: skill.id,
      agents: [], // Empty array = remove from all agents
      scope
    });
  };

  const handleCheckUpdates = () => {
    setCheckingUpdates(true);
    vscode.postMessage({ type: 'checkInstalledSkillUpdates' });
  };

  // 根据选择过滤技能
  const filteredSkills = React.useMemo(() => {
    return skills.filter(skill => {
      if (showGlobal) {
        // 显示全局：只显示 global scope
        return skill.installedVersions.some(v => v.scope === 'global');
      } else {
        // 显示项目：只显示 project scope
        return skill.installedVersions.some(v => v.scope === 'project');
      }
    });
  }, [skills, showGlobal]);

  const updatableCount = React.useMemo(
    () => filteredSkills.filter(skill => skill.hasUpdate).length,
    [filteredSkills]
  );

  if (loading) {
    return (
      <TabPanel id="installed">
        <div className="loading-container">
          <div className="spinner" />
          <p>{t('installed.loading')}</p>
        </div>
      </TabPanel>
    );
  }

  if (skills.length === 0) {
    return (
      <TabPanel id="installed">
        <div className="empty-state">
          <span className="codicon codicon-extensions-empty" aria-hidden="true" />
          <h3>{t('installed.empty.title')}</h3>
          <p>{t('installed.empty.desc')}</p>
          <button
            className="action-button primary"
            onClick={() => {
              // Note: Tab switching is handled by parent
              window.location.reload(); // Simple refresh for now
            }}
          >
            {t('installed.empty.browse')}
          </button>
        </div>
      </TabPanel>
    );
  }

  return (
    <TabPanel id="installed">
      {/* Scope Toggle */}
      <div className="scope-toggle-container">
        <span className="scope-label">{t('installed.scope.global')}</span>
        <div className="scope-actions">
          <button
            className={`check-updates-button ${checkingUpdates ? 'is-loading' : ''}`}
            onClick={handleCheckUpdates}
            disabled={checkingUpdates}
            title={checkingUpdates ? t('installed.checking') : t('installed.checkUpdates')}
          >
            <span className={`codicon ${checkingUpdates ? 'codicon-loading codicon-modifier-spin' : 'codicon-sync'}`} />
            <span className="check-updates-label">
              {checkingUpdates ? t('installed.checking') : t('installed.checkUpdates')}
            </span>
            {updatableCount > 0 && (
              <span className="check-updates-count">{updatableCount}</span>
            )}
          </button>
          <button
            className={`toggle-switch ${showGlobal ? 'on' : 'off'}`}
            onClick={() => setShowGlobal(!showGlobal)}
            aria-label={t('installed.scope.toggle')}
          >
            <span className="toggle-slider"/>
          </button>
        </div>
      </div>

      {/* Skills List */}
      <div className="skills-list">
        {filteredSkills.map(skill => {
          // 获取第一个安装版本的信息用于显示
          const firstVersion = skill.installedVersions[0];
          const canReinstall = skill.source?.type === 'remote'
            && Boolean(skill.source?.sourceUrl || skill.source?.repository);

          return (
            <SkillCard
              key={skill.id}
              id={skill.id}
              name={skill.name}
              description={skill.description}
              repository={skill.repository}
              source={skill.source}
              agentType={firstVersion?.agent as any || 'claude-code'}
              scope={firstVersion?.scope || 'project'}
              installed={true}
              hasUpdate={skill.hasUpdate}
              onInstall={canReinstall ? () => handleReinstall(skill) : undefined}
              onUpdate={() => handleUpdate(skill)}
              onRemove={() => handleRemove(skill)}
            />
          );
        })}
      </div>
    </TabPanel>
  );
};
