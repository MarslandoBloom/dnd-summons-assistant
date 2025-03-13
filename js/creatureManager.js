/**
 * D&D 5e Summons Assistant
 * Creature Manager Module
 * Responsible for creature searching, filtering, and displaying creature details
 */

import * as dataManager from './dataManager.js';

// In-memory cache for filter options and search results
const filterCache = {
    types: [],
    crs: [],
    sizes: [],
    environments: [] // Added environment array for filtering
};

// Filter state
const filterState = {
    type: [], // Changed to array for multiple selections
    minCR: 0,
    maxCR: 30,
    minSize: 'T',
    maxSize: 'G',
    environment: [], // Added environment filter
    favorites: false
};

// Favorites management
let favorites = [];

/**
 * Initialize the creature manager
 * @returns {Promise} Resolves when initialization is complete
 */
export async function initCreatureManager() {
    console.log('Initializing creature manager...');
    
    try {
        // Load filters
        await loadFilterOptions();
        
        // Load favorites from localStorage
        loadFavorites();
        
        return true;
    } catch (error) {
        console.error('Error initializing creature manager:', error);
        return false;
    }
}

/**
 * Load filter options from the database
 * @returns {Promise} Resolves when loading is complete
 */
async function loadFilterOptions() {
    try {
        const stats = await dataManager.getDataStatistics();
        
        // Set up type filter options
        filterCache.types = Object.keys(stats.typeStats)
            .sort((a, b) => stats.typeStats[b] - stats.typeStats[a]);
        
        // Set up CR filter options
        filterCache.crs = Object.keys(stats.crStats)
            .map(cr => parseFloat(cr))
            .sort((a, b) => a - b); // Keep ascending order for internal data
        
        // Set up size filter options
        filterCache.sizes = Object.keys(stats.sizeStats)
            .sort((a, b) => getSizeOrder(a) - getSizeOrder(b));
        
        // Set up environment filter options (extract from creatures)
        filterCache.environments = await loadEnvironmentOptions();
        
        // Initialize filter state with all types selected
        filterState.type = [...filterCache.types];
        filterState.environment = [...filterCache.environments];
        
        // Set min/max CR based on available options
        if (filterCache.crs.length > 0) {
            filterState.minCR = Math.min(...filterCache.crs);
            filterState.maxCR = Math.max(...filterCache.crs);
        }
        
        console.log('Loaded filter options:', filterCache);
        return true;
    } catch (error) {
        console.error('Error loading filter options:', error);
        return false;
    }
}

/**
 * Load available environment options from creatures
 * @returns {Promise<Array>} Resolves with array of unique environments
 */
async function loadEnvironmentOptions() {
    try {
        const creatures = await dataManager.getAllCreatures();
        const environments = new Set();
        
        creatures.forEach(creature => {
            // Check for environments in different possible locations
            if (creature.environment && Array.isArray(creature.environment)) {
                creature.environment.forEach(env => environments.add(env));
            } else if (creature.environments && Array.isArray(creature.environments)) {
                creature.environments.forEach(env => environments.add(env));
            } else if (creature.environment && typeof creature.environment === 'string') {
                environments.add(creature.environment);
            }
        });
        
        return Array.from(environments).sort();
    } catch (error) {
        console.error('Error loading environment options:', error);
        return [];
    }
}

/**
 * Create and render the creature manager UI
 * @param {HTMLElement} container - The container element to render the UI into
 */
