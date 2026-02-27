import React, { useState, useEffect } from 'react';
import { vscode } from '../vscode';
import { SkillCard } from './SkillCard';
import { TabPanel } from './TabContainer';

interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  installedVersions: Array<{
    agent: string;
    scope: 'project' | 'global';
    path: string;
  }>;
  hasUpdate: boolean;
}

interface GroupedSkills {
  [key: string]: InstalledSkill[];
}

export const InstalledSkills: React.FC = () => {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'none' | 'agent' | 'scope'>('none');
  const [filterScope, setFilterScope] = useState<'all' | 'project' | 'global'>('all');

  useEffect(() => {
    // Request installed skills from extension
    vscode.postMessage({ type: 'requestInstalledSkills' });

    // Listen for response
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'installedSkills') {
        setSkills(message.data || []);
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const groupedSkills: GroupedSkills = React.useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Skills': skills };
    }

    return skills.reduce((acc, skill) => {
      let key: string;

      if (groupBy === 'agent') {
        // Group by first agent
        key = skill.installedVersions[0]?.agent || 'Unknown';
      } else {
        // Group by scope
        key = skill.installedVersions[0]?.scope || 'unknown';
      }

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(skill);
      return acc;
    }, {} as GroupedSkills);
  }, [skills, groupBy]);

  const filteredSkills = React.useMemo(() => {
    if (filterScope === 'all') return skills;

    return skills.filter(skill =>
      skill.installedVersions.some(v => v.scope === filterScope)
    );
  }, [skills, filterScope]);

  const handleInstall = (skillId: string) => {
    vscode.postMessage({
      type: 'install',
      skill: { id: skillId }
    });
  };

  const handleUpdate = (skill: InstalledSkill) => {
    const agents = skill.installedVersions.map(v => v.agent);
    vscode.postMessage({
      type: 'update',
      skill,
      agents
    });
  };

  const handleRemove = (skill: InstalledSkill) => {
    const agents = skill.installedVersions.map(v => v.agent);
    const scope = skill.installedVersions[0]?.scope || 'project';
    vscode.postMessage({
      type: 'remove',
      skillId: skill.id,
      agents,
      scope
    });
  };

  if (loading) {
    return (
      <TabPanel id="installed" isActive={true}>
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading installed skills...</p>
        </div>
      </TabPanel>
    );
  }

  if (skills.length === 0) {
    return (
      <TabPanel id="installed" isActive={true}>
        <div className="empty-state">
          <span className="codicon codicon-extensions-empty" aria-hidden="true" />
          <h3>No Skills Installed</h3>
          <p>Install skills from the marketplace to enhance your workflow.</p>
          <button
            className="action-button primary"
            onClick={() => {
              // Switch to marketplace tab
              vscode.postMessage({ type: 'switchTab', tab: 'marketplace' });
            }}
          >
            Browse Marketplace
          </button>
        </div>
      </TabPanel>
    );
  }

  return (
    <TabPanel id="installed" isActive={true}>
      {/* Controls Bar */}
      <div className="skills-controls">
        <div className="control-group">
          <label htmlFor="group-select">Group by:</label>
          <select
            id="group-select"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="vscode-select"
          >
            <option value="none">None</option>
            <option value="agent">Agent</option>
            <option value="scope">Scope</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="scope-select">Scope:</label>
          <select
            id="scope-select"
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value as any)}
            className="vscode-select"
          >
            <option value="all">All</option>
            <option value="project">Project</option>
            <option value="global">Global</option>
          </select>
        </div>

        <div className="control-group">
          <span className="skills-count">{filteredSkills.length} skills</span>
        </div>
      </div>

      {/* Skills List */}
      <div className="skills-list">
        {Object.entries(groupedSkills).map(([groupKey, groupSkills]) => (
          <div key={groupKey} className="skill-group">
            {groupBy !== 'none' && (
              <h4 className="group-title">{groupKey}</h4>
            )}
            <div className="skill-cards">
              {groupSkills
                .filter(skill => {
                  if (filterScope === 'all') return true;
                  return skill.installedVersions.some(v => v.scope === filterScope);
                })
                .map(skill => (
                  <SkillCard
                    key={skill.id}
                    {...skill}
                    onUpdate={() => handleUpdate(skill)}
                    onRemove={() => handleRemove(skill)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </TabPanel>
  );
};
