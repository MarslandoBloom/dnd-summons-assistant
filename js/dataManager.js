/**
 * D&D 5e Summons Assistant
 * Data Manager Module
 * Responsible for handling data loading, processing, and storage
 */

// Define the structure to store processed data
const dataStore = {
    version: '0.1.0',
    lastUpdated: null,
    creatures: [],
    creaturesByType: {},
    creaturesByCR: {}
};

/**
 * Initialize the data manager
 * @returns {Promise} Resolves when initialization is complete
 */
export async function initDataManager() {
    console.log('Initializing data manager...');
    try {
        await checkLocalData();
        return true;
    } catch (error) {
        console.error('Error initializing data manager:', error);
        return false;
    }
}

/**
 * Check if data exists in local storage
 * @returns {Promise} Resolves with true if data exists, false otherwise
 */
async function checkLocalData() {
    try {
        const versionData = localStorage.getItem('dnd5e_summons_data_version');
        
        if (versionData) {
            // Load all data from localStorage
            const storageData = loadFromLocalStorage();
            
            if (storageData && storageData.creatures && storageData.creatures.length > 0) {
                // Copy loaded data to our dataStore
                Object.assign(dataStore, storageData);
                console.log(`Loaded ${dataStore.creatures.length} creatures from local storage (version ${dataStore.version})`);
                return true;
            }
        }
        
        console.log('No valid data found in local storage');
        return false;
    } catch (error) {
        console.error('Error checking local data:', error);
        return false;
    }
}

/**
 * Handle uploaded bestiary files
 * @param {FileList} files - The uploaded files
 * @returns {Promise} Resolves when processing is complete
 */
export async function handleFileUpload(files) {
    if (!files || files.length === 0) {
        throw new Error('No files selected');
    }
    
    try {
        // Reset the data store before processing new files
        resetDataStore();
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if file is JSON
            if (!file.name.endsWith('.json')) {
                console.warn(`Skipping non-JSON file: ${file.name}`);
                continue;
            }
            
            await processJSONFile(file);
        }
        
        // After processing all files, index the creatures
        indexCreatures();
        
        // Save to local storage
        dataStore.lastUpdated = new Date().toISOString();
        saveToLocalStorage();
        
        console.log(`Processed ${dataStore.creatures.length} creatures from ${files.length} files`);
        return true;
    } catch (error) {
        console.error('Error processing uploaded files:', error);
        throw error;
    }
}

/**
 * Process a single JSON file
 * @param {File} file - The JSON file to process
 * @returns {Promise} Resolves when processing is complete
 */
async function processJSONFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                const jsonData = JSON.parse(event.target.result);
                
                // Check if this is a bestiary file (should have a "monster" array)
                if (jsonData.monster && Array.isArray(jsonData.monster)) {
                    // Process monster data
                    processMonsterData(jsonData.monster, file.name);
                    resolve();
                } else {
                    console.warn(`File ${file.name} does not contain monster data, skipping`);
                    resolve();
                }
            } catch (error) {
                console.error(`Error parsing JSON file ${file.name}:`, error);
                reject(error);
            }
        };
        
        reader.onerror = function() {
            reject(new Error(`Error reading file ${file.name}`));
        };
        
        reader.readAsText(file);
    });
}

/**
 * Process monster data from a bestiary file
 * @param {Array} monsters - Array of monster objects
 * @param {string} source - Source file name
 */
function processMonsterData(monsters, source) {
    console.log(`Processing ${monsters.length} monsters from ${source}`);
    
    // Filter and transform monsters
    monsters.forEach(monster => {
        // Skip if missing essential data
        if (!monster.name || !monster.type) {
            return;
        }
        
        // Create a simplified creature object with only the data we need
        const creature = {
            name: monster.name,
            source: monster.source || 'Unknown',
            type: getCreatureType(monster),
            size: monster.size || 'M',
            cr: getChallengeRating(monster),
            hp: getHitPoints(monster),
            ac: getArmorClass(monster),
            speed: getSpeed(monster),
            abilities: getAbilityScores(monster),
            attacks: getAttacks(monster),
            specialAbilities: getSpecialAbilities(monster),
            // Add a unique ID
            id: `${monster.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${monster.source || 'unk'}`
        };
        
        // Add to our creatures array
        dataStore.creatures.push(creature);
    });
}

/**
 * Get creature type in a standardized format
 * @param {Object} monster - Monster data
 * @returns {string} Creature type
 */
function getCreatureType(monster) {
    if (typeof monster.type === 'string') {
        return monster.type.toLowerCase();
    } else if (typeof monster.type === 'object' && monster.type.type) {
        return monster.type.type.toLowerCase();
    }
    return 'unknown';
}

/**
 * Get challenge rating as a number
 * @param {Object} monster - Monster data
 * @returns {number} Challenge rating as a number
 */
