/**
 * D&D 5e Summons Assistant
 * Data Manager Module
 * Responsible for handling data loading, processing, and storage using IndexedDB
 */

// Application constants
const DB_NAME = 'dnd5e_summons_db';
const DB_VERSION = 1;
const CREATURES_STORE = 'creatures';
const METADATA_STORE = 'metadata';

// Sample data URLs (relative to project root)
const SAMPLE_DATA_FILES = [
    'data/bestiary/bestiary-birds.json',
    'data/bestiary/bestiary-small-creatures.json',
    'data/bestiary/bestiary-mammals.json',
    'data/bestiary/bestiary-reptiles.json'
];

// In-memory cache for frequently accessed data
const dataCache = {
    metadata: {
        version: '0.1.0',
        lastUpdated: null,
        creatureCount: 0
    },
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
        await setupDatabase();
        await checkLocalData();
        return true;
    } catch (error) {
        console.error('Error initializing data manager:', error);
        // Try to fall back to localStorage if IndexedDB fails
        console.log('Attempting to fall back to localStorage...');
        try {
            await checkLocalStorageFallback();
            return true;
        } catch (fallbackError) {
            console.error('Fallback to localStorage failed:', fallbackError);
            return false;
        }
    }
}

/**
 * Set up the IndexedDB database and object stores
 * @returns {Promise} Resolves when setup is complete
 */
function setupDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(new Error('Could not open IndexedDB'));
        };
        
        request.onsuccess = (event) => {
            console.log('IndexedDB connection established successfully');
            resolve();
        };
        
        request.onupgradeneeded = (event) => {
            console.log('Setting up or upgrading IndexedDB database');
            const db = event.target.result;
            
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains(CREATURES_STORE)) {
                const creatureStore = db.createObjectStore(CREATURES_STORE, { keyPath: 'id' });
                
                // Create indexes for faster queries
                creatureStore.createIndex('byName', 'name', { unique: false });
                creatureStore.createIndex('byType', 'type', { unique: false });
                creatureStore.createIndex('byCR', 'cr', { unique: false });
                creatureStore.createIndex('bySize', 'size', { unique: false });
                
                console.log('Created creatures object store with indexes');
            }
            
            if (!db.objectStoreNames.contains(METADATA_STORE)) {
                db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
                console.log('Created metadata object store');
            }
        };
    });
}

/**
 * Open a connection to the IndexedDB database
 * @returns {Promise<IDBDatabase>} Resolves with the database connection
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            reject(new Error('Could not open IndexedDB'));
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            resolve(db);
        };
    });
}

/**
 * Check if data exists in IndexedDB
 * @returns {Promise<boolean>} Resolves with true if data exists, false otherwise
 */
async function checkLocalData() {
    try {
        const metadata = await getMetadata('appInfo');
        
        if (metadata && metadata.creatureCount > 0) {
            // Update cache with metadata
            dataCache.metadata = {
                version: metadata.version,
                lastUpdated: metadata.lastUpdated,
                creatureCount: metadata.creatureCount
            };
            
            console.log(`Found ${metadata.creatureCount} creatures in IndexedDB (version ${metadata.version})`);
            
            // Pre-populate the type and CR lookup caches
            await buildLookupCaches();
            
            return true;
        }
        
        console.log('No valid data found in IndexedDB');
        return false;
    } catch (error) {
        console.error('Error checking IndexedDB data:', error);
        return false;
    }
}

/**
 * Build in-memory lookup caches for creature types and CRs
 * @returns {Promise} Resolves when caches are built
 */
