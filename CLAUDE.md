# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Tracker is a Chrome/Firefox extension that tracks video progress on YouTube. It automatically saves where you left off in videos and resumes from that position when you return. The extension saves progress every 5 seconds for short videos (<15 min) and every 30 seconds for longer videos.

Built with [WXT](https://wxt.dev) — a single-package setup with no monorepo.

## Development Commands

```bash
pnpm install               # Install dependencies (also runs wxt prepare)

pnpm run dev               # Build Chrome extension in development mode with watch
pnpm run dev:firefox       # Build for Firefox with watch

pnpm run build             # Build for Chrome (production)
pnpm run build:firefox     # Build for Firefox (production)
pnpm run zip               # Build and create a zip file for Chrome
pnpm run zip:firefox       # Build and create a zip file for Firefox

pnpm run test              # Run unit tests with Vitest
pnpm run type-check        # Run TypeScript type checking
pnpm run lint              # Run ESLint on src/
```

## Architecture

### Project Structure

```
src/
  entrypoints/
    background.ts          # Toolbar badge/title (video count, paused state) + toggle-tracking command
    content.ts              # Content script entry point (defineContentScript)
    content/
      videoUtils.ts         # saveProgress / loadProgress
      videoUtils.test.ts
      youtubeUtils.ts       # getVideoId / getVideoElement / getVideoTitle
      youtubeUtils.test.ts
    popup/
      index.html
      main.tsx              # React root
      App.tsx               # Popup UI: tracking toggle + tracked video list
      App.css               # Tailwind CSS import + popup styles
    options/
      index.html
      main.tsx              # React root
      App.tsx               # Options page: full video list, export/import, clear all
      App.css
  hooks/
    useVideoStorage.ts     # React hook for live storage updates (used by popup + options)
    index.ts
  storage/
    videoStorage.ts         # videoStorageItem, trackingEnabledItem (WXT storage) + videoStorage helpers
    videoStorage.test.ts
    index.ts                # Barrel re-exported as `@/storage`
  utils.ts                  # formatTime / timeAgo
  utils.test.ts
  test/
    setup.ts                # Vitest global setup (suppresses console.warn)
public/
  icon-16.png
  icon-48.png
  icon-128.png
wxt.config.ts               # WXT config: srcDir, React module, Tailwind, manifest (incl. toggle-tracking command)
tsconfig.json               # Extends .wxt/tsconfig.json after wxt prepare
```

Build outputs go to `.output/chrome-mv3/` and `.output/firefox-mv2/`.

### Video Tracking Flow

1. **Content Script Initialization** (`src/entrypoints/content.ts`):
   - Defined via `defineContentScript` with `matches: ['*://*.youtube.com/watch*']`
   - Listens for YouTube SPA navigation events (`yt-navigate-finish`, `popstate`)
   - Implements retry logic to handle race conditions with YouTube's dynamic page loading

2. **Progress Tracking**:
   - Extracts video ID from URL and locates video element in DOM
   - Loads saved progress from storage via `videoStorage.getById()`
   - Sets video `currentTime` to resume from last position
   - Saves progress periodically (5s for short videos, 30s for long videos) when playing
   - Saves immediately on pause, video end, or page unload

3. **Storage Layer** (`src/storage/videoStorage.ts`, exported via `@/storage`):
   - Uses `wxt/utils/storage` — `storage.defineItem<VideoStateType>('local:video-storage')`
   - `videoStorageItem` is the raw WXT storage item (used for `.watch()` in the shared hook)
   - `videoStorage` is a convenience wrapper with `getById`, `save`, `remove` — writes are serialized through an internal queue to avoid clobbering concurrent saves
   - `trackingEnabledItem` (`local:tracking-enabled`, boolean, default `true`) is the global on/off switch checked by the content script before loading/saving progress
   - Each video entry contains: `id`, `progress` (currentTime in seconds), `duration?`, `timestamp`, `title`, `url`
   - `isValidVideoState()` validates untrusted data (used by the options page's JSON import)

4. **Popup UI** (`src/entrypoints/popup/`):
   - React 19 component displaying tracked videos sorted by timestamp, plus a tracking on/off toggle and a settings button (opens the options page)
   - `useVideoStorage` hook (`src/hooks/`) subscribes to live storage changes via `videoStorageItem.watch()`
   - Styled with Tailwind CSS v4

5. **Options Page** (`src/entrypoints/options/`):
   - Full-page video list (same data as the popup) with export/import (JSON) and clear-all controls
   - Reuses `useVideoStorage` and `isValidVideoState`

6. **Background** (`src/entrypoints/background.ts`):
   - Sets the toolbar badge to the tracked-video count, or a gray "paused" indicator when `trackingEnabledItem` is `false`
   - Registers the `toggle-tracking` command (default shortcut `Alt+Shift+Y`, declared in `wxt.config.ts`) to flip `trackingEnabledItem` without opening the popup

### Build System

- **WXT** orchestrates the entire build — no Turborepo, no pnpm workspaces
- **Vite** (via WXT) handles bundling
- **Tailwind CSS v4** configured via `@tailwindcss/vite` plugin in `wxt.config.ts`
- **TypeScript** with strict mode; `.wxt/tsconfig.json` is auto-generated by `wxt prepare`
- Firefox builds use MV2 and automatically exclude Chrome-only manifest features
- `wxt prepare` is run automatically via `postinstall`

### Code Quality

- **ESLint** (`eslint.config.js`) — flat config with `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react`, `@stylistic/eslint-plugin`, and `eslint-plugin-import`
- **lint-staged** — runs ESLint on staged `src/**/*.{ts,tsx}` files before each commit
- **husky** — git hooks: `pre-commit` runs lint-staged, `commit-msg` runs commitlint
- **commitlint** (`commitlint.config.js`) — enforces Conventional Commits format: `type(scope): description`
  - Valid types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `ci`, etc.

### Testing

- **Vitest** (`vitest.config.ts`) — unit tests run with `pnpm run test`
- **jsdom** environment — DOM APIs are available in tests without a browser
- Test files live alongside the source files they test (`*.test.ts`)
- `src/test/setup.ts` is the global setup file (currently suppresses `console.warn`)
- `wxt/utils/storage` must be mocked in tests because it relies on the browser extension runtime

### CI

GitHub Actions runs on every push to `main` and on all pull requests (`.github/workflows/ci.yml`):
1. `pnpm run test`
2. `pnpm run type-check`
3. `pnpm run lint`
4. `pnpm run build` (Chrome)
5. `pnpm run build:firefox` (Firefox)

## Development Notes

### Working with Content Scripts
- Content scripts have access to the page DOM but run in an isolated JavaScript context
- The main entry point is `src/entrypoints/content.ts` using `defineContentScript` (WXT auto-import)
- DOM helpers are in `src/entrypoints/content/youtubeUtils.ts`
- Storage helpers are in `src/entrypoints/content/videoUtils.ts`

### Working with Storage
- Import from `@/storage` (barrel over `src/storage/videoStorage.ts`)
- Use `videoStorage` for read/write operations (`getById`, `save`, `remove`)
- Use `videoStorageItem` directly when you need to subscribe to changes (`.watch()`), or `trackingEnabledItem` for the global on/off flag
- Storage operations are async and return Promises

### Popup vs Options
- Popup (`src/entrypoints/popup/`) is the quick-glance view: recent videos, tracking toggle, link to options
- Options page (`src/entrypoints/options/`) is the full management view: all videos, export/import, clear all
- Both share `useVideoStorage` from `src/hooks/`

### Multi-Browser Support
- Chrome builds target MV3, Firefox targets MV2 — WXT handles this automatically
- Test both browsers using `pnpm run dev` vs `pnpm run dev:firefox`
- Build outputs are in `.output/chrome-mv3/` and `.output/firefox-mv2/`

### Hot Module Replacement
- Development mode includes HMR for the popup (changes reflect immediately)
- Changes to content scripts require manually reloading the extension in the browser
