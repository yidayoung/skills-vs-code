# Skills Manager for VSCode

> Manage agent skills from VSCode - Install, update, and discover skills for your AI coding assistants

## Features

- 🎨 **Beautiful WebView Interface** - Modern React-based UI with tabbed navigation
- 🔍 **Skill Discovery** - Browse and search the skills marketplace
- 📦 **Easy Installation** - One-click install from marketplace or Git URL
- 🔄 **Keep Updated** - Update installed skills with a single click
- 🗑️ **Easy Removal** - Remove skills you no longer need
- 📖 **Documentation Viewer** - View skill.md files directly in VSCode
- ⚙️ **Flexible Configuration** - Support for multiple agents and scopes
- 💾 **Smart Caching** - Remote skills cached for faster access

## Supported Agents

- **Claude Code** (npx skills)
- Cursor
- Cline

## Installation

### From VSIX

1. Download the latest `.vsix` file from [Releases](../../releases)
2. Open VSCode
3. Go to Extensions → Install from VSIX...
4. Select the downloaded file

### From Marketplace (Coming Soon)

Search for "Skills Manager" in the VSCode Extension Marketplace.

## Usage

### Quick Start

1. **Open Skills Sidebar**
   - Press `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (macOS)
   - Or click the status bar item: `(extensions) Skills`

2. **Browse Installed Skills**
   - Switch to the "Installed" tab
   - View all installed skills grouped by agent or scope
   - Click on any skill to view its documentation

3. **Search Marketplace**
   - Switch to the "Marketplace" tab
   - Enter search terms to find skills
   - Click "Install" to add a skill

4. **Install from URL**
   - Run command: `Skills: Install from URL...`
   - Enter a Git repository URL or skill identifier

### Configuration

Open VSCode settings and search for "Skills":

| Setting | Description | Default |
|---------|-------------|---------|
| `skills.apiUrls` | Marketplace API endpoints | `[{url: 'https://api.skills.sh/search', enabled: true}]` |
| `skills.defaultAgents` | Default agents for installation | `["claude-code"]` |
| `skills.defaultScope` | Installation scope | `"global"` |
| `skills.cacheMaxSize` | Maximum cache size (bytes) | `52428800` (50MB) |
| `skills.cacheExpiryDays` | Cache expiration time (days) | `7` |

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `Skills: Show Sidebar` | `Ctrl+Shift+S` | Opens the skills sidebar |
| `Skills: Refresh` | - | Refreshes the skills list |
| `Skills: Search Marketplace` | - | Opens sidebar to marketplace tab |
| `Skills: Install from URL...` | - | Install from Git repository URL |

## Screenshots

> TODO: Add screenshots

## Development

See [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md) for:
- Project structure
- Development workflow
- Architecture details
- Testing guidelines
- Contributing

## Testing

See [MANUAL_TESTING_CHECKLIST.md](./docs/MANUAL_TESTING_CHECKLIST.md) for the complete testing checklist.

## Roadmap

### Phase 1: Project Foundation ✅
- [x] VSCode extension setup
- [x] TypeScript configuration
- [x] React + Vite webview

### Phase 2: Type Definitions ✅
- [x] Skill types
- [x] API types
- [x] Configuration types

### Phase 3: User Preferences ✅
- [x] UserPreferences class
- [x] Default agents storage
- [x] Default scope storage

### Phase 4: Skill Manager ✅
- [x] SkillManager class
- [x] Skill listing
- [x] Install/update/remove operations

### Phase 5: API Client ✅
- [x] APIClient class
- [x] Marketplace search
- [x] Multiple URL support

### Phase 6: Cache Manager ✅
- [x] SkillCache class
- [x] LRU eviction
- [x] Size management

### Phase 7-9: WebView UI ✅
- [x] Sidebar provider
- [x] Installed skills tab
- [x] Marketplace tab

### Phase 10: Skill Detail View ✅
- [x] SkillDetailProvider
- [x] Local file opening
- [x] Remote file fetching

### Phase 11: Extension Integration ✅
- [x] Extension activation
- [x] Command registration
- [x] Configuration schema

### Phase 12: Testing & Polish 🚧
- [x] Basic test structure
- [x] Documentation
- [ ] Comprehensive testing
- [ ] Bug fixes
- [ ] Performance optimization

## Contributing

Contributions are welcome! Please see [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md) for guidelines.

## License

MIT

## Credits

Built with:
- [VSCode Extension API](https://code.visualstudio.com/api)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [TailwindCSS](https://tailwindcss.com/)

## Support

- Report bugs: [Issues](../../issues)
- Feature requests: [Discussions](../../discussions)
- Documentation: [docs/](./docs/)

---

Made with ❤️ for the AI coding assistant community
