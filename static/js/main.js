// Theme Initialization (Avoid FOUC)
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Application State
let appState = {
    notes: [], // Complete parsed timeline data
    selectedUpdates: new Map(), // Map of selected update ID -> update details
    activeFilter: 'all', // Current active filter chip
    searchQuery: '', // Current search text
    lastUpdatedTime: null // Date object of last success fetch
};

// DOM Elements
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    spinner: document.getElementById('spinner'),
    syncText: document.getElementById('sync-text'),
    syncDot: document.querySelector('.status-dot'),
    
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statIssues: document.getElementById('stat-issues'),
    statDeprecations: document.getElementById('stat-deprecations'),
    
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    filterChips: document.querySelectorAll('.filter-chip'),
    
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    emptyState: document.getElementById('empty-state'),
    notesTimeline: document.getElementById('notes-timeline'),
    
    floatingBar: document.getElementById('floating-bar'),
    selectionCount: document.getElementById('selection-count'),
    clearSelectionBtn: document.getElementById('clear-selection-btn'),
    tweetSelectionBtn: document.getElementById('tweet-selection-btn')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchNotes();
    setupEventListeners();
    updateThemeIcons();
    
    // Periodically update the relative last-updated timestamp
    setInterval(updateSyncTimeDisplay, 60000);
});

// Event Listeners Setup
function setupEventListeners() {
    // Refresh & Retry Buttons
    elements.refreshBtn.addEventListener('click', () => fetchNotes(true));
    elements.retryBtn.addEventListener('click', () => fetchNotes(true));
    
    // Export CSV Button
    if (elements.exportCsvBtn) {
        elements.exportCsvBtn.addEventListener('click', exportToCsv);
    }
    
    // Theme Toggle Button
    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        toggleClearSearchButton();
        renderTimeline();
    });
    
    elements.searchClearBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        appState.searchQuery = '';
        toggleClearSearchButton();
        renderTimeline();
        elements.searchInput.focus();
    });
    
    // Filter Chips
    elements.filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            appState.activeFilter = chip.dataset.filter;
            renderTimeline();
        });
    });
    
    // Floating Tweet Bar Actions
    elements.clearSelectionBtn.addEventListener('click', clearAllSelections);
    elements.tweetSelectionBtn.addEventListener('click', tweetSelectedUpdates);
}

