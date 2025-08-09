# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript
- **Watch**: `npm run watch` - Builds continuously on file changes
- **Lint**: `npm run lint` - Runs ESLint on TypeScript files
- **Lint & Fix**: `npm run lint:fix` - Automatically fixes linting issues where possible

## Project Overview

This is a Figma plugin called "Scale: Height→Text Sync" that automatically synchronizes text content with component heights. The plugin creates and manages scale-ruler/height-sync components that display their current height as text with a distinctive pink design.

### Architecture

**Core Files:**
- `code.ts` - Main plugin logic and Figma API interactions
- `ui.html` - Plugin UI for manual controls and auto-sync toggle
- `manifest.json` - Figma plugin configuration

**Key Components:**
- **Scale Component**: A reusable "scale-ruler/height-sync" component with height-synced text
- **Component ID Management**: Uses stored component ID to track scale instances
- **Auto-sync System**: Real-time height tracking with document/selection change events

### Plugin Functionality

1. **Component Creation** (`getOrCreateScaleComponent`): Creates a "scale-ruler/height-sync" component with pink design and locked text
2. **Instance Management** (`getScaleInstances`): Uses Component ID to identify all scale instances (manual and automatic)
3. **Text Synchronization** (`syncOne`, `syncAll`): Updates text to match current height and locks text after update
4. **Auto Mode**: Monitors document changes for real-time updates

### Technical Details

- Uses TypeScript with strict mode and Figma Plugin API
- Component ID storage via `SCALE_COMPONENT_ID_KEY = "scaleComponentId"`
- Text node name: `"value - please detach if you want to edit"` (locked after sync)
- Font handling via `ensureFontsFor` for mixed font scenarios
- UI messaging system between plugin and HTML interface
- No relaunch functionality (removed for simplicity)

### Development Notes

- The plugin automatically places components in a "Components" page if available
- Height values are rounded and displayed with "px" suffix
- Auto-sync prioritizes selection scope for performance
- Manual and automatic instances are detected via Component ID matching
- Text nodes are locked to prevent accidental editing
- Instances can be manually created and will be auto-detected