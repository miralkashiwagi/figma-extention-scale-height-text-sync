# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript
- **Watch**: `npm run watch` - Builds continuously on file changes
- **Lint**: `npm run lint` - Runs ESLint on TypeScript files
- **Lint & Fix**: `npm run lint:fix` - Automatically fixes linting issues where possible

## Project Overview

This is a Figma plugin called "FrameHeight->TextSync" that automatically synchronizes text content with component heights. The plugin creates and manages component variants that display their current height as text with a distinctive red/pink design.

### Architecture

**Core Files:**
- `code.ts` - Main plugin logic and Figma API interactions
- `ui.html` - Plugin UI for manual controls
- `manifest.json` - Figma plugin configuration

**Key Components:**
- **Scale Component Set**: A component set with "Vertical" and "Horizontal" variants
- **Component ID Management**: Uses stored component ID to track scale instances
- **Auto-sync System**: Real-time height tracking with document/selection change events

### Plugin Functionality

1. **Component Creation** (`getOrCreateScaleComponentSet`): Creates a "FrameHeight->TextSync" component set with vertical/horizontal variants, red/pink design and locked text
2. **Instance Management** (`getScaleInstances`): Uses Component ID to identify all scale instances in document or selection
3. **Text Synchronization** (`syncOne`, `syncAll`): Updates text to match current height, adjusts line stroke weight, and locks text after update
4. **Auto Mode**: Monitors document changes for real-time updates while plugin is open

### Technical Details

- Uses TypeScript with strict mode and Figma Plugin API
- Component ID storage via `SCALE_COMPONENT_ID_KEY = "scaleComponentId"`
- Component name: `SCALE_COMPONENT_NAME = "FrameHeight->TextSync"`
- Text node name: `VALUE_NODE_NAME = "value"` (locked after sync)
- Color scheme: Red background (`{r: 1, g: 0, b: 0.3}`) with darker red foreground (`{r: 0.85, g: 0, b: 0.3}`)
- Dynamic stroke weight: 0.5px for heights ≤10px, 1px for larger heights
- UI messaging system between plugin and HTML interface
- Batch processing (50 instances per batch) to avoid memory issues

### Development Notes

- The plugin creates instances near viewport center
- Height values are rounded and displayed with "px" suffix
- Auto-sync prioritizes selection scope for performance during document changes
- Instances are detected via Component ID matching to main component set
- Text nodes are locked to prevent accidental editing
- Plugin performs startup sync on launch, updating all instances
- Event listeners are cleaned up when plugin closes
- Japanese UI text and notifications