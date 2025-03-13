/**
 * D&D 5e Summons Assistant
 * Main JavaScript Entry Point
 */
import * as dataManager from './dataManager.js';

// DOM Elements
const statusMessage = document.getElementById('status-message');
const loadingIndicator = document.querySelector('.loading-indicator');
const appContainer = document.getElementById('app-container');

// Application State
const appState = {
    isDataLoaded: false,
    isLoading: false
};

/**
 * Initialize the application
 */
async function initApp() {
    console.log('D&D 5e Summons Assistant initializing...');
    
    // Initialize the data manager
    await dataManager.initDataManager();
    
    // Check if data is already in local storage
    checkDataStatus();
    
    // Set up event listeners
    setupEventListeners();
}

/**
 * Check if the required data is already loaded in local storage
 */
function checkDataStatus() {
    try {
        const data = dataManager.getData();
        updateDataStatus(data.isLoaded);
        
        if (data.isLoaded) {
            console.log(`Data found: ${data.creatureCount} creatures (version ${data.version})`);
            // If data is loaded, we can render the app interface
            renderAppInterface();
        } else {
            console.log('No data found, will need to upload bestiary files');
            renderUploadInterface();
        }
    } catch (error) {
        console.error('Error checking data status:', error);
        updateDataStatus(false);
        renderUploadInterface();
    }
}

/**
 * Update the UI to reflect current data status
 * @param {boolean} isLoaded - Whether data is loaded
 */
function updateDataStatus(isLoaded) {
    appState.isDataLoaded = isLoaded;
    const statusContainer = document.getElementById('data-status');
    
    if (isLoaded) {
        statusMessage.textContent = 'Data status: Loaded';
        statusMessage.style.color = 'lightgreen';
        
        // Create refresh button if it doesn't exist
        if (!document.getElementById('refresh-data-btn')) {
            const refreshBtn = document.createElement('button');
            refreshBtn.id = 'refresh-data-btn';
            refreshBtn.className = 'primary-btn';
            refreshBtn.textContent = 'Refresh Data';
            refreshBtn.addEventListener('click', () => {
                if (confirm('This will clear all existing data. Are you sure?')) {
                    dataManager.clearData();
                    updateDataStatus(false);
                    renderUploadInterface();
                    
                    // Remove the refresh button after data is cleared
                    const btnToRemove = document.getElementById('refresh-data-btn');
                    if (btnToRemove) {
                        btnToRemove.remove();
                    }
                }
            });
            statusContainer.appendChild(refreshBtn);
        }
    } else {
        statusMessage.textContent = 'Data status: Not loaded';
        statusMessage.style.color = 'white';
        
        // Remove refresh button if it exists
        const refreshBtn = document.getElementById('refresh-data-btn');
        if (refreshBtn) {
            refreshBtn.remove();
        }
    }
}

/**
 * Set up event listeners for user interactions
 */
function setupEventListeners() {
    // Any global event listeners can be added here
    // (The load data button is now added dynamically)
}

/**
 * Show notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error, info)
 * @param {number} duration - How long to show the notification in ms
 */
function showNotification(message, type = 'info', duration = 5000) {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-message">${message}</div>
        <button class="notification-close">×</button>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Add event listener for close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
            }
        }, duration);
    }
    
    // Show with animation
    setTimeout(() => {
        notification.classList.add('notification-show');
    }, 10);
}

/**
 * Render the upload interface
 */
