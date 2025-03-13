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
 * Render the upload interface
 */
function renderUploadInterface() {
    appContainer.innerHTML = `
        <div class="upload-container">
            <h2>Upload Bestiary Files</h2>
            <p>Upload JSON files containing D&D 5e monster data.</p>
            <p>You can find these files in the 5etools GitHub repository under "/data/bestiary" folder or use our sample files.</p>
            
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
                
                await dataManager.handleFileUpload(fileInput.files);
                
                // Update status and interface
                updateDataStatus(true);
                renderAppInterface();
                
                appState.isLoading = false;
            } catch (error) {
                console.error('Error uploading files:', error);
                uploadStatusMessage.textContent = `Error: ${error.message}`;
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
function renderAppInterface() {
    const data = dataManager.getData();
    
    appContainer.innerHTML = `
        <div class="app-interface">
            <h2>D&D 5e Bestiary Data Loaded</h2>
            <div class="data-summary">
                <p><strong>Version:</strong> ${data.version}</p>
                <p><strong>Last Updated:</strong> ${new Date(data.lastUpdated).toLocaleString()}</p>
                <p><strong>Creatures:</strong> ${data.creatureCount}</p>
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
                        <span class="creature-type">${creature.type}, CR ${creature.cr}</span>
                    </div>
                `)
                .join('');
        } catch (error) {
            console.error('Error searching creatures:', error);
            searchResults.innerHTML = '<div class="no-results">Error searching creatures</div>';
        }
    });
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);