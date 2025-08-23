# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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