// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Video Progress Tracker installed.');
});

// You could add listeners here for messages from the content script if needed.
// For example, if the content script needed to request data from an external API,
// the background script would be the place to do it due to its broader permissions.