function renderUploadInterface() {
    appContainer.innerHTML = `
        <div class="upload-container">
            <h2>Upload Bestiary Files</h2>
            <p>Upload JSON files containing D&D 5e monster data.</p>
            <p>You can find these files in the 5etools GitHub repository under "/data/bestiary" folder or use our sample files.</p>
            
            <div class="action-buttons">
                <button id="load-sample-data-btn" class="primary-btn">Load Sample Data</button>
                <div class="or-divider">OR</div>
                <div class="upload-your-files">Upload Your Files:</div>
            </div>
            
            <div class="file-upload-area">
                <label for="bestiary-files" class="upload-label">
                    <div class="upload-icon">📁</div>
                    <span>Drag files here or click to browse</span>
                </label>
                <input type="file" id="bestiary-files" multiple accept=".json" class="file-input" />
            </div>
            
            <div class="upload-status hidden">
                <div class="spinner"></div>
                <p id="upload-status-message">Processing files...</p>
            </div>
            
            <div class="upload-help">
                <h3>Need help?</h3>
                <p>Here's how to get the bestiary files:</p>
                <ol>
                    <li>Visit the <a href="https://github.com/5etools-mirror-3/5etools-2014-src/tree/master/data/bestiary" target="_blank">5etools GitHub repository</a></li>
                    <li>Download the JSON files in the bestiary folder (bestiary-mm.json, bestiary-phb.json, etc.)</li>
                    <li>Upload those files here</li>
                </ol>
                
                <h4>Sample Data Files</h4>
                <p>For development and testing purposes, you can use our sample bestiary files in the <strong>data/bestiary/</strong> folder of this project:</p>
                <ul>
                    <li><strong>bestiary-birds.json</strong>: Contains birds like Eagle, Hawk, Owl</li>
                    <li><strong>bestiary-small-creatures.json</strong>: Contains small creatures like Rat, Bat, Spider</li>
                    <li><strong>bestiary-mammals.json</strong>: Contains mammals like Wolf, Bear, Panther</li>
                    <li><strong>bestiary-reptiles.json</strong>: Contains reptiles like Snake, Crocodile</li>
                </ul>
                <p><em>Note: These sample files were created by Claude specifically for development purposes and contain a subset of creatures. They can be found in the project repository.</em></p>
                
                <h4>Data Storage Information</h4>
                <p>Your uploaded bestiary data is stored in your browser's IndexedDB storage. This data will be lost in the following cases:</p>
                <ul>
                    <li>Clearing your browser's cache or site data</li>
                    <li>Using private/incognito browsing mode</li>
                    <li>Browser updates that affect storage</li>
                    <li>Manually clicking the "Refresh Data" button</li>
                </ul>
                <p>Once data is successfully uploaded, it will persist between sessions until one of these events occurs.</p>
            </div>
        </div>
    `;
    
    // Set up the "Load Sample Data" button
    const loadSampleDataBtn = document.getElementById('load-sample-data-btn');
    loadSampleDataBtn.addEventListener('click', async () => {
        try {
            const uploadStatus = document.querySelector('.upload-status');
            const uploadStatusMessage = document.getElementById('upload-status-message');
            
            uploadStatus.classList.remove('hidden');
            uploadStatusMessage.textContent = 'Loading sample data...';
            appState.isLoading = true;
            
            const result = await dataManager.loadSampleData();
            
            // Update status and interface
            updateDataStatus(true);
            
            // Show success notification
            showNotification(
                `Successfully loaded ${result.creatures} creatures from sample data!`,
                'success'
            );
            
            // Render the app interface with the loaded data
            renderAppInterface();
            
            appState.isLoading = false;
        } catch (error) {
            console.error('Error loading sample data:', error);
            
            const uploadStatus = document.querySelector('.upload-status');
            const uploadStatusMessage = document.getElementById('upload-status-message');
            
            uploadStatus.classList.remove('hidden');
            uploadStatusMessage.textContent = `Error: ${error.message}`;
            
            // Show error notification
            showNotification(
                `Error loading sample data: ${error.message}`,
                'error'
            );
            
            appState.isLoading = false;
        }
    });
    
    // Set up the file upload event handlers
    const fileInput = document.getElementById('bestiary-files');
    const uploadArea = document.querySelector('.file-upload-area');
    const uploadStatus = document.querySelector('.upload-status');
    const uploadStatusMessage = document.getElementById('upload-status-message');
    
    fileInput.addEventListener('change', async (event) => {
        if (fileInput.files.length > 0) {
            try {
                uploadStatus.classList.remove('hidden');
                uploadStatusMessage.textContent = `Processing ${fileInput.files.length} files...`;
                appState.isLoading = true;
                
                const result = await dataManager.handleFileUpload(fileInput.files);
                
                // Update status and interface
                updateDataStatus(true);
                
                // Show success notification with stats
                showNotification(
                    `Successfully loaded ${result.creatures} creatures from ${result.stats.validFiles} files!`,
                    'success'
                );
                
                // Render the app interface with the loaded data
                renderAppInterface();
                
                appState.isLoading = false;
            } catch (error) {
                console.error('Error uploading files:', error);
                uploadStatusMessage.textContent = `Error: ${error.message}`;
                
                // Show error notification
                showNotification(
                    `Error uploading files: ${error.message}`,
                    'error'
                );
                
                appState.isLoading = false;
            }
        }
    });
    
    // Add drag and drop support
    uploadArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', async (event) => {
        event.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        if (event.dataTransfer.files.length > 0) {
            fileInput.files = event.dataTransfer.files;
            // Trigger the change event
            const changeEvent = new Event('change');
            fileInput.dispatchEvent(changeEvent);
        }
    });
}