async function buildLookupCaches() {
    try {
        const db = await openDatabase();
        
        // Get all creature types
        const uniqueTypes = await new Promise((resolve, reject) => {
            const transaction = db.transaction(CREATURES_STORE, 'readonly');
            const store = transaction.objectStore(CREATURES_STORE);
            const typeIndex = store.index('byType');
            const uniqueTypes = new Set();
            
            const request = typeIndex.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    uniqueTypes.add(cursor.key);
                    cursor.continue();
                } else {
                    resolve(Array.from(uniqueTypes));
                }
            };
            
            request.onerror = (event) => {
                reject(new Error('Error retrieving creature types'));
            };
        });
        
        // Get all CRs
        const uniqueCRs = await new Promise((resolve, reject) => {
            const transaction = db.transaction(CREATURES_STORE, 'readonly');
            const store = transaction.objectStore(CREATURES_STORE);
            const crIndex = store.index('byCR');
            const uniqueCRs = new Set();
            
            const request = crIndex.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    uniqueCRs.add(cursor.key);
                    cursor.continue();
                } else {
                    resolve(Array.from(uniqueCRs));
                }
            };
            
            request.onerror = (event) => {
                reject(new Error('Error retrieving creature CRs'));
            };
        });
        
        // For each type and CR, get the creatures and cache them
        dataCache.creaturesByType = {};
        for (const type of uniqueTypes) {
            dataCache.creaturesByType[type] = await getCreaturesByTypeFromDB(type);
        }
        
        dataCache.creaturesByCR = {};
        for (const cr of uniqueCRs) {
            const crKey = cr.toString();
            dataCache.creaturesByCR[crKey] = await getCreaturesByCRFromDB(cr);
        }
        
        console.log(`Built lookup caches for ${uniqueTypes.length} types and ${uniqueCRs.length} CRs`);
        return true;
    } catch (error) {
        console.error('Error building lookup caches:', error);
        return false;
    }
}

/**
 * Get creatures of a specific type from the database
 * @param {string} type - The creature type
 * @returns {Promise<Array>} Resolves with an array of creatures
 */
