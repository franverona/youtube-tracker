# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

- Implement every change (fix, improvement, feature, etc.) on a new branch created from an up-to-date `main` — never commit directly to `main`.
- Each change gets its own branch and its own PR — always open a PR.
- A PR must not be merged until CI passes successfully.
- Never add Claude/Anthropic attribution: no `Co-Authored-By` trailer in commits and no "Generated with Claude Code" line in PR descriptions.

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
pnpm run format            # Format src/ with Prettier
pnpm run format:check      # Check Prettier formatting (run in CI)
```

## Architecture

### Project Structure

```
src/
  entrypoints/
    background.ts          # Toolbar badge/title, storage-write queue, toggle-tracking + resume-last-video commands
    content.ts              # Content script entry point (defineContentScript)
    content/
      videoUtils.ts         # saveProgress / loadProgress
      videoUtils.test.ts
      resumeNotice.ts       # In-player "Resumed at … · Start over" notice
      resumeNotice.test.ts
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
    useUndo.ts             # Undo for removals (used by popup + options)
    useUndo.test.tsx
    useIgnoredVideos.ts    # React hook for the don't-track list (options page)
    index.ts
  storage/
    videoStorage.ts         # videoStorageItem, trackingEnabledItem, ignoredVideosItem (WXT storage) + helpers
    videoStorage.test.ts
    index.ts                # Barrel re-exported as `@/storage`
  utils.ts                  # formatTime / timeAgo
  utils.test.ts
  test/
    setup.ts                # Vitest global setup (suppresses console.warn)
    content.test.ts         # Content script tests (see Testing)
    background.test.ts      # Background script tests
public/
  icon.svg
  icon-16.png
  icon-48.png
  icon-128.png
wxt.config.ts               # WXT config: srcDir, React module, Tailwind, manifest (incl. keyboard commands)
tsconfig.json               # Extends .wxt/tsconfig.json after wxt prepare
```

Build outputs go to `.output/chrome-mv3/` and `.output/firefox-mv2/`.

### Video Tracking Flow

1. **Content Script Initialization** (`src/entrypoints/content.ts`):
   - Defined via `defineContentScript` with `matches: ['https://*.youtube.com/*']` (YouTube reaches most videos via in-page navigation, so the script must already be present; it bails outside `/watch`) and `excludeMatches: ['https://music.youtube.com/*']` (Music also uses `/watch?v=`)
   - Re-initializes on YouTube SPA navigation (`yt-navigate-finish`, `popstate`), and on a capture-phase `play` from a new main `<video>` — YouTube can replace the element without navigating; for the same video it only re-attaches listeners and doesn't resume again
   - Saves on `yt-navigate-start`, while the URL still names the current video, so leaving `/watch` (e.g. into the miniplayer, which isn't tracked) keeps the real position
   - Implements retry logic to handle race conditions with YouTube's dynamic page loading

2. **Progress Tracking**:
   - Extracts video ID from URL (`getVideoId()` returns `null` unless `v` is an 11-character id) and locates the main video element
   - Loads saved progress via `videoStorage.getById()` and seeks to it minus `RESUME_REWIND` (3s), calling `play()` if the player was paused; then shows the in-player resume notice, whose "Start over" seeks to 0 and removes the entry
   - Resume is skipped when the save is within 5s of the end, when the element is already past `MIN_SAVED_PROGRESS` (e.g. the miniplayer expanding back), and waits while a pre-roll ad is showing (ads play in the same `<video>`)
   - Saves progress periodically (5s for short videos, 30s for long videos) when playing
   - Nothing is saved before 15s of progress (`MIN_SAVED_PROGRESS`), so previews and misclicks don't create entries
   - In the last 5% of a video (capped at 60s) a save removes the entry instead, treating it as finished like `ended`
   - Saves immediately on pause; `ended` removes the entry (there is no `beforeunload`/`pagehide` save — the periodic save covers tab close)
   - Skips resume when the URL has `t=`/`start=`; skips load/save for live streams (non-finite `duration`)
   - `canWrite()` blocks every save/remove while tracking is paused, the video is on the don't-track list, an ad is showing (`#movie_player.ad-showing`), the URL already names another video, or the extension context is gone

