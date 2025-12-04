# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Tracker is a Chrome/Firefox extension that tracks video progress on YouTube. It automatically saves where you left off in videos and resumes from that position when you return. The extension saves progress every 5 seconds for short videos (<15 min) and every 30 seconds for longer videos.

## Development Commands

### Initial Setup
```bash
pnpm install                # Install dependencies
pnpm copy-env              # Copy environment files (runs automatically after install)
```

### Development
```bash
pnpm dev                   # Build extension in development mode with watch
pnpm dev:firefox          # Build for Firefox with watch
```

### Building
```bash
pnpm build                # Build for Chrome (production)
pnpm build:firefox        # Build for Firefox (production)
pnpm zip                  # Build and create a zip file for Chrome
pnpm zip:firefox          # Build and create a zip file for Firefox
```

### Code Quality
```bash
pnpm type-check           # Run TypeScript type checking across all packages
pnpm lint                 # Run ESLint on all packages
pnpm lint:fix             # Auto-fix linting issues
pnpm format               # Format code with Prettier
```

### Testing
```bash
pnpm e2e                  # Run end-to-end tests (Chrome)
pnpm e2e:firefox          # Run end-to-end tests (Firefox)
```

### Cleanup
```bash
pnpm clean:bundle         # Remove dist folders
pnpm clean:turbo          # Remove Turbo cache
pnpm clean:node_modules   # Remove all node_modules
pnpm clean                # Full cleanup (all of the above)
pnpm clean:install        # Clean and reinstall dependencies
```

## Architecture

### Monorepo Structure

This is a **pnpm workspace monorepo** using **Turborepo** for build orchestration. The workspace consists of:

- **`chrome-extension/`** - Core extension configuration (manifest, public assets, background script)
- **`pages/`** - Extension pages as separate packages
- **`packages/`** - Shared libraries and utilities
- **`tests/`** - E2E tests

### Key Packages

#### Extension Pages (`pages/`)
- **`content`** - Content script that runs on YouTube watch pages. Contains the core tracking logic in `pages/content/src/matches/youtube/index.ts`
- **`popup`** - React-based popup UI shown when clicking the extension icon
- **`options`** - Options/settings page
- **`side-panel`** - Side panel interface
- **`devtools`** - DevTools integration
- **`content-ui`** - UI components injected into content pages
- **`content-runtime`** - Runtime utilities for content scripts

#### Shared Packages (`packages/`)
- **`storage`** - Chrome storage abstraction layer with type-safe APIs. Exports `videoStorage` for managing video progress state
- **`shared`** - Common utilities and types shared across the extension
- **`ui`** - Reusable React components and UI utilities
- **`i18n`** - Internationalization support
- **`env`** - Environment variable management
- **`hmr`** - Hot Module Replacement support for development
- **`vite-config`** - Shared Vite configuration
- **`tailwindcss-config`** - Shared Tailwind CSS configuration
- **`tsconfig`** - Shared TypeScript configurations
- **`dev-utils`** - Development utilities
- **`module-manager`** - Module management utilities
- **`zipper`** - Creates distribution zip files

### Video Tracking Flow

1. **Content Script Initialization** (`pages/content/src/matches/youtube/index.ts`):
   - Detects YouTube watch pages via `content_scripts` manifest configuration
   - Listens for YouTube SPA navigation events (`yt-navigate-finish`, `popstate`)
   - Implements retry logic to handle race conditions with YouTube's dynamic page loading

2. **Progress Tracking**:
   - Extracts video ID from URL and locates video element in DOM
   - Loads saved progress from Chrome storage via `videoStorage.getById()`
   - Sets video `currentTime` to resume from last position
   - Saves progress periodically (5s for short videos, 30s for long videos) when playing
   - Saves immediately on pause, video end, or page unload

3. **Storage Layer** (`packages/storage/lib/impl/videoStorage.ts`):
   - Uses Chrome's local storage API wrapped in a type-safe abstraction
   - Stores video progress indexed by video ID
   - Each entry contains: `id`, `progress` (currentTime in seconds), `timestamp`, `title`, `url`
   - Implements live update functionality for real-time state synchronization

4. **UI Components**:
   - Popup displays tracked videos with progress information
   - Built with React 19 and styled with Tailwind CSS
   - Uses workspace packages for consistent UI across extension pages

### Build System

- **Vite** for bundling with specialized configurations per package
- **Turborepo** manages task dependencies and caching across packages
- **TypeScript** with strict mode enabled
- Manifest is generated from `chrome-extension/manifest.ts` at build time
- Firefox builds automatically remove incompatible features (e.g., `sidePanel`) via manifest parser

### Environment Variables

Environment variables are defined in `.env` and copied to packages via `bash-scripts/copy_env.sh`:
- `CLI_CEB_DEV` - Development mode flag (set via `pnpm dev`)
- `CLI_CEB_FIREFOX` - Firefox build flag (set via `pnpm dev:firefox`)
- `CEB_*` - Custom environment variables accessible across packages

## Development Notes

### Working with Content Scripts
- Content scripts have access to the page DOM but run in an isolated JavaScript context
- The main tracking logic is in `pages/content/src/matches/youtube/index.ts`
- Video detection utilities are in `pages/content/src/matches/youtube/utils/`
- Content scripts are built as IIFE bundles for proper isolation

### Working with Storage
- Always use the `videoStorage` API from `@extension/storage` rather than raw Chrome APIs
- Storage operations are async and return Promises
- Use `videoStorage.save(id, details)` to persist video progress
- Use `videoStorage.getById(id)` to retrieve specific video data

### Multi-Browser Support
- Chrome and Firefox use different build outputs
- Firefox-specific builds exclude unsupported manifest features
- Test both browsers using separate commands (`pnpm dev` vs `pnpm dev:firefox`)

### Hot Module Replacement
- Development mode includes HMR for faster iteration
- Changes to content scripts require manual extension reload in browser
- Changes to popup/options pages hot-reload automatically
