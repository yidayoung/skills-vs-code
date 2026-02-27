import React from 'react';
import { TabContainer, TabPanel } from './components/TabContainer';
import { InstalledSkills } from './components/InstalledSkills';
import { MarketplaceTab } from './components/MarketplaceTab';
import './App.css';

export default function App() {
  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="codicon codicon-extensions" aria-hidden="true" />
            Skills Manager
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <TabContainer>
          <InstalledSkills />
          <MarketplaceTab />
        </TabContainer>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span className="footer-text">
          Manage your agent skills • Powered by Claude Code
        </span>
      </footer>
    </div>
  );
}
