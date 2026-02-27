# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-02-27

- Fixed sidebar webview blank page issue in packaged extension builds by using `ExtensionMode.Development` as the only dev-server switch.
- Renamed extension package to `agent-skills-manager-pro`.
- Standardized marketplace base URL config to `https://skills.sh` (runtime appends `/api/search`).

## [0.1.0] - 2026-02-27

- Initial public release candidate.
- Added bilingual docs (`README.md`, `README.zh-CN.md`).
- Added extension and webview localization support (English and Simplified Chinese).
- Added release metadata (`repository`, `homepage`, `bugs`, `license`) in `package.json`.
- Added publish-ready marketplace icon (`resources/icon.png`).
- Unified default marketplace API endpoint to `https://api.skills.sh/search`.