function getChallengeRating(monster) {
    if (!monster.cr) return 0;
    
    if (typeof monster.cr === 'number') {
        return monster.cr;
    }
    
    if (typeof monster.cr === 'string') {
        if (monster.cr === '1/8') return 0.125;
        if (monster.cr === '1/4') return 0.25;
        if (monster.cr === '1/2') return 0.5;
        return parseFloat(monster.cr) || 0;
    }
    
    if (typeof monster.cr === 'object' && monster.cr.cr) {
        return getChallengeRating({ cr: monster.cr.cr });
    }
    
    return 0;
}

/**
 * Get hit points
 * @param {Object} monster - Monster data
 * @returns {Object} Hit points object with average and formula
 */
function getHitPoints(monster) {
    if (!monster.hp) {
        return { average: 10, formula: '1d8+2' };
    }
    
    if (typeof monster.hp === 'number') {
        return { average: monster.hp, formula: null };
    }
    
    if (typeof monster.hp === 'object') {
        return {
            average: monster.hp.average || 10,
            formula: monster.hp.formula || null
        };
    }
    
    return { average: 10, formula: null };
}

/**
 * Get armor class
 * @param {Object} monster - Monster data
 * @returns {number} Armor class value
 */
function getArmorClass(monster) {
    if (!monster.ac) return 10;
    
    if (typeof monster.ac === 'number') {
        return monster.ac;
    }
    
    if (Array.isArray(monster.ac)) {
        // Take the first AC value
        const firstAc = monster.ac[0];
        if (typeof firstAc === 'number') {
            return firstAc;
        }
        if (typeof firstAc === 'object' && firstAc.ac) {
            return firstAc.ac;
        }
    }
    
    if (typeof monster.ac === 'object' && monster.ac.ac) {
        return monster.ac.ac;
    }
    
    return 10;
}

/**
 * Get speed object
 * @param {Object} monster - Monster data
 * @returns {Object} Speed object
 */
function getSpeed(monster) {
    if (!monster.speed) {
        return { walk: 30 };
    }
    
    if (typeof monster.speed === 'number') {
        return { walk: monster.speed };
    }
    
    if (typeof monster.speed === 'object') {
        // Convert to a simpler format
        const result = {};
        
        if (monster.speed.walk) {
            result.walk = typeof monster.speed.walk === 'number' ? 
                monster.speed.walk : parseInt(monster.speed.walk) || 30;
        } else {
            result.walk = 30;
        }
        
        // Add other movement types if present
        ['fly', 'swim', 'climb', 'burrow'].forEach(type => {
            if (monster.speed[type]) {
                result[type] = typeof monster.speed[type] === 'number' ? 
                    monster.speed[type] : parseInt(monster.speed[type]) || 0;
            }
        });
        
        return result;
    }
    
    return { walk: 30 };
}

/**
 * Get ability scores
 * @param {Object} monster - Monster data
 * @returns {Object} Ability scores object
 */
function getAbilityScores(monster) {
    const abilities = {
        str: monster.str || 10,
        dex: monster.dex || 10,
        con: monster.con || 10,
        int: monster.int || 10,
        wis: monster.wis || 10,
        cha: monster.cha || 10
    };
    
    // Add modifiers
    for (const [key, value] of Object.entries(abilities)) {
        abilities[`${key}Mod`] = Math.floor((value - 10) / 2);
    }
    
    return abilities;
}

/**
 * Get attacks from actions
 * @param {Object} monster - Monster data
 * @returns {Array} Array of attack objects
 */
function getAttacks(monster) {
    const attacks = [];
    
    if (!monster.action || !Array.isArray(monster.action)) {
        return attacks;
    }
    
    monster.action.forEach(action => {
        // Simple heuristic to identify attack actions
        if (!action.name || !action.entries || !Array.isArray(action.entries)) {
            return;
        }
        
        const firstEntry = action.entries[0];
        if (typeof firstEntry !== 'string') {
            return;
        }
        
        // Look for attack patterns like "{@atk mw} {@hit 5} to hit" or similar
        if (
            firstEntry.includes('{@atk') && 
            (firstEntry.includes('{@hit') || firstEntry.includes('to hit'))
        ) {
            // Extract basic attack information
            const attack = {
                name: action.name,
                description: firstEntry,
                attackType: firstEntry.includes('{@atk mw}') ? 'melee' : 
                            firstEntry.includes('{@atk rw}') ? 'ranged' : 'other'
            };
            
            // Try to extract hit bonus
            const hitMatch = firstEntry.match(/{@hit (\d+)}/);
            if (hitMatch) {
                attack.hitBonus = parseInt(hitMatch[1]);
            }
            
            // Try to extract damage
            const damageMatches = firstEntry.match(/{@damage (.+?)}/g);
            if (damageMatches) {
                attack.damage = damageMatches.map(m => {
                    const cleanMatch = m.replace(/{@damage (.+?)}/g, '$1');
                    return cleanMatch;
                }).join(', ');
            }
            
            attacks.push(attack);
        }
    });
    
    return attacks;
}

