import React from 'react';
import { TabContainer, TabPanel } from './components/TabContainer';
import { InstalledSkills } from './components/InstalledSkills';
import { MarketplaceTab } from './components/MarketplaceTab';
import './App.css';

export default function App() {
  return (
    <div className="app">
      {/* Main Content */}
      <main className="app-main">
        <TabContainer>
          <InstalledSkills />
          <MarketplaceTab />
        </TabContainer>
      </main>
    </div>
  );
}
