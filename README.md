# YouTube Tracker

[!Popup](./screenshots/popup-screenshot.png)

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

- Node.js ≥24.12.0 (use `.nvmrc`: `nvm use`)

#### Setup

```bash
# Clone the repository
git clone https://github.com/franverona/youtube-tracker.git
cd youtube-tracker

# Use the correct Node version
nvm use

# Install dependencies (also sets up git hooks via husky)
npm install

# Start development mode (Chrome)
npm run dev
```

The extension will be built to the `.output/chrome-mv3/` directory. Load the unpacked extension from there.

## Development

### Available Commands

```bash
# Development (with hot reload)
npm run dev              # Chrome
npm run dev:firefox      # Firefox

# Build for production
npm run build            # Chrome
npm run build:firefox    # Firefox

# Create distributable ZIP files
npm run zip              # Chrome
npm run zip:firefox      # Firefox

# Run tests
npm run test

# Type checking
npm run type-check

# Lint
npm run lint
```

### Project Structure

```
youtube-tracker/
├── src/
│   ├── entrypoints/
│   │   ├── content.ts          # Content script (YouTube tracking logic)
│   │   ├── content/
│   │   │   ├── videoUtils.ts        # Save/load progress helpers
│   │   │   ├── videoUtils.test.ts
│   │   │   ├── youtubeUtils.ts      # DOM helpers (video element, title, ID)
│   │   │   └── youtubeUtils.test.ts
│   │   └── popup/
│   │       ├── index.html
│   │       ├── main.tsx
│   │       ├── App.tsx         # Popup UI
│   │       ├── App.css
│   │       └── useVideoStorage.ts
│   ├── storage/
│   │   ├── videoStorage.ts     # Storage abstraction (wxt/utils/storage)
│   │   └── videoStorage.test.ts
│   └── test/
│       └── setup.ts            # Vitest global setup (suppress console.warn)
├── public/
│   ├── icon-48.png
│   └── icon-128.png
└── wxt.config.ts
```

### Tech Stack

- **Framework**: [WXT](https://wxt.dev) + React 19
- **Language**: TypeScript 5.8
- **Styling**: Tailwind CSS 4
- **Build Tool**: Vite (via WXT)
- **Testing**: Vitest with jsdom environment
- **Linting**: ESLint 9 with typescript-eslint, react-hooks, stylistic, and import plugins
- **Git Hooks**: Husky — lint-staged on pre-commit, commitlint on commit-msg

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
4. Run type checking and linting (`npm run type-check && npm run lint`)
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/) format (enforced automatically): `git commit -m 'feat: add amazing feature'`
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT © [Francisco Verona](https://github.com/franverona)

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/franverona/youtube-tracker/issues) on GitHub.
