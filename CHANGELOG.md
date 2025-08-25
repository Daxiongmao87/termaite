# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.2.4](https://github.com/Daxiongmao87/termaite/compare/v0.2.3...v0.2.4) (2025-08-25)


### ✨ Features

* redesign agent selection system and fix -c flag ([92f350c](https://github.com/Daxiongmao87/termaite/commit/92f350cb275141a36a2f06d419886b2e2413945f))

### [0.2.3](https://github.com/Daxiongmao87/termaite/compare/v0.2.2...v0.2.3) (2025-08-25)


### ✨ Features

* add color-coded agent announcements ([33304ca](https://github.com/Daxiongmao87/termaite/commit/33304cad93aa166e1a994edf782da84dbe411ba3))
* add global agent instructions feature ([5ec4157](https://github.com/Daxiongmao87/termaite/commit/5ec415756eda7a65b7575c5994cec769c2bfb477))
* improve agent cancellation and UI ([8d53dc1](https://github.com/Daxiongmao87/termaite/commit/8d53dc1169a2caee451fd9ae22de476c9150a53f))


### 🐛 Bug Fixes

* **input:** prevent invisible char on submit ([bba5dfe](https://github.com/Daxiongmao87/termaite/commit/bba5dfef4654e8b7bf508e26b39f1d541b1dd378))
* remove redundant agent name from responses ([efc5b74](https://github.com/Daxiongmao87/termaite/commit/efc5b741ed24f144ae0bc684f34a396c0c71c297))
* update commit-msg hook with 75 char limit and attribution check ([dc5df02](https://github.com/Daxiongmao87/termaite/commit/dc5df02ae3edc96e737f3adb3a1e77ec46c83713))

### [0.2.2](https://github.com/Daxiongmao87/termaite/compare/v0.2.1...v0.2.2) (2025-08-23)

### [0.2.1](https://github.com/Daxiongmao87/termaite/compare/v0.2.0...v0.2.1) (2025-08-23)


### 📦 Build System

* switch to standard-version for releases ([af4cbcc](https://github.com/Daxiongmao87/termaite/commit/af4cbccff9f43f12aacb0876a0e6910fd07bcfcf))


### 🔧 Chores

* remove defunct publish script ([6d87e27](https://github.com/Daxiongmao87/termaite/commit/6d87e27f27b3a07e060d941d9084ec2c68696b74))

## [0.2.0] - 2025-08-23

### ✨ Features

- build: add conventional commits validation (d14db8d)
- feat: Improve keyboard shortcuts for input (d1721ba)
- feat: Add history navigation with arrow keys (5977ce6)
- Add CONTRIBUTING.md with commit guidelines (ee5c9e0)
- Add initial CHANGELOG.md (614f6d5)
- Add npm publish workflow with changelog (b88f75e)
- Implement working cursor navigation for input field (0d41458)
- Add gradient colors to termaite logo and title (b030e2d)
- Create comprehensive config template when settings.json doesn't exist (61547f9)
- Add global timeout override and increase default to 300 seconds (c014c44)
- Add agent failure detection and automatic fallback (7d31923)
- Implement proper rotation strategies and multi-agent support (da530a4)
- Add permission bypass flags to agent command examples (734e553)
- Add helpful error messages when no agents are configured (56f8bc8)
- Add scrolling support and fix input container border (e063ec9)
- Initial termaite implementation (cd6f0aa)

### 🐛 Bug Fixes

- Fix spinner removal to not persist in chat history (7b3fb4c)
- Fix spinner positioning to appear inline with chat (ebfcf6e)
- Fix agent command examples with correct non-interactive flags (5fc9039)
- Fix -c flag to work in non-interactive mode (fa836cb)
- Fix project folder naming to match Claude's convention (9b68e6f)
- Fix terminal handling for clear, config, and exit commands (0926549)
- Fix text formatting by switching to blessed.log widget (5302d4c)
- Fix scrolling and UI improvements (4991012)
- Fix input focus issues and keyboard handling (c833c92)
- Fix chat input and improve UI layout (e79a928)

### ♻️ Refactoring

- Update copyright year and repository URL (14279d5)

### 📝 Documentation

- docs: update commit guidelines for conventions (e6e4dab)
- docs(README): add Early Alpha notice and generalize agent list (8c96aeb)
- docs(README): remove prescriptive Supported Agents; add safety disclaimer (263a726)

### 🔧 Other Changes

- Revert "Enhance input box with proper cursor navigation" (a6e1709)
- Enhance input box with proper cursor navigation (b0e96a4)
- Make spinner bold for better visibility (b7314e3)
- Adjust spinner alignment and reduce speed (d33470a)
- Replace binary animation with simple spinner (4afc43a)
- Expand ignore list for editors, build/caches, and OS junk (3bacbed)
- Ignore temp tests and agent docs; prep for history purge (b4432fe)
- Replace ASCII header with image in README; mark Early Alpha. Include image in package files and bump version to 0.1.1. (8796626)
- Refine docs and UI; switch to binary animation (cfd8769)
- Prepare package for npm publishing (fdf731c)
- Improve timeout handling with configurable and indefinite options (3996b1c)


## [Unreleased]

### Added
- NPM publish workflow with automatic changelog generation
- Git commit-msg hook to enforce 50 character limit
- Dry-run functionality for testing releases

## [0.1.1] - 2025-08-22

### Added
- Initial release of termaite
- Multi-agent AI CLI wrapper functionality
- Intelligent agent rotation and fallback
- Conversation history management
- Gradient UI with blessed terminal interface
- Support for Claude, Gemini, Qwen, Cursor, and other AI agents