// Fetch Notes from Flask API
async function fetchNotes(forceRefresh = false) {
    showLoading();
    
    try {
        const url = `/api/notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            appState.notes = data.entries;
            appState.lastUpdatedTime = new Date(data.last_updated * 1000);
            
            calculateStats();
            renderTimeline();
            updateSyncTimeDisplay();
            
            elements.notesTimeline.style.display = 'flex';
            elements.loadingState.style.display = 'none';
            elements.errorState.style.display = 'none';
        } else {
            throw new Error(data.message || 'Unknown server error');
        }
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// Show/Hide Loading UI States
function showLoading() {
    elements.refreshBtn.disabled = true;
    elements.refreshIcon.classList.add('icon-hidden');
    elements.spinner.classList.remove('icon-hidden');
    elements.syncDot.classList.add('syncing');
    elements.syncText.textContent = "Syncing notes...";
}

function hideLoading() {
    elements.refreshBtn.disabled = false;
    elements.refreshIcon.classList.remove('icon-hidden');
    elements.spinner.classList.add('icon-hidden');
    elements.syncDot.classList.remove('syncing');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.loadingState.style.display = 'none';
    elements.notesTimeline.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'flex';
    elements.syncText.textContent = "Sync failed";
}

// Compute Statistics
function calculateStats() {
    let total = 0;
    let features = 0;
    let issues = 0;
    let deprecations = 0;
    
    appState.notes.forEach(entry => {
        entry.updates.forEach(update => {
            total++;
            const type = update.type.toLowerCase();
            if (type.includes('feature')) features++;
            else if (type.includes('issue')) issues++;
            else if (type.includes('deprecation')) deprecations++;
        });
    });
    
    elements.statTotal.textContent = total;
    elements.statFeatures.textContent = features;
    elements.statIssues.textContent = issues;
    elements.statDeprecations.textContent = deprecations;
}

// Update Sync Time Text
function updateSyncTimeDisplay() {
    if (!appState.lastUpdatedTime) return;
    
    const now = new Date();
    const diffMs = now - appState.lastUpdatedTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
        elements.syncText.textContent = "Synced just now";
    } else if (diffMins === 1) {
        elements.syncText.textContent = "Synced 1 minute ago";
    } else {
        elements.syncText.textContent = `Synced ${diffMins} minutes ago`;
    }
}

// Search UI Clear Toggle
function toggleClearSearchButton() {
    if (appState.searchQuery.length > 0) {
        elements.searchClearBtn.style.display = 'block';
    } else {
        elements.searchClearBtn.style.display = 'none';
    }
}

// Filter and Search updates
function getFilteredNotes() {
    const filteredEntries = [];
    
    appState.notes.forEach(entry => {
        const matchingUpdates = entry.updates.filter(update => {
            // Filter by Category
            const typeMatch = appState.activeFilter === 'all' || 
                              update.type.toLowerCase().includes(appState.activeFilter);
                              
            // Filter by Search Query
            const textMatch = !appState.searchQuery || 
                              update.text.toLowerCase().includes(appState.searchQuery) ||
                              update.type.toLowerCase().includes(appState.searchQuery) ||
                              update.date.toLowerCase().includes(appState.searchQuery);
                              
            return typeMatch && textMatch;
        });
        
        if (matchingUpdates.length > 0) {
            filteredEntries.push({
                ...entry,
                updates: matchingUpdates
            });
        }
    });
    
    return filteredEntries;
}

// Render Timeline to DOM
function renderTimeline() {
    const filteredData = getFilteredNotes();
    elements.notesTimeline.innerHTML = '';
    
    if (filteredData.length === 0) {
        elements.notesTimeline.style.display = 'none';
        elements.emptyState.style.display = 'flex';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    elements.notesTimeline.style.display = 'flex';
    
    filteredData.forEach(entry => {
        const groupEl = document.createElement('div');
        groupEl.className = 'timeline-group';
        
        // Date indicator column
        const dateContainer = document.createElement('div');
        dateContainer.className = 'timeline-date-container';
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'timeline-date';
        dateSpan.textContent = entry.date;
        
        dateContainer.appendChild(dateSpan);
        groupEl.appendChild(dateContainer);
        
        // Cards column
        const cardsWrapper = document.createElement('div');
        cardsWrapper.className = 'timeline-cards';
        
        entry.updates.forEach(update => {
            const cardEl = document.createElement('div');
            cardEl.className = 'update-card';
            cardEl.setAttribute('data-type', update.type.toLowerCase());
            cardEl.setAttribute('data-id', update.id);
            
            // Check if card is selected
            if (appState.selectedUpdates.has(update.id)) {
                cardEl.classList.add('selected');
            }
            
            // Card Content HTML construction
            cardEl.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <div class="card-selector">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <span class="category-badge">${update.type}</span>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon-copy" title="Copy text to clipboard" data-id="${update.id}">
                            <svg class="icon-copy" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <svg class="icon-check icon-hidden" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </button>
                        <button class="btn-icon-tweet" title="Tweet about this update" data-id="${update.id}">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    ${update.html}
                </div>
            `;
            
            // Card Click Handling (Toggle selection)
            cardEl.addEventListener('click', (e) => {
                // Ignore click if it's the Tweet button, Copy button, or a link inside content
                if (e.target.closest('.btn-icon-tweet') || e.target.closest('.btn-icon-copy') || e.target.closest('a')) {
                    return;
                }
                toggleSelection(update, cardEl);
            });
            
            // Copy Button Click Handling
            const copyBtn = cardEl.querySelector('.btn-icon-copy');
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(update, copyBtn);
            });
            
            // Tweet Button Click Handling
            const tweetBtn = cardEl.querySelector('.btn-icon-tweet');
            tweetBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop card click triggering
                tweetSingleUpdate(update);
            });
            
            cardsWrapper.appendChild(cardEl);
        });
        
        groupEl.appendChild(cardsWrapper);
        elements.notesTimeline.appendChild(groupEl);
    });
}

// Toggle selection state
function toggleSelection(update, cardElement) {
    if (appState.selectedUpdates.has(update.id)) {
        appState.selectedUpdates.delete(update.id);
        cardElement.classList.remove('selected');
    } else {
        appState.selectedUpdates.set(update.id, update);
        cardElement.classList.add('selected');
    }
    
    updateFloatingBar();
}

// Clear all selected updates
function clearAllSelections() {
    appState.selectedUpdates.clear();
    
    // Visual update
    const selectedCards = document.querySelectorAll('.update-card.selected');
    selectedCards.forEach(card => card.classList.remove('selected'));
    
    updateFloatingBar();
}

// Update the bottom floating bar visibility and count
function updateFloatingBar() {
    const count = appState.selectedUpdates.size;
    elements.selectionCount.textContent = count;
    
    if (count > 0) {
        elements.floatingBar.classList.add('visible');
    } else {
        elements.floatingBar.classList.remove('visible');
    }
}

// Helper: Truncate text to fit within limits
function truncateText(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
}

// Tweet composed for a single update
function tweetSingleUpdate(update) {
    // Twitter link count is fixed at 23 chars. Hashtags & spacing take some space too.
    // X allows 280 characters.
    // Format: "BigQuery Update [Feature] (June 15): Description text... https://docs.cloud.google.com/... #BigQuery #GoogleCloud"
    const prefix = `BigQuery [${update.type}] (${update.date}): `;
    const suffix = `\n\n#BigQuery #GoogleCloud`;
    
    // Let's compute maximum allowed characters for the description
    // X counts any URL as 23 characters.
    const urlLen = 23;
    const reservedLen = prefix.length + suffix.length + urlLen + 2; // +2 for newlines/spaces
    const maxDescLen = 280 - reservedLen;
    
    const descText = truncateText(update.text, maxDescLen);
    const tweetText = `${prefix}"${descText}"\n\n${update.link}${suffix}`;
    
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank', 'width=600,height=400');
}

