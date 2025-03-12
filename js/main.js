/**
 * D&D 5e Summons Assistant
 * Main JavaScript Entry Point
 */

// DOM Elements
const loadDataBtn = document.getElementById('load-data-btn');
const statusMessage = document.getElementById('status-message');
const loadingIndicator = document.querySelector('.loading-indicator');

// Application State
const appState = {
    isDataLoaded: false,
    isLoading: false
};

/**
 * Initialize the application
 */
function initApp() {
    console.log('D&D 5e Summons Assistant initializing...');
    
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
        // We'll implement this fully when we create the dataManager module
        // For now, just check if there's any data key in localStorage
        const hasData = localStorage.getItem('dnd5e_summons_data_version');
        
        if (hasData) {
            updateDataStatus(true);
            console.log('Data found in local storage');
        } else {
            updateDataStatus(false);
            console.log('No data found, will need to load from source');
        }
    } catch (error) {
        console.error('Error checking data status:', error);
        updateDataStatus(false);
    }
}

/**
 * Update the UI to reflect current data status
 * @param {boolean} isLoaded - Whether data is loaded
 */
function updateDataStatus(isLoaded) {
    appState.isDataLoaded = isLoaded;
    
    if (isLoaded) {
        statusMessage.textContent = 'Data status: Loaded';
        statusMessage.style.color = 'lightgreen';
        loadDataBtn.textContent = 'Refresh Data';
    } else {
        statusMessage.textContent = 'Data status: Not loaded';
        statusMessage.style.color = 'white';
        loadDataBtn.textContent = 'Load Data';
    }
}

/**
 * Set up event listeners for user interactions
 */
function setupEventListeners() {
    // Load data button
    loadDataBtn.addEventListener('click', handleDataLoadRequest);
}

/**
 * Handle the request to load data
 */
function handleDataLoadRequest() {
    if (appState.isLoading) return;
    
    appState.isLoading = true;
    loadDataBtn.disabled = true;
    loadingIndicator.classList.remove('hidden');
    
    // Simulate loading data (this will be replaced with actual data loading in Module 2)
    console.log('Loading data simulation started...');
    
    setTimeout(() => {
        console.log('Data loading simulation completed');
        // For demonstration purposes only - we'll implement real data loading in Module 2
        localStorage.setItem('dnd5e_summons_data_version', '0.1.0');
        
        appState.isLoading = false;
        loadDataBtn.disabled = false;
        loadingIndicator.classList.add('hidden');
        updateDataStatus(true);
    }, 2000);
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);