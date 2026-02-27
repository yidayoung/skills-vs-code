import React, { useState } from 'react';
import { vscode } from '../vscode';

interface TabContainerProps {
  children: React.ReactNode;
}

interface Tab {
  id: string;
  label: string;
  icon: string;
}

export const TabContainer: React.FC<TabContainerProps> = ({ children }) => {
  const [activeTab, setActiveTab] = useState('installed');

  const tabs: Tab[] = [
    { id: 'installed', label: 'Installed', icon: 'extensions' },
    { id: 'marketplace', label: 'Marketplace', icon: 'search' }
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Notify extension about tab change
    vscode.postMessage({
      type: 'tabChanged',
      tab: tabId
    });
  };

  return (
    <div className="tab-container">
      {/* Tab Navigation */}
      <div className="tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
          >
            <span className="codicon codicon-{tab.icon}" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as any, {
              isActive: (child.props as any).id === activeTab
            });
          }
          return child;
        })}
      </div>
    </div>
  );
};

interface TabPanelProps {
  id: string;
  isActive: boolean;
  children: React.ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({ id, isActive, children }) => {
  if (!isActive) return null;

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
