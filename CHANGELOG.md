# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.2.12](https://github.com/Daxiongmao87/termaite/compare/v0.2.11...v0.2.12) (2025-08-30)


### ♻️ Code Refactoring

* **ui:** improve key handling and agent availability logic ([7b95b77](https://github.com/Daxiongmao87/termaite/commit/7b95b7756a5dc359fea4d2de8606f728ad8acac7))

### [0.2.11](https://github.com/Daxiongmao87/termaite/compare/v0.2.10...v0.2.11) (2025-08-29)


### ⏪ Reverts

* **ui:** use 🗄 icon per design; keep fullUnicode enabled ([701348a](https://github.com/Daxiongmao87/termaite/commit/701348adaad0d9a2ced509a4e3adc3dc88cecde5))


### 🐛 Bug Fixes

* adaptive retry ([e37f48d](https://github.com/Daxiongmao87/termaite/commit/e37f48d1e8e876f4b8c3eacca81ea820cd2277b7))
* **compaction:** enhance error handling and validation ([b176670](https://github.com/Daxiongmao87/termaite/commit/b1766705c5481f2267c489fbe56116796a2b0440))
* **ui:** enable fullUnicode and swap 🗄 with ⚙ for agent status ([c2234af](https://github.com/Daxiongmao87/termaite/commit/c2234af8c4b0bcc39d6fc4463832d81c8955911d))
* **ui:** move current-agent dot to left of 🗄 in info line ([99f46c1](https://github.com/Daxiongmao87/termaite/commit/99f46c1d8da597c0e38ff2906090741392c818bd))
* **ui:** resolve terminal focus issue after screen.exec() calls ([b5b609b](https://github.com/Daxiongmao87/termaite/commit/b5b609bc29a05fb44d094cd49162f249db2b6e0e))
* **ui:** show last percentage reliably ([51fda8e](https://github.com/Daxiongmao87/termaite/commit/51fda8e90249a5f048918b5d6844b971d5a17fd7))
* **ui:** show percentage again on info line ([1cdc34d](https://github.com/Daxiongmao87/termaite/commit/1cdc34d00c60b8972eb37c7b8a2c2b8c7b91edcc))


### 📝 Documentation

* **readme:** clarify web UI capabilities and slash command support ([6902e01](https://github.com/Daxiongmao87/termaite/commit/6902e014430e7985eef107091de5b158043a6e43))
* **readme:** correct web host/port defaults and non-interactive examples ([2d793c8](https://github.com/Daxiongmao87/termaite/commit/2d793c82c122e1b9a2af871aac31ac8aef25847e))
* **readme:** document timeoutBuffer and clarify web/history behavior ([328dae7](https://github.com/Daxiongmao87/termaite/commit/328dae7df22c7e6c617aacb47483fe83fbea648b))
* **readme:** replace pipe examples with safe prompt substitution ([ff2f190](https://github.com/Daxiongmao87/termaite/commit/ff2f190d613d890ecc173ddd3ad7767a3d85b47c))
* **readme:** sync features with code ([1e18556](https://github.com/Daxiongmao87/termaite/commit/1e18556393e8057b40f51e08477584bd34181345))


### ✨ Features

* add -h short alias for --help flag ([9021aa4](https://github.com/Daxiongmao87/termaite/commit/9021aa4d56f013f7c04f60495e67d9ffd6648129))
* add strategy command updates rotation strategy in settings.json ([45b1ba3](https://github.com/Daxiongmao87/termaite/commit/45b1ba30d99daf779e117ccaf196a67457cb3556))
* auto-generate agent IDs and support spaces in agent names ([443e24e](https://github.com/Daxiongmao87/termaite/commit/443e24e63c7b1e81bea823a2105e65e90f30180c))
* implement 25% token limit ([56a261f](https://github.com/Daxiongmao87/termaite/commit/56a261f42c437506fa4060bcbad067f20c03de3d))
* **ui:** add agent status display in web interface ([c783c77](https://github.com/Daxiongmao87/termaite/commit/c783c771586a7db1d80213b43b8be61958d5382c))
* **ui:** add bottom info line for agent context usage and improve rotation ([59b172e](https://github.com/Daxiongmao87/termaite/commit/59b172e769ef8217be570d3b231f286ceff702be))
* **ui:** add elapsed time display to spinner animation ([1d5ef4f](https://github.com/Daxiongmao87/termaite/commit/1d5ef4ff5d86febdec12146f8f1eb678a93da4ba))
* **ui:** ensure bottom-left cwd is always visible and non-overlapping ([98af341](https://github.com/Daxiongmao87/termaite/commit/98af341755377c039c86569cad20a059b75cf5bb)), closes [#2](https://github.com/Daxiongmao87/termaite/issues/2)
* **ui:** live-refresh info line indicator ([d35b18d](https://github.com/Daxiongmao87/termaite/commit/d35b18d8a594265265a1df7da0c4fca6675e0282))
* **ui:** show current working directory on bottom-left info line ([5d111f3](https://github.com/Daxiongmao87/termaite/commit/5d111f3969bb43f12c18cfdca80c7c6dbafe6cd0)), closes [#3](https://github.com/Daxiongmao87/termaite/issues/3)

### [0.2.10](https://github.com/Daxiongmao87/termaite/compare/v0.2.9...v0.2.10) (2025-08-27)


### ✨ Features

* add -V short alias for --version flag ([4bd62b3](https://github.com/Daxiongmao87/termaite/commit/4bd62b335d18f241d7856f6ae91782ee414d0ebc))

### [0.2.9](https://github.com/Daxiongmao87/termaite/compare/v0.2.8...v0.2.9) (2025-08-27)


### 🐛 Bug Fixes

* add missing --web/-w flag to help output ([66bdce5](https://github.com/Daxiongmao87/termaite/commit/66bdce506c9b390e72b08ff13e66fffe1fddc165))

### [0.2.8](https://github.com/Daxiongmao87/termaite/compare/v0.2.7...v0.2.8) (2025-08-26)


### 📝 Documentation

* update README with web interface and missing features ([4693c4b](https://github.com/Daxiongmao87/termaite/commit/4693c4b9eaca7fffb95f90d60a3e230cd233be7d))

### [0.2.7](https://github.com/Daxiongmao87/termaite/compare/v0.2.6...v0.2.7) (2025-08-26)


### 📝 Documentation

* update README.md to accurately reflect features and commands ([daf3021](https://github.com/Daxiongmao87/termaite/commit/daf302142f587a19f53995245625442e77384ea1))


### 🐛 Bug Fixes

* arrow key history navigation in web interface ([aab1422](https://github.com/Daxiongmao87/termaite/commit/aab1422d140229eca69f904fd71e90d64d318fb2))
* implement full /init command parity between web UI and TUI ([4ca401f](https://github.com/Daxiongmao87/termaite/commit/4ca401f06ebaa5a7457b72c105d17ab53c4700fc))
* improve history management and web interface UX ([835b7d9](https://github.com/Daxiongmao87/termaite/commit/835b7d9d8f9217cd82092cf6018feaac22c634e4))
* improve web interface input handling and arrow key navigation ([d926641](https://github.com/Daxiongmao87/termaite/commit/d9266417bf769dc2c1de2898b60e5b39e5300f8b))
* resolve /select command hanging and implement slash command parity ([ddee55a](https://github.com/Daxiongmao87/termaite/commit/ddee55ab4d67eb1ae390d0a2ed11607637e5ebfd))
* resolve web interface regex errors and slash command display ([a83c489](https://github.com/Daxiongmao87/termaite/commit/a83c48926c85ee6b3f4cdcb0c29174ed99e1d7c1))


### ✨ Features

* add comprehensive web interface with autocomplete and enhanced UX ([8388918](https://github.com/Daxiongmao87/termaite/commit/8388918f44ba53da1d49668e8147f3cf0b1d6f74))
* add simple input size handling and safety buffer ([9f88b5a](https://github.com/Daxiongmao87/termaite/commit/9f88b5a03d0f424cad4db5c7a05fc74dd30c671a))
* enhance web interface UX to match TUI parity ([9adc6c4](https://github.com/Daxiongmao87/termaite/commit/9adc6c414b709b950a3406999c7c204efef6110d))


### ♻️ Code Refactoring

* simplify init command broadcast ([31a425a](https://github.com/Daxiongmao87/termaite/commit/31a425ab9d5066c4fb9a5784f6c9281a0fc0d8ae))

### [0.2.6](https://github.com/Daxiongmao87/termaite/compare/v0.2.5...v0.2.6) (2025-08-25)


### 🐛 Bug Fixes

* restore border visibility and improve spinner colors ([bc96792](https://github.com/Daxiongmao87/termaite/commit/bc9679210d0d01457836b7fa97b3c3e20753d73c))

### [0.2.5](https://github.com/Daxiongmao87/termaite/compare/v0.2.4...v0.2.5) (2025-08-25)

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