async function getCreaturesByTypeFromDB(type) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDatabase();
            const transaction = db.transaction(CREATURES_STORE, 'readonly');
            const store = transaction.objectStore(CREATURES_STORE);
            const index = store.index('byType');
            const creatures = [];
            
            const request = index.openCursor(IDBKeyRange.only(type));
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    creatures.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(creatures);
                }
            };
            
            request.onerror = (event) => {
                reject(new Error(`Error retrieving creatures of type ${type}`));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get creatures of a specific CR from the database
 * @param {number} cr - The challenge rating
 * @returns {Promise<Array>} Resolves with an array of creatures
 */
async function getCreaturesByCRFromDB(cr) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDatabase();
            const transaction = db.transaction(CREATURES_STORE, 'readonly');
            const store = transaction.objectStore(CREATURES_STORE);
            const index = store.index('byCR');
            const creatures = [];
            
            const request = index.openCursor(IDBKeyRange.only(cr));
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    creatures.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(creatures);
                }
            };
            
            request.onerror = (event) => {
                reject(new Error(`Error retrieving creatures of CR ${cr}`));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get a specific metadata entry from IndexedDB
 * @param {string} key - The metadata key
 * @returns {Promise<Object|null>} Resolves with the metadata or null if not found
 */
async function getMetadata(key) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDatabase();
            const transaction = db.transaction(METADATA_STORE, 'readonly');
            const store = transaction.objectStore(METADATA_STORE);
            
            const request = store.get(key);
            
            request.onsuccess = (event) => {
                resolve(request.result ? request.result.value : null);
            };
            
            request.onerror = (event) => {
                reject(new Error(`Error retrieving metadata for key ${key}`));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Store a metadata entry in IndexedDB
 * @param {string} key - The metadata key
 * @param {Object} value - The metadata value
 * @returns {Promise} Resolves when storage is complete
 */
async function storeMetadata(key, value) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDatabase();
            const transaction = db.transaction(METADATA_STORE, 'readwrite');
            const store = transaction.objectStore(METADATA_STORE);
            
            const request = store.put({ key, value });
            
            request.onsuccess = () => {
                resolve();
            };
            
            request.onerror = (event) => {
                reject(new Error(`Error storing metadata for key ${key}`));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Fallback to localStorage if IndexedDB is not available
 * @returns {Promise<boolean>} Resolves with true if data exists, false otherwise
 */
async function checkLocalStorageFallback() {
    try {
        const versionData = localStorage.getItem('dnd5e_summons_data_version');
        
        if (versionData) {
            // Load all data from localStorage
            const storageData = JSON.parse(localStorage.getItem('dnd5e_summons_data'));
            
            if (storageData && storageData.creatures && storageData.creatures.length > 0) {
                // Copy loaded data to our cache
                dataCache.metadata.version = storageData.version;
                dataCache.metadata.lastUpdated = storageData.lastUpdated;
                dataCache.metadata.creatureCount = storageData.creatures.length;
                
                dataCache.creatures = storageData.creatures;
                dataCache.creaturesByType = storageData.creaturesByType || {};
                dataCache.creaturesByCR = storageData.creaturesByCR || {};
                
                console.log(`Loaded ${dataCache.metadata.creatureCount} creatures from localStorage fallback (version ${dataCache.metadata.version})`);
                return true;
            }
        }
        
        console.log('No valid data found in localStorage fallback');
        return false;
    } catch (error) {
        console.error('Error checking localStorage fallback:', error);
        return false;
    }
}

/**
 * Handle uploaded bestiary files
 * @param {FileList} files - The uploaded files
 * @returns {Promise<Object>} Resolves with results about the processed data
 */
export async function handleFileUpload(files) {
    if (!files || files.length === 0) {
        throw new Error('No files selected');
    }
    
    try {
        // Reset the data cache before processing new files
        resetDataCache();
        
        // Clear the database
        await clearDatabase();
        
        // Track processing statistics
        const stats = {
            totalFiles: files.length,
            processedFiles: 0,
            validFiles: 0,
            skippedFiles: 0,
            totalCreatures: 0,
            validCreatures: 0,
            invalidCreatures: 0
        };
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            stats.processedFiles++;
            
            // Check if file is JSON
            if (!file.name.endsWith('.json')) {
                console.warn(`Skipping non-JSON file: ${file.name}`);
                stats.skippedFiles++;
                continue;
            }
            
            const fileStats = await processJSONFile(file);
            stats.validFiles++;
            stats.totalCreatures += fileStats.totalMonsters;
            stats.validCreatures += fileStats.validMonsters;
            stats.invalidCreatures += fileStats.invalidMonsters;
        }
        
        // After processing all files, save the metadata
        dataCache.metadata.lastUpdated = new Date().toISOString();
        dataCache.metadata.creatureCount = dataCache.creatures.length;
        
        // Save to IndexedDB
        await storeProcessedData();
        
        console.log(`Processed ${dataCache.creatures.length} creatures from ${stats.validFiles} files`);
        
        return {
            success: true,
            stats: stats,
            creatures: dataCache.creatures.length,
            types: Object.keys(dataCache.creaturesByType).length,
            crs: Object.keys(dataCache.creaturesByCR).length
        };
    } catch (error) {
        console.error('Error processing uploaded files:', error);
        
        // Try to fall back to localStorage
        try {
            saveToLocalStorageFallback();
        } catch (fallbackError) {
            console.error('Error saving to localStorage fallback:', fallbackError);
        }
        
        throw error;
    }
}

/**
 * Load sample data from the predefined JSON files
 * @returns {Promise<Object>} Resolves with results about the processed data
 */
export async function loadSampleData() {
    try {
        // Reset the data cache before processing
        resetDataCache();
        
        // Clear the database
        await clearDatabase();
        
        // Track processing statistics
        const stats = {
            totalFiles: SAMPLE_DATA_FILES.length,
            processedFiles: 0,
            validFiles: 0,
            skippedFiles: 0,
            totalCreatures: 0,
            validCreatures: 0,
            invalidCreatures: 0
        };
        
        // Process each sample file
        for (const fileUrl of SAMPLE_DATA_FILES) {
            stats.processedFiles++;
            
            try {
                // Fetch the file
                const response = await fetch(fileUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                
                const jsonData = await response.json();
                
                // Process the data
                if (jsonData.monster && Array.isArray(jsonData.monster)) {
                    const fileStats = processMonsterData(jsonData.monster, fileUrl);
                    stats.validFiles++;
                    stats.totalCreatures += fileStats.totalMonsters;
                    stats.validCreatures += fileStats.validMonsters;
                    stats.invalidCreatures += fileStats.invalidMonsters;
                } else {
                    console.warn(`File ${fileUrl} does not contain monster data, skipping`);
                    stats.skippedFiles++;
                }
            } catch (error) {
                console.error(`Error loading sample file ${fileUrl}:`, error);
                stats.skippedFiles++;
            }
        }
        
        // After processing all files, save the metadata
        dataCache.metadata.lastUpdated = new Date().toISOString();
        dataCache.metadata.creatureCount = dataCache.creatures.length;
        
        // Save to IndexedDB
        await storeProcessedData();
        
        console.log(`Processed ${dataCache.creatures.length} creatures from ${stats.validFiles} sample files`);
        
        return {
            success: true,
            stats: stats,
            creatures: dataCache.creatures.length,
            types: Object.keys(dataCache.creaturesByType).length,
            crs: Object.keys(dataCache.creaturesByCR).length
        };
    } catch (error) {
        console.error('Error loading sample data:', error);
        throw error;
    }
}

/**
 * Clear the IndexedDB database
 * @returns {Promise} Resolves when clearing is complete
 */
async function clearDatabase() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDatabase();
            
            // Clear creatures store
            const creatureTransaction = db.transaction(CREATURES_STORE, 'readwrite');
            const creatureStore = creatureTransaction.objectStore(CREATURES_STORE);
            
            const creatureClearRequest = creatureStore.clear();
            
            creatureClearRequest.onsuccess = () => {
                console.log('Cleared creatures store');
                
                // Clear metadata store
                const metadataTransaction = db.transaction(METADATA_STORE, 'readwrite');
                const metadataStore = metadataTransaction.objectStore(METADATA_STORE);
                
                const metadataClearRequest = metadataStore.clear();
                
                metadataClearRequest.onsuccess = () => {
                    console.log('Cleared metadata store');
                    resolve();
                };
                
                metadataClearRequest.onerror = (event) => {
                    reject(new Error('Error clearing metadata store'));
                };
            };
            
            creatureClearRequest.onerror = (event) => {
                reject(new Error('Error clearing creatures store'));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Store processed data in IndexedDB
 * @returns {Promise} Resolves when storage is complete
 */
async function storeProcessedData() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDatabase();
            const transaction = db.transaction([CREATURES_STORE, METADATA_STORE], 'readwrite');
            const creatureStore = transaction.objectStore(CREATURES_STORE);
            const metadataStore = transaction.objectStore(METADATA_STORE);
            
            // Store each creature
            const creatures = dataCache.creatures;
            let completed = 0;
            
            for (const creature of creatures) {
                const request = creatureStore.add(creature);
                
                request.onsuccess = () => {
                    completed++;
                    if (completed === creatures.length) {
                        // All creatures stored, now store metadata
                        const metadataRequest = metadataStore.put({
                            key: 'appInfo',
                            value: {
                                version: dataCache.metadata.version,
                                lastUpdated: dataCache.metadata.lastUpdated,
                                creatureCount: dataCache.metadata.creatureCount
                            }
                        });
                        
                        metadataRequest.onsuccess = () => {
                            console.log(`Stored ${creatures.length} creatures and metadata in IndexedDB`);
                            resolve();
                        };
                        
                        metadataRequest.onerror = (event) => {
                            reject(new Error('Error storing metadata'));
                        };
                    }
                };
                
                request.onerror = (event) => {
                    console.error('Error storing creature:', creature.name, event.target.error);
                    // Continue with other creatures
                    completed++;
                    if (completed === creatures.length) {
                        resolve();
                    }
                };
            }
            
            // If no creatures, still store metadata
            if (creatures.length === 0) {
                const metadataRequest = metadataStore.put({
                    key: 'appInfo',
                    value: {
                        version: dataCache.metadata.version,
                        lastUpdated: dataCache.metadata.lastUpdated,
                        creatureCount: 0
                    }
                });
                
                metadataRequest.onsuccess = () => {
                    console.log('Stored metadata in IndexedDB (no creatures)');
                    resolve();
                };
                
                metadataRequest.onerror = (event) => {
                    reject(new Error('Error storing metadata'));
                };
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Process a single JSON file
 * @param {File} file - The JSON file to process
 * @returns {Promise<Object>} Resolves with statistics about the processed file
 */
function processJSONFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                const jsonData = JSON.parse(event.target.result);
                
                // Check if this is a bestiary file (should have a "monster" array)
                if (jsonData.monster && Array.isArray(jsonData.monster)) {
                    // Process monster data
                    const stats = processMonsterData(jsonData.monster, file.name);
                    resolve(stats);
                } else {
                    console.warn(`File ${file.name} does not contain monster data, skipping`);
                    resolve({
                        totalMonsters: 0,
                        validMonsters: 0,
                        invalidMonsters: 0
                    });
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
 * @returns {Object} Statistics about the processed monsters
 */
function processMonsterData(monsters, source) {
    console.log(`Processing ${monsters.length} monsters from ${source}`);
    
    const stats = {
        totalMonsters: monsters.length,
        validMonsters: 0,
        invalidMonsters: 0
    };
    
    // Filter and transform monsters
    monsters.forEach(monster => {
        // Validate the monster data
        if (!validateMonsterData(monster)) {
            stats.invalidMonsters++;
            return;
        }
        
        try {
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
            
            // Add to our creatures array in memory
            dataCache.creatures.push(creature);
            
            // Also update the lookup caches
            // By type
            if (!dataCache.creaturesByType[creature.type]) {
                dataCache.creaturesByType[creature.type] = [];
            }
            dataCache.creaturesByType[creature.type].push(creature);
            
            // By CR
            const crKey = creature.cr.toString();
            if (!dataCache.creaturesByCR[crKey]) {
                dataCache.creaturesByCR[crKey] = [];
            }
            dataCache.creaturesByCR[crKey].push(creature);
            
            stats.validMonsters++;
        } catch (error) {
            console.error(`Error processing monster ${monster.name}:`, error);
            stats.invalidMonsters++;
        }
    });
    
    return stats;
}

/**
 * Validate monster data for required fields and data types
 * @param {Object} monster - The monster data to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateMonsterData(monster) {
    // Check for required fields
    if (!monster.name || typeof monster.name !== 'string') {
        console.warn('Invalid monster: missing or invalid name');
        return false;
    }
    
    if (!monster.type) {
        console.warn(`Invalid monster ${monster.name}: missing type`);
        return false;
    }
    
    // Validate size is one of the valid D&D sizes
    const validSizes = ['T', 'S', 'M', 'L', 'H', 'G'];
    if (monster.size && !validSizes.includes(monster.size)) {
        console.warn(`Invalid monster ${monster.name}: invalid size ${monster.size}`);
        return false;
    }
    
    // Basic validation for CR
    if (monster.cr !== undefined) {
        // If CR is a string, check it's a valid fraction or number
        if (typeof monster.cr === 'string') {
            const validCRStrings = ['0', '1/8', '1/4', '1/2'];
            const isValidNumberString = !isNaN(parseFloat(monster.cr));
            
            if (!validCRStrings.includes(monster.cr) && !isValidNumberString) {
                console.warn(`Invalid monster ${monster.name}: invalid CR string ${monster.cr}`);
                return false;
            }
        }
        // If CR is an object, it should have a 'cr' property
        else if (typeof monster.cr === 'object' && !monster.cr.cr) {
            console.warn(`Invalid monster ${monster.name}: CR object missing 'cr' property`);
            return false;
        }
        // If CR is neither string, number, nor object, it's invalid
        else if (typeof monster.cr !== 'number' && typeof monster.cr !== 'object') {
            console.warn(`Invalid monster ${monster.name}: invalid CR type ${typeof monster.cr}`);
            return false;
        }
    }
    
    // Basic ability score validation
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const ability of abilities) {
        if (monster[ability] !== undefined) {
            const score = parseInt(monster[ability]);
            // D&D ability scores are typically between 1 and 30
            if (isNaN(score) || score < 1 || score > 30) {
                console.warn(`Invalid monster ${monster.name}: invalid ${ability} score ${monster[ability]}`);
                // Don't reject for ability score issues, just warn
            }
        }
    }
    
    return true;
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
 * Reset the data cache to its initial state
 */
function resetDataCache() {
    dataCache.creatures = [];
    dataCache.creaturesByType = {};
    dataCache.creaturesByCR = {};
    dataCache.metadata = {
        version: '0.1.0',
        lastUpdated: null,
        creatureCount: 0
    };
}

/**
 * Fallback: Save current data to localStorage
 */
function saveToLocalStorageFallback() {
    try {
        localStorage.setItem('dnd5e_summons_data_version', dataCache.metadata.version);
        
        // Try to save the full dataset first
        try {
            localStorage.setItem('dnd5e_summons_data', JSON.stringify({
                version: dataCache.metadata.version,
                lastUpdated: dataCache.metadata.lastUpdated,
                creatures: dataCache.creatures,
                creaturesByType: dataCache.creaturesByType,
                creaturesByCR: dataCache.creaturesByCR
            }));
            console.log(`Saved ${dataCache.creatures.length} creatures to localStorage fallback`);
            return true;
        } catch (error) {
            // If full save fails, try to save just essential data
            if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                const minimalData = {
                    version: dataCache.metadata.version,
                    lastUpdated: dataCache.metadata.lastUpdated,
                    creatures: dataCache.creatures.map(c => ({
                        id: c.id,
                        name: c.name,
                        type: c.type,
                        cr: c.cr,
                        size: c.size
                    }))
                };
                
                localStorage.setItem('dnd5e_summons_data', JSON.stringify(minimalData));
                console.warn('Saved minimal data to localStorage fallback due to storage limits');
                return true;
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error saving to localStorage fallback:', error);
        return false;
    }
}

/**
 * Get the current data
 * @returns {Object} The current data information
 */
export function getData() {
    return {
        version: dataCache.metadata.version,
        lastUpdated: dataCache.metadata.lastUpdated,
        creatureCount: dataCache.metadata.creatureCount,
        isLoaded: dataCache.metadata.creatureCount > 0
    };
}

/**
 * Get all creatures - loads from IndexedDB if not cached
 * @returns {Promise<Array>} Resolves with array of all creatures
 */
export async function getAllCreatures() {
    // If we already have the creatures in cache, return them
    if (dataCache.creatures.length > 0) {
        return [...dataCache.creatures];
    }
    
    // Otherwise, load from IndexedDB
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDatabase();
            const transaction = db.transaction(CREATURES_STORE, 'readonly');
            const store = transaction.objectStore(CREATURES_STORE);
            const creatures = [];
            
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    creatures.push(cursor.value);
                    cursor.continue();
                } else {
                    // Update cache
                    dataCache.creatures = creatures;
                    resolve([...creatures]);
                }
            };
            
            request.onerror = (event) => {
                reject(new Error('Error retrieving all creatures'));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get creatures by type
 * @param {string} type - The creature type
 * @returns {Promise<Array>} Resolves with array of creatures of the specified type
 */
export async function getCreaturesByType(type) {
    if (!type) return [];
    
    const typeKey = type.toLowerCase();
    
    // If we have them cached, return from cache
    if (dataCache.creaturesByType[typeKey]) {
        return [...dataCache.creaturesByType[typeKey]];
    }
    
    // Otherwise, query IndexedDB
    try {
        const creatures = await getCreaturesByTypeFromDB(typeKey);
        dataCache.creaturesByType[typeKey] = creatures;
        return [...creatures];
    } catch (error) {
        console.error(`Error getting creatures by type ${typeKey}:`, error);
        return [];
    }
}

/**
 * Get creatures by CR
 * @param {number} cr - The challenge rating
 * @returns {Promise<Array>} Resolves with array of creatures of the specified CR
 */
export async function getCreaturesByCR(cr) {
    if (cr === undefined || cr === null) return [];
    
    const crKey = cr.toString();
    
    // If we have them cached, return from cache
    if (dataCache.creaturesByCR[crKey]) {
        return [...dataCache.creaturesByCR[crKey]];
    }
    
    // Otherwise, query IndexedDB
    try {
        const creatures = await getCreaturesByCRFromDB(cr);
        dataCache.creaturesByCR[crKey] = creatures;
        return [...creatures];
    } catch (error) {
        console.error(`Error getting creatures by CR ${cr}:`, error);
        return [];
    }
}

/**
 * Search creatures by name
 * @param {string} searchTerm - The search term
 * @returns {Promise<Array>} Resolves with array of matching creatures
 */
export async function searchCreatures(searchTerm) {
    if (!searchTerm || typeof searchTerm !== 'string') {
        return [];
    }
    
    const term = searchTerm.toLowerCase().trim();
    
    try {
        // First check if we have the creatures in memory
        if (dataCache.creatures.length > 0) {
            return dataCache.creatures.filter(creature => 
                creature.name.toLowerCase().includes(term)
            );
        }
        
        // Otherwise, query the IndexedDB
        const db = await openDatabase();
        const transaction = db.transaction(CREATURES_STORE, 'readonly');
        const store = transaction.objectStore(CREATURES_STORE);
        
        // We could use a specific index, but for now, let's just search all creatures
        // This is simpler and works for partial matches
        return new Promise((resolve, reject) => {
            const creatures = [];
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const creature = cursor.value;
                    if (creature.name.toLowerCase().includes(term)) {
                        creatures.push(creature);
                    }
                    cursor.continue();
                } else {
                    resolve(creatures);
                }
            };
            
            request.onerror = (event) => {
                reject(new Error('Error searching creatures'));
            };
        });
    } catch (error) {
        console.error('Error searching creatures:', error);
        return [];
    }
}

/**
 * Clear all data
 * @returns {Promise} Resolves when clearing is complete
 */
export async function clearData() {
    try {
        // Reset in-memory cache
        resetDataCache();
        
        // Clear IndexedDB
        await clearDatabase();
        
        // Clear localStorage fallback
        localStorage.removeItem('dnd5e_summons_data');
        localStorage.removeItem('dnd5e_summons_data_version');
        
        console.log('Cleared all data from storage');
        return true;
    } catch (error) {
        console.error('Error clearing data:', error);
        return false;
    }
}

/**
 * Export the current data as a JSON file
 * @returns {Promise<Object>} Resolves with a blob URL to download the data
 */
export async function exportData() {
    try {
        // Get all the creatures
        const creatures = await getAllCreatures();
        
        // Get the metadata
        const metadata = {
            version: dataCache.metadata.version,
            lastUpdated: dataCache.metadata.lastUpdated,
            creatureCount: creatures.length,
            exportDate: new Date().toISOString()
        };
        
        // Create the export object
        const exportData = {
            metadata: metadata,
            creatures: creatures
        };
        
        // Convert to JSON
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create a blob
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob);
        
        return {
            success: true,
            url: url,
            filename: `dnd5e_summons_data_${new Date().toISOString().slice(0, 10)}.json`
        };
    } catch (error) {
        console.error('Error exporting data:', error);
        throw error;
    }
}

/**
 * Import data from a JSON file
 * @param {File} file - The JSON file to import
 * @returns {Promise<Object>} Resolves with results about the imported data
 */
export async function importData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function(event) {
            try {
                const jsonData = JSON.parse(event.target.result);
                
                // Validate the import data
                if (!jsonData.metadata || !jsonData.creatures || !Array.isArray(jsonData.creatures)) {
                    throw new Error('Invalid import file format');
                }
                
                // Reset the data cache
                resetDataCache();
                
                // Clear the database
                await clearDatabase();
                
                // Update the cache with the imported data
                dataCache.metadata.version = jsonData.metadata.version || '0.1.0';
                dataCache.metadata.lastUpdated = jsonData.metadata.lastUpdated || new Date().toISOString();
                dataCache.metadata.creatureCount = jsonData.creatures.length;
                
                // Process creatures
                let validCreatures = 0;
                let invalidCreatures = 0;
                
                jsonData.creatures.forEach(creature => {
                    // Basic validation
                    if (!creature.id || !creature.name || !creature.type) {
                        invalidCreatures++;
                        return;
                    }
                    
                    // Add to our creatures array
                    dataCache.creatures.push(creature);
                    
                    // Update the lookup caches
                    if (!dataCache.creaturesByType[creature.type]) {
                        dataCache.creaturesByType[creature.type] = [];
                    }
                    dataCache.creaturesByType[creature.type].push(creature);
                    
                    const crKey = creature.cr.toString();
                    if (!dataCache.creaturesByCR[crKey]) {
                        dataCache.creaturesByCR[crKey] = [];
                    }
                    dataCache.creaturesByCR[crKey].push(creature);
                    
                    validCreatures++;
                });
                
                // Save to IndexedDB
                await storeProcessedData();
                
                resolve({
                    success: true,
                    validCreatures: validCreatures,
                    invalidCreatures: invalidCreatures,
                    types: Object.keys(dataCache.creaturesByType).length,
                    crs: Object.keys(dataCache.creaturesByCR).length
                });
            } catch (error) {
                console.error('Error importing data:', error);
                reject(error);
            }
        };
        
        reader.onerror = function() {
            reject(new Error('Error reading import file'));
        };
        
        reader.readAsText(file);
    });
}

/**
 * Get data statistics
 * @returns {Promise<Object>} Resolves with statistics about the data
 */
export async function getDataStatistics() {
    try {
        // Get all creatures if not already in cache
        if (dataCache.creatures.length === 0) {
            await getAllCreatures();
        }
        
        // Count creatures by type
        const typeStats = {};
        for (const [type, creatures] of Object.entries(dataCache.creaturesByType)) {
            typeStats[type] = creatures.length;
        }
        
        // Count creatures by CR
        const crStats = {};
        for (const [cr, creatures] of Object.entries(dataCache.creaturesByCR)) {
            crStats[cr] = creatures.length;
        }
        
        // Count creatures by size
        const sizeStats = {};
        for (const creature of dataCache.creatures) {
            if (!sizeStats[creature.size]) {
                sizeStats[creature.size] = 0;
            }
            sizeStats[creature.size]++;
        }
        
        return {
            total: dataCache.creatures.length,
            typeStats: typeStats,
            crStats: crStats,
            sizeStats: sizeStats
        };
    } catch (error) {
        console.error('Error getting data statistics:', error);
        return {
            total: 0,
            typeStats: {},
            crStats: {},
            sizeStats: {}
        };
    }
}