// Tweet composed for multiple selected updates
function tweetSelectedUpdates() {
    const selectedList = Array.from(appState.selectedUpdates.values());
    if (selectedList.length === 0) return;
    
    if (selectedList.length === 1) {
        tweetSingleUpdate(selectedList[0]);
        return;
    }
    
    // Sort selected updates by raw date (newest first) or date string
    // Standard format for multiple updates
    // "BigQuery Release Updates:
    // • [Feature] Gemini Cloud Assist SQL optimization (June 15)
    // • [Issue] Token quotas disabled (June 15)
    // • [Feature] Resize columns in BigQuery Studio (June 15)
    // Details: link #BigQuery"
    
    const header = `Google BigQuery Updates:\n`;
    // We link to the latest update's URL, or just the base release notes URL
    const latestLink = selectedList[0].link.split('#')[0];
    const footer = `\nMore: ${latestLink}\n#BigQuery #GoogleCloud`;
    
    const urlLen = 23;
    const reservedLen = header.length + footer.length + urlLen;
    let maxItemsLen = 280 - reservedLen;
    
    let itemsText = '';
    selectedList.forEach(update => {
        // Summarize item text
        const itemPrefix = `• [${update.type}] `;
        const itemSuffix = ` (${update.date})\n`;
        const itemMaxLen = maxItemsLen - (itemPrefix.length + itemSuffix.length) - 5;
        
        if (itemMaxLen > 15) { // Only add if we have enough space
            const itemDesc = truncateText(update.text, itemMaxLen);
            const line = `${itemPrefix}${itemDesc}${itemSuffix}`;
            itemsText += line;
            maxItemsLen -= line.length;
        }
    });
    
    // If we couldn't fit everything
    if (itemsText.length === 0) {
        itemsText = `• Combined ${selectedList.length} updates\n`;
    }
    
    const tweetText = `${header}${itemsText}${footer}`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank', 'width=600,height=400');
}

// Copy plain text content of an update to clipboard
async function copyToClipboard(update, buttonEl) {
    const copyIcon = buttonEl.querySelector('.icon-copy');
    const checkIcon = buttonEl.querySelector('.icon-check');
    
    try {
        await navigator.clipboard.writeText(update.text);
        
        // Show checkmark icon
        copyIcon.classList.add('icon-hidden');
        checkIcon.classList.remove('icon-hidden');
        
        // Reset after 1.5 seconds
        setTimeout(() => {
            copyIcon.classList.remove('icon-hidden');
            checkIcon.classList.add('icon-hidden');
        }, 1500);
    } catch (err) {
        console.error('Failed to copy text: ', err);
        alert('Could not copy text to clipboard. Please select and copy manually.');
    }
}

// Export the currently filtered list of release notes to CSV
function exportToCsv() {
    const filteredNotes = getFilteredNotes();
    if (filteredNotes.length === 0) {
        alert('No data available to export.');
        return;
    }
    
    // Flat list of all updates
    const csvRows = [];
    
    // CSV Headers
    csvRows.push(['Date', 'Type', 'Description', 'Link'].map(escapeCsvCell).join(','));
    
    filteredNotes.forEach(entry => {
        entry.updates.forEach(update => {
            const row = [
                update.date,
                update.type,
                update.text,
                update.link
            ];
            csvRows.push(row.map(escapeCsvCell).join(','));
        });
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bigquery_release_notes_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Helper: Escape cells for CSV formatting
function escapeCsvCell(cell) {
    if (cell === null || cell === undefined) {
        return '';
    }
    let cellStr = String(cell);
    // Escape double quotes by doubling them
    cellStr = cellStr.replace(/"/g, '""');
    // If the cell contains commas, newlines, or quotes, wrap it in double quotes
    if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('\r') || cellStr.includes('"')) {
        cellStr = `"${cellStr}"`;
    }
    return cellStr;
}

// Toggle color scheme theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    updateThemeIcons();
}

// Update the visible toggle icon based on the current theme
function updateThemeIcons() {
    if (!elements.themeToggleBtn) return;
    
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const sunIcon = elements.themeToggleBtn.querySelector('.icon-sun');
    const moonIcon = elements.themeToggleBtn.querySelector('.icon-moon');
    
    if (currentTheme === 'light') {
        sunIcon.classList.add('icon-hidden');
        moonIcon.classList.remove('icon-hidden');
    } else {
        sunIcon.classList.remove('icon-hidden');
        moonIcon.classList.add('icon-hidden');
    }
}
