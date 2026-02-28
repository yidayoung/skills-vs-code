import React, { useState, createContext, useContext } from 'react';
import { t } from '../i18n';

export interface TabPanelProps {
  id: string;
  children: React.ReactNode;
}

interface Tab {
  id: string;
  label: string;
  icon: string;
}

// Context to pass activeTab to child components
const TabContext = createContext<string>('installed');

export const TabContainer: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [activeTab, setActiveTab] = useState('installed');

  const tabs: Tab[] = [
    { id: 'installed', label: t('tab.installed'), icon: 'extensions' },
    { id: 'marketplace', label: t('tab.marketplace'), icon: 'search' },
    { id: 'market-settings', label: t('tab.marketSettings'), icon: 'settings-gear' }
  ];

  return (
    <TabContext.Provider value={activeTab}>
      <div className="tab-container">
        {/* Tab Navigation */}
        <div className="tab-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
            >
              <span className={`codicon codicon-${tab.icon}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {children}
        </div>
      </div>
    </TabContext.Provider>
  );
};

export const TabPanel: React.FC<TabPanelProps> = ({
  id,
  children
}) => {
  const activeTab = useContext(TabContext);
  const isActive = id === activeTab;

  if (!isActive) {
    return null;
  }

  return (
    <div
      id={`${id}-panel`}
      role="tabpanel"
      aria-labelledby={`${id}-tab`}
      className="tab-panel"
    >
      {children}
    </div>
  );
};