/**
 * Get special abilities
 * @param {Object} monster - Monster data
 * @returns {Array} Array of special ability objects
 */
function getSpecialAbilities(monster) {
    const abilities = [];
    
    if (!monster.trait || !Array.isArray(monster.trait)) {
        return abilities;
    }
    
    monster.trait.forEach(trait => {
        if (!trait.name || !trait.entries || !Array.isArray(trait.entries)) {
            return;
        }
        
        abilities.push({
            name: trait.name,
            description: trait.entries.join(' ')
        });
    });
    
    return abilities;
}

/**
 * Index creatures by type and CR for faster lookups
 */
function indexCreatures() {
    dataStore.creaturesByType = {};
    dataStore.creaturesByCR = {};
    
    dataStore.creatures.forEach(creature => {
        // Index by type
        if (!dataStore.creaturesByType[creature.type]) {
            dataStore.creaturesByType[creature.type] = [];
        }
        dataStore.creaturesByType[creature.type].push(creature);
        
        // Index by CR
        const crKey = creature.cr.toString();
        if (!dataStore.creaturesByCR[crKey]) {
            dataStore.creaturesByCR[crKey] = [];
        }
        dataStore.creaturesByCR[crKey].push(creature);
    });
    
    console.log(`Indexed creatures by ${Object.keys(dataStore.creaturesByType).length} types and ${Object.keys(dataStore.creaturesByCR).length} challenge ratings`);
}

/**
 * Reset the data store to its initial state
 */
function resetDataStore() {
    dataStore.creatures = [];
    dataStore.creaturesByType = {};
    dataStore.creaturesByCR = {};
}

/**
 * Save current data to localStorage
 */
function saveToLocalStorage() {
    try {
        localStorage.setItem('dnd5e_summons_data_version', dataStore.version);
        localStorage.setItem('dnd5e_summons_data', JSON.stringify(dataStore));
        console.log(`Saved ${dataStore.creatures.length} creatures to localStorage`);
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        
        // If the error is a quota exceeded error, try to save just essential data
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            try {
                // Create a smaller version of the data
                const minimalData = {
                    version: dataStore.version,
                    lastUpdated: dataStore.lastUpdated,
                    creatures: dataStore.creatures.map(c => ({
                        id: c.id,
                        name: c.name,
                        type: c.type,
                        cr: c.cr,
                        size: c.size
                    }))
                };
                
                localStorage.setItem('dnd5e_summons_data_version', dataStore.version);
                localStorage.setItem('dnd5e_summons_data', JSON.stringify(minimalData));
                console.warn('Saved minimal data to localStorage due to storage limits');
                return true;
            } catch (miniError) {
                console.error('Error saving minimal data to localStorage:', miniError);
                return false;
            }
        }
        
        return false;
    }
}

/**
 * Load data from localStorage
 * @returns {Object|null} The loaded data or null if failed
 */
function loadFromLocalStorage() {
    try {
        const data = localStorage.getItem('dnd5e_summons_data');
        if (!data) return null;
        
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return null;
    }
}

/**
 * Get the current data
 * @returns {Object} The current data store
 */
export function getData() {
    return {
        version: dataStore.version,
        lastUpdated: dataStore.lastUpdated,
        creatureCount: dataStore.creatures.length,
        isLoaded: dataStore.creatures.length > 0
    };
}

/**
 * Get all creatures
 * @returns {Array} Array of all creatures
 */
export function getAllCreatures() {
    return [...dataStore.creatures];
}

/**
 * Get creatures by type
 * @param {string} type - The creature type
 * @returns {Array} Array of creatures of the specified type
 */
export function getCreaturesByType(type) {
    if (!type) return [];
    
    const typeKey = type.toLowerCase();
    return dataStore.creaturesByType[typeKey] || [];
}

/**
 * Get creatures by CR
 * @param {number} cr - The challenge rating
 * @returns {Array} Array of creatures of the specified CR
 */
export function getCreaturesByCR(cr) {
    if (cr === undefined || cr === null) return [];
    
    const crKey = cr.toString();
    return dataStore.creaturesByCR[crKey] || [];
}

/**
 * Search creatures by name
 * @param {string} searchTerm - The search term
 * @returns {Array} Array of matching creatures
 */
export function searchCreatures(searchTerm) {
    if (!searchTerm || typeof searchTerm !== 'string') {
        return [];
    }
    
    const term = searchTerm.toLowerCase().trim();
    
    return dataStore.creatures.filter(creature => 
        creature.name.toLowerCase().includes(term)
    );
}

/**
 * Clear all data from localStorage
 */
export function clearData() {
    resetDataStore();
    localStorage.removeItem('dnd5e_summons_data');
    localStorage.removeItem('dnd5e_summons_data_version');
    console.log('Cleared all data from localStorage');
}