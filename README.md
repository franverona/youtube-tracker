# YouTube Tracker

A Chrome and Firefox browser extension that automatically tracks your progress on YouTube videos and resumes playback from where you left off.

## Features

- **Automatic Progress Tracking**: Saves your position in videos as you watch
- **Smart Resume**: Automatically resumes videos from your last watched position
- **Intelligent Save Intervals**:
  - Short videos (<15 min): Saves every 5 seconds
  - Long videos (≥15 min): Saves every 30 seconds
- **Cross-Session Persistence**: Your progress is saved even if you close the browser
- **YouTube SPA Support**: Works seamlessly with YouTube's navigation without page reloads
- **Multi-Browser Support**: Available for both Chrome and Firefox

## Installation

### For End Users

**Chrome/Edge:**
1. Download the latest release from the [Releases](https://github.com/franverona/youtube-tracker/releases) page
2. Extract the ZIP file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extracted folder

**Firefox:**
1. Download the Firefox release from the [Releases](https://github.com/franverona/youtube-tracker/releases) page
2. Open Firefox and navigate to `about:addons`
3. Click the gear icon and select "Install Add-on From File"
4. Select the downloaded ZIP file

### For Developers

#### Prerequisites

- Node.js ≥22.15.1
- pnpm 10.11.0 (will be used automatically via `packageManager` field)

#### Setup

```bash
# Clone the repository
git clone https://github.com/franverona/youtube-tracker.git
cd youtube-tracker

# Install dependencies
pnpm install

# Start development mode
pnpm dev
```

The extension will be built to the `dist/` directory. Load the unpacked extension from there.

## Development

### Available Commands

```bash
# Development (Chrome with hot reload)
pnpm dev

# Development (Firefox)
pnpm dev:firefox

# Build for production
pnpm build              # Chrome
pnpm build:firefox      # Firefox

# Create distributable ZIP files
pnpm zip               # Chrome
pnpm zip:firefox       # Firefox

# Code quality
pnpm type-check        # TypeScript type checking
pnpm lint              # ESLint
pnpm lint:fix          # Auto-fix linting issues
pnpm format            # Format with Prettier

# Testing
pnpm e2e               # Run E2E tests (Chrome)
pnpm e2e:firefox       # Run E2E tests (Firefox)

# Cleanup
pnpm clean             # Remove all build artifacts and dependencies
pnpm clean:install     # Clean reinstall of dependencies
```

### Project Structure

```
youtube-tracker/
├── chrome-extension/   # Core extension config and manifest
├── pages/             # Extension UI pages
│   ├── content/       # Content script (YouTube tracking logic)
│   ├── popup/         # Extension popup UI
│   ├── options/       # Options page
│   ├── side-panel/    # Side panel UI
│   └── ...
├── packages/          # Shared libraries
│   ├── storage/       # Chrome storage abstraction
│   ├── ui/            # Reusable React components
│   ├── shared/        # Common utilities
│   └── ...
└── tests/            # E2E tests
```

### Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite 6
- **Monorepo**: pnpm workspaces + Turborepo
- **Language**: TypeScript 5.8
- **Styling**: Tailwind CSS 3
- **Extension API**: webextension-polyfill

### How It Works

1. **Content Script Injection**: The extension injects a content script on YouTube watch pages (`*://*.youtube.com/watch*`)

2. **Video Detection**: The script monitors for video elements and extracts the video ID from the URL

3. **Progress Monitoring**: Event listeners track video playback events:
   - `play`: Starts periodic progress saving
   - `pause`: Saves progress immediately
   - `ended`: Clears saved progress for that video
   - `beforeunload`: Saves progress before tab close

4. **Resume on Load**: When you revisit a video, the script:
   - Retrieves saved progress from Chrome storage
   - Waits for video metadata to load
   - Sets the `currentTime` to resume playback

5. **Storage**: Progress data is stored in Chrome's local storage with this structure:
   ```typescript
   {
     [videoId]: {
       id: string
       progress: number      // Time in seconds
       timestamp: number     // Last save time
       title: string
       url: string
     }
   }
   ```

## Browser Support

- ✅ Chrome 109+
- ✅ Firefox 109+
- ✅ Edge (Chromium-based)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`pnpm type-check && pnpm lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT © [Francisco Verona](https://github.com/franverona)

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/franverona/youtube-tracker/issues) on GitHub.