3. **Storage Layer** (`src/storage/videoStorage.ts`, exported via `@/storage`):
   - Uses `wxt/utils/storage` — `storage.defineItem<VideoStateType>('local:video-storage')`
   - `videoStorageItem` is the raw WXT storage item (used for `.watch()` in the shared hook)
   - `videoStorage` is a convenience wrapper with `getById`, `save`, `remove`, `clear`, `import` — writes are sent via `runtime.sendMessage` to the background, which applies them through a single queue (`applyVideoStorageWrite`) so tabs, popup and options can't clobber each other
   - The background validates every write where it's applied (content scripts sit next to a page we don't control) and replies `{ ok: false, error }` when it's invalid or fails (e.g. quota); `videoStorage` writes then reject, so callers must handle errors
   - `import` merges rather than replaces: per id the entry with the newer `timestamp` wins (`importWins`), and nothing is deleted
   - `trackingEnabledItem` (`local:tracking-enabled`, boolean, default `true`) is the global on/off switch checked by the content script before loading/saving progress
   - `ignoredVideosItem` (`local:ignored-videos`, id → title) is the per-video don't-track list, changed through `ignoredVideos.add/remove`
   - Each video entry contains: `id`, `progress` (currentTime in seconds), `duration?`, `timestamp`, `title`, `url`
   - `isValidVideoState()` validates untrusted data (import file, background writes): 11-character id matching its key, finite non-negative numbers, timestamp at most a day in the future, `https://www.youtube.com/` url

4. **Popup UI** (`src/entrypoints/popup/`):
   - React 19 component showing the 10 most recent tracked videos (`POPUP_VIDEO_LIMIT`, then a "View all" link to the options page), a tracking on/off toggle and a settings button
   - Each row has Remove (undoable) and "Don't track this video" (adds it to the ignore list and removes the entry)
   - `useVideoStorage` hook (`src/hooks/`) subscribes to live storage changes via `videoStorageItem.watch()`
   - Styled with Tailwind CSS v4; dark mode is automatic via the `dark:` variant (`prefers-color-scheme`) — no manual toggle or stored theme setting

5. **Options Page** (`src/entrypoints/options/`):
   - Full-page video list with export/import (JSON) and clear-all controls; the import message counts only the entries the merge applied
   - "Not tracked" list of ignored videos with "Track again"
   - Reuses `useVideoStorage`, `useIgnoredVideos` and `isValidVideoState`
   - Same automatic dark mode as the popup

6. **Background** (`src/entrypoints/background.ts`):
   - Sets the toolbar badge to the tracked-video count, or a gray "paused" indicator when `trackingEnabledItem` is `false`
   - Handles all video-storage writes sent by this extension's contexts (checks `sender.id`; `isVideoStorageWrite` / `applyVideoStorageWrite`)
   - Uses `browser.action ?? browser.browserAction` (Firefox MV2 only has `browserAction`)
   - Registers an empty `runtime.onStartup` listener: without it Chrome doesn't wake the MV3 worker at launch, and the badge (which Chrome doesn't persist) stays blank
   - Commands (declared in `wxt.config.ts`): `toggle-tracking` (`Alt+Shift+Y`) flips `trackingEnabledItem`; `resume-last-video` (`Alt+Shift+L`) opens the newest entry's URL in a new tab, where the content script resumes it

### Build System

- **WXT** orchestrates the entire build — no Turborepo, single package (`pnpm-workspace.yaml` exists only for pnpm settings: `engineStrict`, `overrides`, `allowBuilds` — pnpm 11 ignores non-auth settings in `.npmrc`)
- **Vite** (via WXT) handles bundling
- **Tailwind CSS v4** configured via `@tailwindcss/vite` plugin in `wxt.config.ts`
- **TypeScript** with strict mode; `.wxt/tsconfig.json` is auto-generated by `wxt prepare`
- Firefox builds use MV2 and automatically exclude Chrome-only manifest features
- `wxt prepare` is run automatically via `postinstall`

### Code Quality

- **ESLint** (`eslint.config.mjs`) — flat config with `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-config-prettier`; `pnpm run lint` uses `--max-warnings=0`, so warnings fail CI
- **Prettier** (`.prettierrc`, with `prettier-plugin-tailwindcss`) — `pnpm run format` / `format:check`; CI runs the check
- **lint-staged** — before each commit runs Prettier + ESLint on staged `src/**/*.{ts,tsx}` and Prettier on `src/**/*.{css,html}`
- **husky** — git hooks: `pre-commit` runs lint-staged, `commit-msg` runs commitlint
- **commitlint** (`commitlint.config.js`) — enforces Conventional Commits format: `type(scope): description`, locally on commits and in CI on PR titles (squash merges use the title as the commit on `main`)
  - Valid types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `ci`, etc.