/**
 * Render the main application interface
 */
async function renderAppInterface() {
    const data = dataManager.getData();
    const stats = await dataManager.getDataStatistics();
    
    appContainer.innerHTML = `
        <div class="app-interface">
            <div class="success-banner">
                <div class="success-icon">✓</div>
                <div class="success-message">Data successfully loaded!</div>
            </div>
            
            <h2>D&D 5e Bestiary Data Loaded</h2>
            
            <div class="data-summary">
                <p><strong>Version:</strong> ${data.version}</p>
                <p><strong>Last Updated:</strong> ${new Date(data.lastUpdated).toLocaleString()}</p>
                <p><strong>Creatures:</strong> ${data.creatureCount}</p>
            </div>
            
            <div class="data-actions">
                <button id="export-data-btn" class="secondary-btn">Export Data</button>
                <button id="import-data-btn" class="secondary-btn">Import Data</button>
                <input type="file" id="import-file" accept=".json" class="hidden" />
            </div>
            
            <div class="data-actions-info">
                <p><strong>Note:</strong> The Export and Import buttons are for backing up and restoring data processed by this application. Use Export to save your current creature database, and Import to restore a previously exported file. To load raw bestiary files from external sources, please use the "Refresh Data" button and then upload the files.</p>
            </div>
            
            <div class="data-stats">
                <h3>Data Statistics</h3>
                <div class="stats-grid">
                    <div class="stats-card">
                        <h4>By Type</h4>
                        <ul>
                            ${Object.entries(stats.typeStats)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 5)
                                .map(([type, count]) => `<li>${type}: <strong>${count}</strong></li>`)
                                .join('')}
                        </ul>
                    </div>
                    <div class="stats-card">
                        <h4>By CR</h4>
                        <ul>
                            ${Object.entries(stats.crStats)
                                .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                                .slice(0, 5)
                                .map(([cr, count]) => `<li>CR ${formatCR(cr)}: <strong>${count}</strong></li>`)
                                .join('')}
                        </ul>
                    </div>
                    <div class="stats-card">
                        <h4>By Size</h4>
                        <ul>
                            ${Object.entries(stats.sizeStats)
                                .sort((a, b) => b[1] - a[1])
                                .map(([size, count]) => `<li>${getSizeName(size)}: <strong>${count}</strong></li>`)
                                .join('')}
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="data-sample">
                <h3>Sample Creature Search</h3>
                <div class="search-container">
                    <input type="text" id="creature-search" placeholder="Search creatures..." class="search-input" />
                    <div id="search-results" class="search-results"></div>
                </div>
            </div>
            
            <p class="next-steps">
                In the next development phases, we'll add creature management, enemy tracking, 
                and the visual combat interface. For now, you can search through the loaded bestiary data.
            </p>
        </div>
    `;
    
    // Make the success banner disappear after a few seconds
    setTimeout(() => {
        const banner = document.querySelector('.success-banner');
        if (banner) {
            banner.classList.add('fade-out');
            setTimeout(() => {
                if (banner) banner.remove();
            }, 1000);
        }
    }, 3000);
    
    // Set up the export button
    const exportBtn = document.getElementById('export-data-btn');
    exportBtn.addEventListener('click', async () => {
        try {
            const result = await dataManager.exportData();
            
            // Create a temporary link and trigger download
            const link = document.createElement('a');
            link.href = result.url;
            link.download = result.filename;
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(result.url);
            }, 100);
            
            showNotification('Data exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            showNotification(`Error exporting data: ${error.message}`, 'error');
        }
    });
    
    // Set up the import button and file input
    const importBtn = document.getElementById('import-data-btn');
    const importFile = document.getElementById('import-file');
    
    importBtn.addEventListener('click', () => {
        importFile.click();
    });
    
    importFile.addEventListener('change', async () => {
        if (importFile.files.length > 0) {
            try {
                // Show loading notification
                showNotification('Importing data...', 'info', 0);
                
                const result = await dataManager.importData(importFile.files[0]);
                
                // Remove the loading notification
                const notification = document.querySelector('.notification');
                if (notification) notification.remove();
                
                showNotification(
                    `Successfully imported ${result.validCreatures} creatures!`,
                    'success'
                );
                
                // Refresh the interface
                updateDataStatus(true);
                renderAppInterface();
            } catch (error) {
                console.error('Error importing data:', error);
                
                // Remove the loading notification
                const notification = document.querySelector('.notification');
                if (notification) notification.remove();
                
                showNotification(`Error importing data: ${error.message}`, 'error');
            }
            
            // Reset the file input
            importFile.value = '';
        }
    });
    
    // Set up the search functionality
    const searchInput = document.getElementById('creature-search');
    const searchResults = document.getElementById('search-results');
    
    searchInput.addEventListener('input', async () => {
        const searchTerm = searchInput.value.trim();
        
        if (searchTerm.length < 2) {
            searchResults.innerHTML = '';
            return;
        }
        
        try {
            const results = await dataManager.searchCreatures(searchTerm);
            
            if (results.length === 0) {
                searchResults.innerHTML = '<div class="no-results">No creatures found</div>';
                return;
            }
            
            searchResults.innerHTML = results
                .slice(0, 10) // Limit to 10 results
                .map(creature => `
                    <div class="search-result-item">
                        <span class="creature-name">${creature.name}</span>
                        <span class="creature-type">${creature.type}, CR ${formatCR(creature.cr)}</span>
                    </div>
                `)
                .join('');
        } catch (error) {
            console.error('Error searching creatures:', error);
            searchResults.innerHTML = '<div class="no-results">Error searching creatures</div>';
        }
    });
}

/**
 * Format a challenge rating value
 * @param {string|number} cr - The challenge rating to format
 * @returns {string} The formatted CR value
 */
function formatCR(cr) {
    const crNum = parseFloat(cr);
    
    if (crNum === 0.125) return "1/8";
    if (crNum === 0.25) return "1/4";
    if (crNum === 0.5) return "1/2";
    
    return cr.toString();
}

/**
 * Get the full name for a D&D size code
 * @param {string} size - The size code (T, S, M, L, H, G)
 * @returns {string} The full size name
 */
function getSizeName(size) {
    const sizeMap = {
        'T': 'Tiny',
        'S': 'Small',
        'M': 'Medium',
        'L': 'Large',
        'H': 'Huge',
        'G': 'Gargantuan'
    };
    
    return sizeMap[size] || size;
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);