export function renderCreatureManager(container) {
    console.log('Rendering creature manager UI');
    
    // Create the creature management interface
    const creatureManagerHTML = `
        <div class="creature-manager">
            <div class="creature-manager-header">
                <h2>Creature Manager</h2>
                <p class="creature-manager-description">Search, filter, and view details of creatures that can be summoned.</p>
            </div>
            
            <div class="filter-search-container">
                <div class="search-box">
                    <input type="text" id="creature-search-input" class="search-input" placeholder="Search creature name...">
                    <button id="search-btn" class="primary-btn">Search</button>
                </div>
                
                <div class="filter-controls">
                    <div class="filter-group">
                        <button id="type-filter-btn" class="filter-button">
                            Type <span class="filter-indicator"></span>
                        </button>
                        <div id="type-filter-dropdown" class="filter-dropdown hidden">
                            <div class="dropdown-header">
                                <h4>Select Types</h4>
                                <div class="dropdown-actions">
                                    <button id="select-all-types" class="action-btn">Select All</button>
                                    <button id="clear-all-types" class="action-btn">Clear All</button>
                                </div>
                            </div>
                            <div class="type-options-container">
                                ${filterCache.types.map(type => `
                                    <div class="type-option">
                                        <input type="checkbox" id="type-${type}" class="type-checkbox" value="${type}" checked>
                                        <label for="type-${type}">${capitalizeFirstLetter(type)}</label>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="dropdown-footer">
                                <button id="apply-type-filter" class="primary-btn">Apply</button>
                                <button id="cancel-type-filter" class="secondary-btn">Cancel</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-group">
                        <button id="environment-filter-btn" class="filter-button">
                            Environment <span class="env-filter-indicator"></span>
                        </button>
                        <div id="environment-filter-dropdown" class="filter-dropdown hidden">
                            <div class="dropdown-header">
                                <h4>Select Environments</h4>
                                <div class="dropdown-actions">
                                    <button id="select-all-environments" class="action-btn">Select All</button>
                                    <button id="clear-all-environments" class="action-btn">Clear All</button>
                                </div>
                            </div>
                            <div class="environment-options-container">
                                ${filterCache.environments.map(env => `
                                    <div class="environment-option">
                                        <input type="checkbox" id="env-${env.replace(/\s+/g, '-').toLowerCase()}" class="environment-checkbox" value="${env}" checked>
                                        <label for="env-${env.replace(/\s+/g, '-').toLowerCase()}">${env}</label>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="dropdown-footer">
                                <button id="apply-environment-filter" class="primary-btn">Apply</button>
                                <button id="cancel-environment-filter" class="secondary-btn">Cancel</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-group">
                        <label for="min-cr-filter">CR:</label>
                        <select id="min-cr-filter" class="filter-select">
                            <option value="all">Min CR</option>
                            ${filterCache.crs.map(cr => `<option value="${cr}">${formatCR(cr)}</option>`).join('')}
                        </select>
                        <span>to</span>
                        <select id="max-cr-filter" class="filter-select">
                            <option value="all">Max CR</option>
                            ${[...filterCache.crs].map(cr => `<option value="${cr}">${formatCR(cr)}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="min-size-filter">Size:</label>
                        <select id="min-size-filter" class="filter-select">
                            <option value="all">Min Size</option>
                            ${filterCache.sizes.map(size => `<option value="${size}">${getSizeName(size)}</option>`).join('')}
                        </select>
                        <span>to</span>
                        <select id="max-size-filter" class="filter-select">
                            <option value="all">Max Size</option>
                            ${[...filterCache.sizes].reverse().map(size => `<option value="${size}">${getSizeName(size)}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="filter-group favorites-filter">
                        <input type="checkbox" id="favorites-only" class="favorites-checkbox">
                        <label for="favorites-only">Favorites Only</label>
                    </div>
                </div>
            </div>
            
            <div class="creature-manager-content">
                <div class="creature-list-container">
                    <div class="list-header">
                        <span id="results-count">0 creatures found</span>
                        <button id="clear-filters-btn" class="secondary-btn">Clear Filters</button>
                    </div>
                    
                    <div id="creature-list" class="creature-list">
                        <!-- Creature list will be rendered here -->
                    </div>
                    
                    <div id="favorites-section" class="favorites-section">
                        <div class="favorites-header">
                            <h3>Favorites</h3>
                            <button id="clear-favorites-btn" class="secondary-btn">Clear All</button>
                        </div>
                        <div id="favorites-list" class="favorites-list">
                            <!-- Favorites will be rendered here -->
                        </div>
                    </div>
                </div>
                
                <div id="creature-detail" class="creature-detail">
                    <div class="creature-detail-placeholder">
                        <p>Select a creature to view details</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Render the UI
    container.innerHTML = creatureManagerHTML;
    
    // Set up event listeners
    setupEventListeners();
    
    // Initial search to populate results
    searchCreatures();
    
    // Render favorites
    renderFavorites();
    
    // Update filter indicators
    updateTypeFilterIndicator();
    updateEnvironmentFilterIndicator();
}

/**
 * Update the type filter indicator with count of selected types
 */
function updateTypeFilterIndicator() {
    const indicator = document.querySelector('.filter-indicator');
    if (indicator) {
        const selectedCount = filterState.type.length;
        const totalCount = filterCache.types.length;
        
        if (selectedCount === totalCount) {
            indicator.textContent = '';
        } else {
            indicator.textContent = `(${selectedCount})`;
        }
    }
}

/**
 * Update the environment filter indicator with count of selected environments
 */
function updateEnvironmentFilterIndicator() {
    const indicator = document.querySelector('.env-filter-indicator');
    if (indicator) {
        const selectedCount = filterState.environment.length;
        const totalCount = filterCache.environments.length;
        
        if (selectedCount === totalCount) {
            indicator.textContent = '';
        } else {
            indicator.textContent = `(${selectedCount})`;
        }
    }
}

/**
 * Set up event listeners for user interactions
 */
function setupEventListeners() {
    // Search button click
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchCreatures();
        });
    }
    
    // Search input enter key
    const searchInput = document.getElementById('creature-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                searchCreatures();
            }
        });
    }
    
    // Type filter dropdown
    const typeFilterBtn = document.getElementById('type-filter-btn');
    const typeFilterDropdown = document.getElementById('type-filter-dropdown');
    if (typeFilterBtn && typeFilterDropdown) {
        typeFilterBtn.addEventListener('click', () => {
            typeFilterDropdown.classList.toggle('hidden');
            
            // Update checkboxes to match current filter state
            filterState.type.forEach(type => {
                const checkbox = document.getElementById(`type-${type}`);
                if (checkbox) checkbox.checked = true;
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (!typeFilterBtn.contains(event.target) && 
                !typeFilterDropdown.contains(event.target)) {
                typeFilterDropdown.classList.add('hidden');
            }
        });
        
        // Select all types
        const selectAllBtn = document.getElementById('select-all-types');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('.type-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                });
            });
        }
        
        // Clear all types
        const clearAllBtn = document.getElementById('clear-all-types');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('.type-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
            });
        }
        
        // Apply type filter
        const applyBtn = document.getElementById('apply-type-filter');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('.type-checkbox:checked');
                filterState.type = Array.from(checkboxes).map(cb => cb.value);
                updateTypeFilterIndicator();
                typeFilterDropdown.classList.add('hidden');
                searchCreatures();
            });
        }
        
        // Cancel type filter
        const cancelBtn = document.getElementById('cancel-type-filter');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                typeFilterDropdown.classList.add('hidden');
            });
        }
    }
    
    // Environment filter dropdown
    const environmentFilterBtn = document.getElementById('environment-filter-btn');
    const environmentFilterDropdown = document.getElementById('environment-filter-dropdown');
    if (environmentFilterBtn && environmentFilterDropdown) {
        environmentFilterBtn.addEventListener('click', () => {
            environmentFilterDropdown.classList.toggle('hidden');
            
            // Update checkboxes to match current filter state
            filterState.environment.forEach(env => {
                const checkbox = document.getElementById(`env-${env.replace(/\s+/g, '-').toLowerCase()}`);
                if (checkbox) checkbox.checked = true;
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (!environmentFilterBtn.contains(event.target) && 
                !environmentFilterDropdown.contains(event.target)) {
                environmentFilterDropdown.classList.add('hidden');
            }
        });
        
        // Select all environments
        const selectAllBtn = document.getElementById('select-all-environments');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('.environment-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                });
            });
        }
        
        // Clear all environments
        const clearAllBtn = document.getElementById('clear-all-environments');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('.environment-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
            });
        }
        
        // Apply environment filter
        const applyBtn = document.getElementById('apply-environment-filter');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('.environment-checkbox:checked');
                filterState.environment = Array.from(checkboxes).map(cb => cb.value);
                updateEnvironmentFilterIndicator();
                environmentFilterDropdown.classList.add('hidden');
                searchCreatures();
            });
        }
        
        // Cancel environment filter
        const cancelBtn = document.getElementById('cancel-environment-filter');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                environmentFilterDropdown.classList.add('hidden');
            });
        }
    }
    
    // CR filter change events
    const minCRFilter = document.getElementById('min-cr-filter');
    const maxCRFilter = document.getElementById('max-cr-filter');
    
    if (minCRFilter) {
        minCRFilter.addEventListener('change', () => {
            filterState.minCR = minCRFilter.value === 'all' ? 0 : parseFloat(minCRFilter.value);
            searchCreatures();
        });
    }
    
    if (maxCRFilter) {
        maxCRFilter.addEventListener('change', () => {
            filterState.maxCR = maxCRFilter.value === 'all' ? 30 : parseFloat(maxCRFilter.value);
            searchCreatures();
        });
    }
    
    // Size filter change events
    const minSizeFilter = document.getElementById('min-size-filter');
    const maxSizeFilter = document.getElementById('max-size-filter');
    
    if (minSizeFilter) {
        minSizeFilter.addEventListener('change', () => {
            filterState.minSize = minSizeFilter.value === 'all' ? 'T' : minSizeFilter.value;
            searchCreatures();
        });
    }
    
    if (maxSizeFilter) {
        maxSizeFilter.addEventListener('change', () => {
            filterState.maxSize = maxSizeFilter.value === 'all' ? 'G' : maxSizeFilter.value;
            searchCreatures();
        });
    }
    
    // Favorites filter
    const favoritesFilter = document.getElementById('favorites-only');
    if (favoritesFilter) {
        favoritesFilter.addEventListener('change', () => {
            filterState.favorites = favoritesFilter.checked;
            searchCreatures();
        });
    }
    
    // Clear filters button
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            resetFilters();
        });
    }
    
    // Clear all favorites button
    const clearFavoritesBtn = document.getElementById('clear-favorites-btn');
    if (clearFavoritesBtn) {
        clearFavoritesBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all favorites?')) {
                favorites = [];
                saveFavorites();
                renderFavorites();
                searchCreatures(); // Refresh the results if favorites filter is active
            }
        });
    }
}

/**
 * Reset all filters to their default values
 */
function resetFilters() {
    // Reset filter state
    filterState.type = [...filterCache.types];
    filterState.environment = [...filterCache.environments];
    filterState.minCR = filterCache.crs.length > 0 ? Math.min(...filterCache.crs) : 0;
    filterState.maxCR = filterCache.crs.length > 0 ? Math.max(...filterCache.crs) : 30;
    filterState.minSize = 'T';
    filterState.maxSize = 'G';
    filterState.favorites = false;
    
    // Reset UI elements
    const minCRFilter = document.getElementById('min-cr-filter');
    const maxCRFilter = document.getElementById('max-cr-filter');
    const minSizeFilter = document.getElementById('min-size-filter');
    const maxSizeFilter = document.getElementById('max-size-filter');
    const favoritesFilter = document.getElementById('favorites-only');
    const searchInput = document.getElementById('creature-search-input');
    
    if (minCRFilter) minCRFilter.value = 'all';
    if (maxCRFilter) maxCRFilter.value = 'all';
    if (minSizeFilter) minSizeFilter.value = 'all';
    if (maxSizeFilter) maxSizeFilter.value = 'all';
    if (favoritesFilter) favoritesFilter.checked = false;
    if (searchInput) searchInput.value = '';
    
    // Reset type checkboxes
    const typeCheckboxes = document.querySelectorAll('.type-checkbox');
    typeCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Reset environment checkboxes
    const environmentCheckboxes = document.querySelectorAll('.environment-checkbox');
    environmentCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Update filter indicators
    updateTypeFilterIndicator();
    updateEnvironmentFilterIndicator();
    
    // Refresh results
    searchCreatures();
}

/**
 * Search creatures based on the current filters and search term
 */
async function searchCreatures() {
    try {
        // Get the search term
        const searchInput = document.getElementById('creature-search-input');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        
        // Get all creatures
        let creatures = await dataManager.getAllCreatures();
        
        // Apply search term filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            creatures = creatures.filter(creature => 
                creature.name.toLowerCase().includes(term)
            );
        }
        
        // Apply type filter
        if (filterState.type.length > 0 && filterState.type.length < filterCache.types.length) {
            creatures = creatures.filter(creature => 
                filterState.type.includes(creature.type)
            );
        }
        
        // Apply environment filter
        if (filterState.environment.length > 0 && filterState.environment.length < filterCache.environments.length) {
            creatures = creatures.filter(creature => {
                // Check for environment match in any of the possible formats
                if (creature.environment && Array.isArray(creature.environment)) {
                    return creature.environment.some(env => filterState.environment.includes(env));
                } 
                if (creature.environments && Array.isArray(creature.environments)) {
                    return creature.environments.some(env => filterState.environment.includes(env));
                }
                if (creature.environment && typeof creature.environment === 'string') {
                    return filterState.environment.includes(creature.environment);
                }
                // If no environment data, still show if "any" is selected
                return filterState.environment.includes('Any');
            });
        }
        
        // Apply CR range filter
        if (filterState.minCR !== 'all' || filterState.maxCR !== 'all') {
            creatures = creatures.filter(creature => {
                const cr = creature.cr;
                return cr >= filterState.minCR && cr <= filterState.maxCR;
            });
        }
        
        // Apply size range filter
        if (filterState.minSize !== 'all' || filterState.maxSize !== 'all') {
            creatures = creatures.filter(creature => {
                const sizeOrder = getSizeOrder(creature.size);
                const minSizeOrder = getSizeOrder(filterState.minSize);
                const maxSizeOrder = getSizeOrder(filterState.maxSize);
                return sizeOrder >= minSizeOrder && sizeOrder <= maxSizeOrder;
            });
        }
        
        // Apply favorites filter
        if (filterState.favorites) {
            creatures = creatures.filter(creature => 
                favorites.some(fav => fav.creatureId === creature.id)
            );
        }
        
        // Update results count
        const resultsCount = document.getElementById('results-count');
        if (resultsCount) {
            resultsCount.textContent = `${creatures.length} creatures found`;
        }
        
        // Render the results
        renderCreatureResults(creatures);
    } catch (error) {
        console.error('Error searching creatures:', error);
        
        // Show error in results
        const resultsContainer = document.getElementById('creature-list');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="search-error">
                    <p>Error searching creatures: ${error.message}</p>
                </div>
            `;
        }
    }
}

/**
 * Render the creature search results
 * @param {Array} creatures - The creatures to render
 */
function renderCreatureResults(creatures) {
    const listContainer = document.getElementById('creature-list');
    if (!listContainer) return;
    
    if (creatures.length === 0) {
        listContainer.innerHTML = `
            <div class="no-results">
                <p>No creatures found. Try adjusting your filters.</p>
            </div>
        `;
        return;
    }
    
    // Create a table layout for better space utilization
    const tableHTML = `
        <table class="creature-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>CR</th>
                </tr>
            </thead>
            <tbody>
                ${creatures.map(creature => {
                    const favoriteEntry = favorites.find(fav => fav.creatureId === creature.id);
                    const isFav = Boolean(favoriteEntry);
                    
                    return `
                        <tr class="creature-row" data-id="${creature.id}">
                            <td class="creature-name">
                                ${creature.name} ${isFav ? `<span class="favorite-indicator" title="In favorites">★</span>` : ''}
                            </td>
                            <td>${capitalizeFirstLetter(creature.type)}</td>
                            <td>${getSizeName(creature.size)}</td>
                            <td>CR ${formatCR(creature.cr)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    listContainer.innerHTML = tableHTML;
    
    // Add click listeners to creature rows
    const creatureRows = document.querySelectorAll('.creature-row');
    creatureRows.forEach(row => {
        row.addEventListener('click', () => {
            const creatureId = row.getAttribute('data-id');
            displayCreatureDetails(creatureId);
            
            // Add selected class to the clicked row and remove from others
            creatureRows.forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
        });
    });
}

/**
 * Render the favorites list
 */
function renderFavorites() {
    const favoritesList = document.getElementById('favorites-list');
    if (!favoritesList) return;
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = `
            <div class="no-favorites">
                <p>No favorites added yet.</p>
                <p>Click "Add to Favorites" in the statblock to add creatures to your favorites.</p>
            </div>
        `;
        return;
    }
    
    // Get all creatures to match IDs with names
    dataManager.getAllCreatures().then(creatures => {
        // Sort favorites by name
        favorites.sort((a, b) => {
            const creatureA = creatures.find(c => c.id === a.creatureId);
            const creatureB = creatures.find(c => c.id === b.creatureId);
            
            if (!creatureA || !creatureB) return 0;
            return creatureA.name.localeCompare(creatureB.name);
        });
        
        const favoritesHTML = `
            <ul class="favorites-list">
                ${favorites.map(favorite => {
                    const creature = creatures.find(c => c.id === favorite.creatureId);
                    if (!creature) return '';
                    
                    return `
                        <li class="favorite-item">
                            <div class="favorite-item-info">
                                <span class="favorite-item-name">${creature.name}</span>
                                <span class="favorite-item-count">(${favorite.count})</span>
                            </div>
                            <div class="favorite-item-actions">
                                <button class="favorite-view-btn" data-id="${favorite.creatureId}">View</button>
                                <button class="favorite-remove-btn" data-id="${favorite.creatureId}">Remove</button>
                            </div>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
        
        favoritesList.innerHTML = favoritesHTML;
        
        // Add click listeners to favorite action buttons
        const viewButtons = document.querySelectorAll('.favorite-view-btn');
        viewButtons.forEach(button => {
            button.addEventListener('click', () => {
                const creatureId = button.getAttribute('data-id');
                displayCreatureDetails(creatureId);
                
                // Find and select the corresponding row if visible
                const row = document.querySelector(`.creature-row[data-id="${creatureId}"]`);
                if (row) {
                    const rows = document.querySelectorAll('.creature-row');
                    rows.forEach(r => r.classList.remove('selected'));
                    row.classList.add('selected');
                    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        });
        
        const removeButtons = document.querySelectorAll('.favorite-remove-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const creatureId = button.getAttribute('data-id');
                removeFavorite(creatureId);
            });
        });
    });
}

/**
 * Display the details of a creature
 * @param {string} creatureId - The ID of the creature to display
 */
async function displayCreatureDetails(creatureId) {
    try {
        // Get the creature data
        const creatures = await dataManager.getAllCreatures();
        const creature = creatures.find(c => c.id === creatureId);
        
        if (!creature) {
            throw new Error(`Creature with ID ${creatureId} not found`);
        }
        
        // Check if it's a favorite
        const favoriteEntry = favorites.find(fav => fav.creatureId === creatureId);
        const isFav = Boolean(favoriteEntry);
        const favCount = favoriteEntry ? favoriteEntry.count : 1;
        
        // Get the detail container
        const detailContainer = document.getElementById('creature-detail');
        if (!detailContainer) return;
        
        // Determine if this is a 5e Tools format creature
        const is5eToolsFormat = creature.sourceFormat === '5eTools';
        
        // Create the statblock HTML with enhanced fields for 5e Tools format
        const statblockHTML = `
            <div class="statblock">
                <div class="statblock-header">
                    <h2 class="creature-name">${creature.name}</h2>
                    <div class="creature-subtitle">
                        ${getSizeName(creature.size)} ${capitalizeFirstLetter(creature.type)}, CR ${formatCR(creature.cr)}
                        ${is5eToolsFormat && creature.alignment ? `<br>${creature.alignment}` : ''}
                    </div>
                </div>
                
                <div class="statblock-section">
                    <div class="statblock-property">
                        <span class="property-name">Armor Class</span>
                        <span class="property-value">${creature.ac}</span>
                    </div>
                    <div class="statblock-property">
                        <span class="property-name">Hit Points</span>
                        <span class="property-value">${creature.hp.average} ${creature.hp.formula ? `(${creature.hp.formula})` : ''}</span>
                    </div>
                    <div class="statblock-property">
                        <span class="property-name">Speed</span>
                        <span class="property-value">${formatSpeed(creature.speed)}</span>
                    </div>
                </div>
                
                <div class="statblock-section ability-scores">
                    <div class="ability-score">
                        <div class="ability-name">STR</div>
                        <div class="ability-value">${creature.abilities.str}</div>
                        <div class="ability-modifier">${formatModifier(creature.abilities.strMod)}</div>
                    </div>
                    <div class="ability-score">
                        <div class="ability-name">DEX</div>
                        <div class="ability-value">${creature.abilities.dex}</div>
                        <div class="ability-modifier">${formatModifier(creature.abilities.dexMod)}</div>
                    </div>
                    <div class="ability-score">
                        <div class="ability-name">CON</div>
                        <div class="ability-value">${creature.abilities.con}</div>
                        <div class="ability-modifier">${formatModifier(creature.abilities.conMod)}</div>
                    </div>
                    <div class="ability-score">
                        <div class="ability-name">INT</div>
                        <div class="ability-value">${creature.abilities.int}</div>
                        <div class="ability-modifier">${formatModifier(creature.abilities.intMod)}</div>
                    </div>
                    <div class="ability-score">
                        <div class="ability-name">WIS</div>
                        <div class="ability-value">${creature.abilities.wis}</div>
                        <div class="ability-modifier">${formatModifier(creature.abilities.wisMod)}</div>
                    </div>
                    <div class="ability-score">
                        <div class="ability-name">CHA</div>
                        <div class="ability-value">${creature.abilities.cha}</div>
                        <div class="ability-modifier">${formatModifier(creature.abilities.chaMod)}</div>
                    </div>
                </div>
                
                ${is5eToolsFormat ? renderAdditionalProperties(creature) : ''}
                
                ${creature.specialAbilities && creature.specialAbilities.length > 0 ? `
                <div class="statblock-section">
                    <h3 class="section-title">Special Abilities</h3>
                    ${creature.specialAbilities.map(ability => `
                        <div class="statblock-trait">
                            <span class="trait-name">${ability.name}.</span>
                            <span class="trait-description">${ability.description}</span>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                
                ${creature.attacks && creature.attacks.length > 0 ? `
                <div class="statblock-section">
                    <h3 class="section-title">Actions</h3>
                    ${creature.attacks.map(attack => `
                        <div class="statblock-action">
                            <span class="action-name">${attack.name}.</span>
                            <span class="action-description">${formatAttackDescription(attack)}</span>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                
                ${is5eToolsFormat && creature.environment ? `
                <div class="statblock-section">
                    <h3 class="section-title">Environment</h3>
                    <div class="statblock-environment">
                        ${Array.isArray(creature.environment) ? creature.environment.join(', ') : creature.environment}
                    </div>
                </div>
                ` : ''}
                
                <div class="statblock-footer">
                    <div class="statblock-source">Source: ${creature.source}</div>
                    <div class="statblock-actions">
                        <button id="add-to-combat-btn" class="primary-btn" data-id="${creature.id}">
                            Add to Combat <span class="quantity-badge">${favCount}</span>
                        </button>
                        <button id="toggle-favorite-btn" class="secondary-btn ${isFav ? 'favorite' : ''}" data-id="${creature.id}" data-count="${favCount}">
                            ${isFav ? 'Edit Favorite' : 'Add to Favorites'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Render the statblock
        detailContainer.innerHTML = statblockHTML;
        
        // Add event listener for favorite button
        const favoriteBtn = document.getElementById('toggle-favorite-btn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', () => {
                const creatureId = favoriteBtn.getAttribute('data-id');
                const currentCount = parseInt(favoriteBtn.getAttribute('data-count'));
                showFavoriteQuantityDialog(creatureId, currentCount);
            });
        }
        
        // Add event listener for add to combat button
        const addToCombatBtn = document.getElementById('add-to-combat-btn');
        if (addToCombatBtn) {
            addToCombatBtn.addEventListener('click', () => {
                const creatureId = addToCombatBtn.getAttribute('data-id');
                showCombatQuantityDialog(creatureId, favCount);
            });
        }
    } catch (error) {
        console.error('Error displaying creature details:', error);
        
        // Show error in detail container
        const detailContainer = document.getElementById('creature-detail');
        if (detailContainer) {
            detailContainer.innerHTML = `
                <div class="detail-error">
                    <h3>Error Loading Details</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

/**
 * Render additional properties for 5e Tools formatted creatures
 * @param {Object} creature - The creature object
 * @returns {string} HTML for additional properties
 */
function renderAdditionalProperties(creature) {
    let html = '';
    
    // Skills
    if (creature.skills && Object.keys(creature.skills).length > 0) {
        html += `
            <div class="statblock-section">
                <div class="statblock-property">
                    <span class="property-name">Skills</span>
                    <span class="property-value">
                        ${Object.entries(creature.skills).map(([skill, bonus]) => 
                            `${capitalizeFirstLetter(skill)} ${bonus}`
                        ).join(', ')}
                    </span>
                </div>
            </div>
        `;
    }
    
    // Senses
    if (creature.senses && creature.senses.length > 0) {
        html += `
            <div class="statblock-section">
                <div class="statblock-property">
                    <span class="property-name">Senses</span>
                    <span class="property-value">${Array.isArray(creature.senses) ? creature.senses.join(', ') : creature.senses}</span>
                </div>
            </div>
        `;
    }
    
    // Languages
    if (creature.languages && creature.languages.length > 0) {
        html += `
            <div class="statblock-section">
                <div class="statblock-property">
                    <span class="property-name">Languages</span>
                    <span class="property-value">${Array.isArray(creature.languages) ? creature.languages.join(', ') : creature.languages}</span>
                </div>
            </div>
        `;
    }
    
    // Damage types
    if (creature.damageTypes && creature.damageTypes.length > 0) {
        html += `
            <div class="statblock-section">
                <div class="statblock-property">
                    <span class="property-name">Damage Types</span>
                    <span class="property-value">${creature.damageTypes.map(type => capitalizeFirstLetter(type)).join(', ')}</span>
                </div>
            </div>
        `;
    }
    
    // Condition Immunities
    if (creature.conditionImmunities && creature.conditionImmunities.length > 0) {
        html += `
            <div class="statblock-section">
                <div class="statblock-property">
                    <span class="property-name">Condition Immunities</span>
                    <span class="property-value">${Array.isArray(creature.conditionImmunities) ? 
                        creature.conditionImmunities.map(condition => capitalizeFirstLetter(condition)).join(', ') : 
                        capitalizeFirstLetter(creature.conditionImmunities)}</span>
                </div>
            </div>
        `;
    }
    
    return html;
}

/**
 * Show a dialog to set the quantity of creatures to add to favorites
 * @param {string} creatureId - The ID of the creature
 * @param {number} currentCount - The current count (if already a favorite)
 */
function showFavoriteQuantityDialog(creatureId, currentCount = 1) {
    // Get creature name for better UX
    dataManager.getAllCreatures().then(creatures => {
        const creature = creatures.find(c => c.id === creatureId);
        
        if (!creature) {
            console.error('Creature not found:', creatureId);
            return;
        }
        
        // Create a modal dialog
        const dialogOverlay = document.createElement('div');
        dialogOverlay.className = 'dialog-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'quantity-dialog';
        
        const existingFavorite = favorites.find(fav => fav.creatureId === creatureId);
        const isEdit = Boolean(existingFavorite);
        
        dialog.innerHTML = `
            <h3>${isEdit ? 'Edit Favorite' : 'Add to Favorites'}</h3>
            <p>How many ${creature.name} would you like to ${isEdit ? 'have in your favorites' : 'add to favorites'}?</p>
            <div class="quantity-control">
                <button class="quantity-btn decrease">-</button>
                <input type="number" class="quantity-input" value="${currentCount}" min="1" max="20">
                <button class="quantity-btn increase">+</button>
            </div>
            <div class="dialog-buttons">
                ${isEdit ? '<button class="remove-btn">Remove from Favorites</button>' : ''}
                <button class="cancel-btn">Cancel</button>
                <button class="confirm-btn">${isEdit ? 'Update' : 'Add'}</button>
            </div>
        `;
        
        dialogOverlay.appendChild(dialog);
        document.body.appendChild(dialogOverlay);
        
        // Focus the input
        const quantityInput = dialog.querySelector('.quantity-input');
        quantityInput.focus();
        quantityInput.select();
        
        // Add event listeners
        const decreaseBtn = dialog.querySelector('.decrease');
        const increaseBtn = dialog.querySelector('.increase');
        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const removeBtn = dialog.querySelector('.remove-btn');
        
        decreaseBtn.addEventListener('click', () => {
            let value = parseInt(quantityInput.value);
            if (value > 1) {
                quantityInput.value = value - 1;
            }
        });
        
        increaseBtn.addEventListener('click', () => {
            let value = parseInt(quantityInput.value);
            if (value < 20) {
                quantityInput.value = value + 1;
            }
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(dialogOverlay);
        });
        
        confirmBtn.addEventListener('click', () => {
            const count = parseInt(quantityInput.value);
            
            if (isNaN(count) || count < 1) {
                alert('Please enter a valid number');
                return;
            }
            
            addOrUpdateFavorite(creatureId, creature.name, count);
            document.body.removeChild(dialogOverlay);
        });
        
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                removeFavorite(creatureId);
                document.body.removeChild(dialogOverlay);
            });
        }
        
        // Prevent closing when clicking on the dialog itself
        dialog.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        
        // Close when clicking outside the dialog
        dialogOverlay.addEventListener('click', () => {
            document.body.removeChild(dialogOverlay);
        });
    });
}

/**
 * Show a dialog to set the quantity of creatures to add to combat
 * @param {string} creatureId - The ID of the creature
 * @param {number} defaultCount - The default count to use (from favorites)
 */
function showCombatQuantityDialog(creatureId, defaultCount = 1) {
    // Get creature name for better UX
    dataManager.getAllCreatures().then(creatures => {
        const creature = creatures.find(c => c.id === creatureId);
        
        if (!creature) {
            console.error('Creature not found:', creatureId);
            return;
        }
        
        // Create a modal dialog
        const dialogOverlay = document.createElement('div');
        dialogOverlay.className = 'dialog-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'quantity-dialog';
        
        dialog.innerHTML = `
            <h3>Add to Combat</h3>
            <p>How many ${creature.name} would you like to add to combat?</p>
            <div class="quantity-control">
                <button class="quantity-btn decrease">-</button>
                <input type="number" class="quantity-input" value="${defaultCount}" min="1" max="20">
                <button class="quantity-btn increase">+</button>
            </div>
            <div class="dialog-buttons">
                <button class="cancel-btn">Cancel</button>
                <button class="confirm-btn">Add</button>
            </div>
        `;
        
        dialogOverlay.appendChild(dialog);
        document.body.appendChild(dialogOverlay);
        
        // Focus the input
        const quantityInput = dialog.querySelector('.quantity-input');
        quantityInput.focus();
        quantityInput.select();
        
        // Add event listeners
        const decreaseBtn = dialog.querySelector('.decrease');
        const increaseBtn = dialog.querySelector('.increase');
        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        
        decreaseBtn.addEventListener('click', () => {
            let value = parseInt(quantityInput.value);
            if (value > 1) {
                quantityInput.value = value - 1;
            }
        });
        
        increaseBtn.addEventListener('click', () => {
            let value = parseInt(quantityInput.value);
            if (value < 20) {
                quantityInput.value = value + 1;
            }
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(dialogOverlay);
        });
        
        confirmBtn.addEventListener('click', () => {
            const count = parseInt(quantityInput.value);
            
            if (isNaN(count) || count < 1) {
                alert('Please enter a valid number');
                return;
            }
            
            // This will be implemented in the combat module
            console.log('Add to combat clicked for creature:', creatureId, 'count:', count);
            showNotification(`Added ${count} ${creature.name} to combat.`, 'info');
            
            document.body.removeChild(dialogOverlay);
        });
        
        // Prevent closing when clicking on the dialog itself
        dialog.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        
        // Close when clicking outside the dialog
        dialogOverlay.addEventListener('click', () => {
            document.body.removeChild(dialogOverlay);
        });
    });
}

/**
 * Format an attack description
 * @param {Object} attack - The attack object
 * @returns {string} Formatted attack description
 */
function formatAttackDescription(attack) {
    if (attack.description) {
        // For 5e Tools format, the description is already processed
        if (attack.raw && attack.raw.includes('{@')) {
            return attack.description;
        }
        
        // For standard format, process tags
        let description = attack.description
            .replace(/{@atk mw}/g, 'Melee Weapon Attack:')
            .replace(/{@atk rw}/g, 'Ranged Weapon Attack:')
            .replace(/{@hit (\d+)}/g, '+$1')
            .replace(/{@damage (.+?)}/g, '$1');
        
        return description;
    }
    
    // Fallback for attacks without a description
    return `${attack.attackType === 'melee' ? 'Melee' : 'Ranged'} attack: +${attack.hitBonus || '?'} to hit, ${attack.damage || '?'} damage.`;
}

/**
 * Add or update a favorite creature
 * @param {string} creatureId - The ID of the creature
 * @param {string} creatureName - The name of the creature
 * @param {number} count - The number of creatures
 */
function addOrUpdateFavorite(creatureId, creatureName, count) {
    const index = favorites.findIndex(fav => fav.creatureId === creatureId);
    
    if (index === -1) {
        // Add new favorite
        favorites.push({
            creatureId,
            creatureName,
            count,
            addedAt: new Date().toISOString()
        });
        showNotification(`Added ${count} ${creatureName} to favorites.`, 'success');
    } else {
        // Update existing favorite
        const oldCount = favorites[index].count;
        favorites[index].count = count;
        showNotification(`Updated ${creatureName} from ${oldCount} to ${count} in favorites.`, 'success');
    }
    
    // Save to localStorage
    saveFavorites();
    
    // Refresh the favorites menu
    renderFavorites();
    
    // Refresh the search results if favorites filter is active
    if (filterState.favorites) {
        searchCreatures();
    } else {
        // Otherwise just update favorite indicators
        updateFavoriteIndicators();
    }
}

/**
 * Remove a creature from favorites
 * @param {string} creatureId - The ID of the creature to remove
 */
function removeFavorite(creatureId) {
    const index = favorites.findIndex(fav => fav.creatureId === creatureId);
    
    if (index !== -1) {
        // Get the name for the notification
        const name = favorites[index].creatureName;
        
        // Remove from favorites
        favorites.splice(index, 1);
        
        // Save to localStorage
        saveFavorites();
        
        // Show notification
        showNotification(`Removed ${name} from favorites.`, 'info');
        
        // Refresh the favorites menu
        renderFavorites();
        
        // Refresh the search results if favorites filter is active
        if (filterState.favorites) {
            searchCreatures();
        } else {
            // Otherwise just update favorite indicators
            updateFavoriteIndicators();
        }
    }
}

/**
 * Update favorite indicators in the creature list
 */
function updateFavoriteIndicators() {
    const creatureRows = document.querySelectorAll('.creature-row');
    
    creatureRows.forEach(row => {
        const creatureId = row.getAttribute('data-id');
        const isFav = favorites.some(fav => fav.creatureId === creatureId);
        
        const nameCell = row.querySelector('.creature-name');
        if (nameCell) {
            // Remove any existing indicator
            const existingIndicator = nameCell.querySelector('.favorite-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            // Add indicator if favorite
            if (isFav) {
                const indicator = document.createElement('span');
                indicator.className = 'favorite-indicator';
                indicator.title = 'In favorites';
                indicator.textContent = '★';
                nameCell.appendChild(indicator);
            }
        }
    });
}

/**
 * Save favorites to localStorage
 */
function saveFavorites() {
    try {
        localStorage.setItem('dnd5e_summons_favorites', JSON.stringify(favorites));
    } catch (error) {
        console.error('Error saving favorites:', error);
    }
}

/**
 * Load favorites from localStorage
 */
function loadFavorites() {
    try {
        const storedFavorites = localStorage.getItem('dnd5e_summons_favorites');
        if (storedFavorites) {
            favorites = JSON.parse(storedFavorites);
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
        favorites = [];
    }
}

/**
 * Show notification
 * @param {string} message - Message to display
 * @param {string} type - Notification type (success, error, info)
 */
function showNotification(message, type = 'info') {
    // This is just a placeholder - the actual notification logic is in main.js
    // We'll trigger an event that main.js can listen for
    const event = new CustomEvent('showNotification', {
        detail: {
            message,
            type
        }
    });
    document.dispatchEvent(event);
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

/**
 * Get the order value for a size code for sorting
 * @param {string} size - The size code
 * @returns {number} The order value
 */
function getSizeOrder(size) {
    const sizeOrder = {
        'T': 1,
        'S': 2,
        'M': 3,
        'L': 4,
        'H': 5,
        'G': 6
    };
    
    return sizeOrder[size] || 99;
}

/**
 * Format an ability score modifier
 * @param {number} modifier - The ability score modifier
 * @returns {string} Formatted modifier with sign
 */
function formatModifier(modifier) {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

/**
 * Format the speed object into a readable string
 * @param {Object} speed - The speed object
 * @returns {string} Formatted speed string
 */
function formatSpeed(speed) {
    const speedParts = [];
    
    if (speed.walk) {
        speedParts.push(`${speed.walk} ft.`);
    }
    
    const specialSpeeds = [];
    if (speed.fly) specialSpeeds.push(`fly ${speed.fly} ft.`);
    if (speed.swim) specialSpeeds.push(`swim ${speed.swim} ft.`);
    if (speed.climb) specialSpeeds.push(`climb ${speed.climb} ft.`);
    if (speed.burrow) specialSpeeds.push(`burrow ${speed.burrow} ft.`);
    
    if (specialSpeeds.length > 0) {
        speedParts.push(specialSpeeds.join(', '));
    }
    
    return speedParts.join(', ');
}

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Export functions for testing
 */
export const __test = {
    formatCR,
    getSizeName,
    formatModifier,
    formatSpeed,
    capitalizeFirstLetter
};