### Testing

- **Vitest** (`vitest.config.ts`) — unit tests run with `pnpm run test`
- **jsdom** environment — DOM APIs are available in tests without a browser
- Test files live alongside the source files they test (`*.test.ts`, or `*.test.tsx` for React hooks/components), except tests for top-level entrypoints (`content.ts`, `background.ts`), which live in `src/test/` because WXT treats every file at the root of `entrypoints/` as an entrypoint
- `src/test/setup.ts` is the global setup file (currently suppresses `console.warn`)
- `wxt/utils/storage` and `wxt/browser` must be mocked in tests because they rely on the browser extension runtime (most tests just mock `@/storage`)
- WXT auto-imports aren't available under Vitest: content/background tests stub `defineContentScript` / `defineBackground` and `browser` with `vi.stubGlobal`
- `src/test/content.test.ts` sets the jsdom URL to `https://www.youtube.com/` via `@vitest-environment-options`, since the content script bails outside `youtube.com/watch`

### CI

GitHub Actions runs on pushes to `main` (except docs-only changes: `**/*.md`, `LICENSE`, `.gitignore`) and on all pull requests, including title edits (`.github/workflows/ci.yml`):
1. PR title lint (commitlint), on pull requests only
2. `pnpm run test`
3. `pnpm run type-check`
4. `pnpm run lint`
5. `pnpm run format:check`
6. `pnpm run zip` (Chrome build + zip)
7. `pnpm run zip:firefox` (Firefox build + zip, plus the sources zip)

The job ("Type check & build") is a required status check on `main` via a repository ruleset, which also requires a PR for every change (admins can bypass only through a PR), so PRs — including Dependabot auto-merges — can't merge until it passes.

Pushing a `v*` tag runs `.github/workflows/release.yml`: it checks the tag matches `package.json`'s `version` and that the commit is on `main`, runs `test` + `type-check`, then `zip` + `zip:firefox`, and publishes a GitHub release with the zips (re-runnable: an existing release gets its assets replaced).

## Development Notes

### Working with Content Scripts
- Content scripts have access to the page DOM but run in an isolated JavaScript context
- The main entry point is `src/entrypoints/content.ts` using `defineContentScript` (WXT auto-import)
- DOM helpers are in `src/entrypoints/content/youtubeUtils.ts`
- Storage helpers are in `src/entrypoints/content/videoUtils.ts`

### Working with Storage
- Import from `@/storage` (barrel over `src/storage/videoStorage.ts`)
- Use `videoStorage` for read/write operations (`getById`, `save`, `remove`, `clear`, `import`)
- Never write with `videoStorageItem.setValue()` directly: `videoStorage` writes go through the background queue, and a direct write from another context can overwrite or be overwritten by concurrent saves
- Use `videoStorageItem` directly when you need to subscribe to changes (`.watch()`), or `trackingEnabledItem` for the global on/off flag
- `ignoredVideosItem` is written directly (via `ignoredVideos`), not through the queue — fine while only popup/options clicks change it
- Storage operations are async and return Promises

### Popup vs Options
- Popup (`src/entrypoints/popup/`) is the quick-glance view: the 10 most recent videos, tracking toggle, link to options
- Options page (`src/entrypoints/options/`) is the full management view: all videos, export/import, clear all, the don't-track list
- Both share `useVideoStorage` and `useUndo` from `src/hooks/`; `useUndo` keeps the last removal (single delete or Clear all) in memory for 5s and restores it via `videoStorage.import`

### Multi-Browser Support
- Chrome builds target MV3, Firefox targets MV2 — WXT handles this automatically
- Test both browsers using `pnpm run dev` vs `pnpm run dev:firefox`
- Build outputs are in `.output/chrome-mv3/` and `.output/firefox-mv2/`

### Hot Module Replacement
- Development mode includes HMR for the popup (changes reflect immediately)
- Changes to content scripts require manually reloading the extension in the browser
