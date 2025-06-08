// popup.js
document.addEventListener('DOMContentLoaded', function () {
  const progressList = document.getElementById('progressList')
  const clearAllButton = document.getElementById('clearAll')

  // Function to format time (e.g., 1:23:45)
  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return [h, m, s]
      .map((v) => (v < 10 ? '0' + v : v))
      .filter((v, i) => v !== '00' || i > 0)
      .join(':')
      .replace(/^0/, '') // Remove leading zero if hours are 0
  }

  // Load and display saved progress
  function loadAndDisplayProgress() {
    chrome.storage.local.get(null, function (items) {
      // Get all items
      if (chrome.runtime.lastError) {
        console.error('Error loading all progress:', chrome.runtime.lastError)
        progressList.innerHTML = '<li>Error loading data.</li>'
        return
      }

      progressList.innerHTML = '' // Clear existing list

      if (Object.keys(items).length === 0) {
        progressList.innerHTML = '<li>No saved videos found.</li>'
        return
      }

      // Sort by video ID (or add a timestamp to sort by last watched)
      const sortedVideoIds = Object.keys(items).sort()

      sortedVideoIds.forEach((videoId) => {
        const { currentTime: progress, title: videoTitle } = items[videoId]
        const listItem = document.createElement('li')
        listItem.classList.add('video-item')

        listItem.innerHTML = `
          <span class="video-title" title="${videoTitle}">${videoTitle}</span>
          <span>${formatTime(progress)}</span>
          <button class="clear-button" data-video-id="${videoId}">X</button>
        `
        progressList.appendChild(listItem)
      })

      // Add event listeners for clear buttons
      document.querySelectorAll('.clear-button').forEach((button) => {
        button.addEventListener('click', function () {
          const videoIdToClear = this.dataset.videoId
          chrome.storage.local.remove(videoIdToClear, function () {
            if (chrome.runtime.lastError) {
              console.error(
                'Error removing single progress:',
                chrome.runtime.lastError
              )
            } else {
              console.log(`Progress for ${videoIdToClear} cleared.`)
              loadAndDisplayProgress() // Refresh the list
            }
          })
        })
      })
    })
  }

  // Clear all saved progress
  clearAllButton.addEventListener('click', function () {
    if (confirm('Are you sure you want to clear all saved video progress?')) {
      chrome.storage.local.clear(function () {
        if (chrome.runtime.lastError) {
          console.error(
            'Error clearing all progress:',
            chrome.runtime.lastError
          )
        } else {
          console.log('All progress cleared.')
          loadAndDisplayProgress() // Refresh the list
        }
      })
    }
  })

  loadAndDisplayProgress() // Initial load
})
